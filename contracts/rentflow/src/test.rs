#![cfg(test)]

extern crate std;
use std::format;

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events},
    Address, BytesN, Env,
};
use types::{ContractStatus, DepositStatus, DisputeStatus, Error, RentStatus};

fn setup_env<'a>() -> (
    Env,
    RentFlowContractClient<'a>,
    Address,
    Address,
    Address,
    Address,
) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let oracle = Address::generate(&env);
    let landlord = Address::generate(&env);
    let tenant = Address::generate(&env);

    let contract_id = env.register(RentFlowContract, (&admin, &oracle));
    let client = RentFlowContractClient::new(&env, &contract_id);

    (env, client, admin, oracle, landlord, tenant)
}

fn sample_id(env: &Env, byte: u8) -> BytesN<16> {
    BytesN::from_array(env, &[byte; 16])
}

fn sample_hash(env: &Env, byte: u8) -> BytesN<32> {
    BytesN::from_array(env, &[byte; 32])
}

#[test]
fn test_end_to_end_happy_path() {
    let (env, client, _admin, _oracle, landlord, tenant) = setup_env();

    let id = sample_id(&env, 1);
    let doc_hash = sample_hash(&env, 1);
    let deposit = 5_000_000i128;
    let rent = 3_000_000i128;
    let due_day = 5u32;
    let late_fee_bps = 50u32;

    // 1. Create contract
    client.create_contract(
        &id,
        &landlord,
        &tenant,
        &doc_hash,
        &deposit,
        &rent,
        &due_day,
        &late_fee_bps,
    );

    let contract = client.get_contract(&id);
    assert_eq!(contract.status, ContractStatus::PendingConfirmation);
    assert_eq!(contract.deposit_status, DepositStatus::Unpaid);

    // 2. Tenant confirms
    client.tenant_confirm(&id, &tenant);
    let contract = client.get_contract(&id);
    assert_eq!(contract.status, ContractStatus::Active);

    // 3. Record deposit paid
    let pay_ref = sample_hash(&env, 2);
    client.record_deposit_paid(&id, &pay_ref, &deposit);
    let contract = client.get_contract(&id);
    assert_eq!(contract.deposit_status, DepositStatus::Recorded);
    assert_eq!(contract.deposit_paid_amount, deposit);

    // 4. Record rent paid
    let rent_ref = sample_hash(&env, 3);
    client.record_rent_paid(&id, &1u32, &rent, &rent_ref);
    let period = client.get_rent_period(&id, &1u32);
    assert_eq!(period.status, RentStatus::Paid);
    assert_eq!(period.amount_paid, rent);

    // 5. Refund flow: request then both approve
    client.request_refund(&id, &tenant);
    let contract = client.get_contract(&id);
    assert_eq!(contract.deposit_status, DepositStatus::PendingRefund);

    // Landlord approves
    client.approve_refund(&id, &landlord, &deposit);
    let contract = client.get_contract(&id);
    assert_eq!(contract.deposit_status, DepositStatus::PendingRefund);

    // Tenant approves matching amount
    client.approve_refund(&id, &tenant, &deposit);
    assert!(!env.events().all().events().is_empty());

    let contract = client.get_contract(&id);
    assert_eq!(contract.deposit_status, DepositStatus::Refunded);
    assert_eq!(contract.status, ContractStatus::Ended);
    assert_eq!(contract.refund_amount, deposit);
}

#[test]
fn test_underpaid_deposit_rejected() {
    let (env, client, _admin, _oracle, landlord, tenant) = setup_env();

    let id = sample_id(&env, 2);
    let doc_hash = sample_hash(&env, 1);
    let deposit = 5_000_000i128;
    let rent = 3_000_000i128;

    client.create_contract(&id, &landlord, &tenant, &doc_hash, &deposit, &rent, &5, &50);
    client.tenant_confirm(&id, &tenant);

    // Underpaid deposit should fail with DepositMismatch
    let pay_ref = sample_hash(&env, 2);
    let result = client.try_record_deposit_paid(&id, &pay_ref, &(deposit - 1_000));
    assert_eq!(result, Err(Ok(Error::DepositMismatch)));

    let contract = client.get_contract(&id);
    assert_eq!(contract.deposit_status, DepositStatus::Unpaid);
}

#[test]
fn test_unilateral_refund_does_not_finalize() {
    let (env, client, _admin, _oracle, landlord, tenant) = setup_env();

    let id = sample_id(&env, 3);
    let doc_hash = sample_hash(&env, 1);
    let deposit = 5_000_000i128;

    client.create_contract(&id, &landlord, &tenant, &doc_hash, &deposit, &3_000_000, &5, &50);
    client.tenant_confirm(&id, &tenant);
    client.record_deposit_paid(&id, &sample_hash(&env, 2), &deposit);

    // Only landlord approves
    client.approve_refund(&id, &landlord, &deposit);
    let contract = client.get_contract(&id);
    assert_eq!(contract.deposit_status, DepositStatus::PendingRefund);
    assert_ne!(contract.status, ContractStatus::Ended);

    // Tenant approves DIFFERENT amount -> RefundAmountMismatch
    let result = client.try_approve_refund(&id, &tenant, &(deposit - 500_000));
    assert_eq!(result, Err(Ok(Error::RefundAmountMismatch)));

    let contract = client.get_contract(&id);
    assert_eq!(contract.deposit_status, DepositStatus::PendingRefund);
    assert_ne!(contract.status, ContractStatus::Ended);
}

#[test]
fn test_deduction_rejected_transitions_to_pending_dispute() {
    let (env, client, _admin, _oracle, landlord, tenant) = setup_env();

    let id = sample_id(&env, 4);
    let deposit = 5_000_000i128;

    client.create_contract(&id, &landlord, &tenant, &sample_hash(&env, 1), &deposit, &3_000_000, &5, &50);
    client.tenant_confirm(&id, &tenant);
    client.record_deposit_paid(&id, &sample_hash(&env, 2), &deposit);

    let deduction_amount = 1_000_000i128;
    let reason_hash = sample_hash(&env, 9);
    client.propose_deduction(&id, &landlord, &deduction_amount, &reason_hash);

    // Tenant rejects
    client.respond_deduction(&id, &tenant, &false);

    let contract = client.get_contract(&id);
    assert_eq!(contract.deposit_status, DepositStatus::PendingDispute);
    assert_eq!(contract.dispute_status, DisputeStatus::InProgress);
}

#[test]
fn test_unauthorized_calls_rejected() {
    let (env, client, _admin, _oracle, landlord, tenant) = setup_env();
    let stranger = Address::generate(&env);

    let id = sample_id(&env, 5);
    let deposit = 5_000_000i128;

    client.create_contract(&id, &landlord, &tenant, &sample_hash(&env, 1), &deposit, &3_000_000, &5, &50);

    let res = client.try_tenant_confirm(&id, &stranger);
    assert_eq!(res, Err(Ok(Error::Unauthorized)));
}

#[test]
fn test_late_fee_calculation_and_overdue() {
    let (env, client, _admin, _oracle, landlord, tenant) = setup_env();

    let id = sample_id(&env, 6);
    let rent = 10_000_000i128;
    let bps = 25u32;
    let days_late = 12u32;

    client.create_contract(&id, &landlord, &tenant, &sample_hash(&env, 1), &5_000_000, &rent, &5, &bps);
    client.tenant_confirm(&id, &tenant);

    // 10_000_000 * 25 * 12 / 10_000 = 300_000
    let fee = client.calc_late_fee(&id, &1u32, &days_late);
    assert_eq!(fee, 300_000i128);

    // Mark overdue
    client.mark_overdue(&id, &1u32, &days_late);
    let period = client.get_rent_period(&id, &1u32);
    assert_eq!(period.status, RentStatus::Overdue);
    assert_eq!(period.late_days, days_late);
    assert_eq!(period.late_fee, 300_000i128);

    // Landlord extends due: resets late_days = 0, late_fee = 0
    let new_due_ts = 1770000000u64;
    client.extend_due(&id, &1u32, &new_due_ts);
    let period = client.get_rent_period(&id, &1u32);
    assert_eq!(period.status, RentStatus::AwaitingPayment);
    assert_eq!(period.due_date_ts, new_due_ts);
    assert_eq!(period.late_days, 0);
    assert_eq!(period.late_fee, 0);
}

#[test]
fn test_deduction_accepted_happy_path() {
    let (env, client, _admin, _oracle, landlord, tenant) = setup_env();

    let id = sample_id(&env, 7);
    let deposit = 5_000_000i128;

    client.create_contract(&id, &landlord, &tenant, &sample_hash(&env, 1), &deposit, &3_000_000, &5, &50);
    client.tenant_confirm(&id, &tenant);
    client.record_deposit_paid(&id, &sample_hash(&env, 2), &deposit);

    let deduction_amount = 1_500_000i128;
    client.propose_deduction(&id, &landlord, &deduction_amount, &sample_hash(&env, 8));

    // Tenant accepts
    client.respond_deduction(&id, &tenant, &true);

    let contract = client.get_contract(&id);
    assert_eq!(contract.deposit_status, DepositStatus::Deducted);
    assert_eq!(contract.status, ContractStatus::Ended);
    assert_eq!(contract.deducted_amount, 1_500_000i128);
    assert_eq!(contract.refund_amount, 3_500_000i128);
}

#[test]
fn test_dispute_resolution_happy_path() {
    let (env, client, _admin, _oracle, landlord, tenant) = setup_env();

    let id = sample_id(&env, 8);
    let deposit = 5_000_000i128;

    client.create_contract(&id, &landlord, &tenant, &sample_hash(&env, 1), &deposit, &3_000_000, &5, &50);
    client.tenant_confirm(&id, &tenant);
    client.record_deposit_paid(&id, &sample_hash(&env, 2), &deposit);

    // Open dispute
    client.open_dispute(&id, &tenant);
    let contract = client.get_contract(&id);
    assert_eq!(contract.deposit_status, DepositStatus::PendingDispute);
    assert_eq!(contract.dispute_status, DisputeStatus::InProgress);

    // Landlord submits agreed amount
    let agreed = 3_000_000i128;
    client.resolve_dispute(&id, &landlord, &agreed);
    let contract = client.get_contract(&id);
    assert_eq!(contract.dispute_status, DisputeStatus::AwaitingConfirmation);

    // Tenant submits same agreed amount
    client.resolve_dispute(&id, &tenant, &agreed);
    let contract = client.get_contract(&id);
    assert_eq!(contract.dispute_status, DisputeStatus::Resolved);
    assert_eq!(contract.deposit_status, DepositStatus::Deducted);
    assert_eq!(contract.refund_amount, 3_000_000i128);
    assert_eq!(contract.deducted_amount, 2_000_000i128);
    assert_eq!(contract.status, ContractStatus::Ended);
}

#[test]
fn test_partial_rent_payment() {
    let (env, client, _admin, _oracle, landlord, tenant) = setup_env();

    let id = sample_id(&env, 9);
    let rent = 4_000_000i128;

    client.create_contract(&id, &landlord, &tenant, &sample_hash(&env, 1), &5_000_000, &rent, &5, &50);
    client.tenant_confirm(&id, &tenant);

    client.record_rent_paid(&id, &1u32, &2_000_000i128, &sample_hash(&env, 1));
    let period = client.get_rent_period(&id, &1u32);
    assert_eq!(period.status, RentStatus::PartiallyPaid);
    assert_eq!(period.amount_paid, 2_000_000i128);

    client.record_rent_paid(&id, &1u32, &2_000_000i128, &sample_hash(&env, 2));
    let period = client.get_rent_period(&id, &1u32);
    assert_eq!(period.status, RentStatus::Paid);
    assert_eq!(period.amount_paid, 4_000_000i128);
}

// ==================== REVIEW-1 REGRESSION TESTS ====================

#[test]
fn test_regression_p0_3_same_party_rejected() {
    let (env, client, _admin, _oracle, landlord, _tenant) = setup_env();

    let id = sample_id(&env, 10);
    // Landlord == Tenant must be rejected with SamePartyNotAllowed
    let res = client.try_create_contract(
        &id,
        &landlord,
        &landlord,
        &sample_hash(&env, 1),
        &5_000_000,
        &3_000_000,
        &5,
        &50,
    );
    assert_eq!(res, Err(Ok(Error::SamePartyNotAllowed)));
}

#[test]
fn test_regression_p0_4_duplicate_payment_ref_rejected() {
    let (env, client, _admin, _oracle, landlord, tenant) = setup_env();

    let id = sample_id(&env, 11);
    let deposit = 5_000_000i128;
    let rent = 3_000_000i128;

    client.create_contract(&id, &landlord, &tenant, &sample_hash(&env, 1), &deposit, &rent, &5, &50);
    client.tenant_confirm(&id, &tenant);

    let pay_ref = sample_hash(&env, 55);
    // First deposit payment succeeds
    client.record_deposit_paid(&id, &pay_ref, &deposit);

    // Same payment ref hash for rent or second payment must fail with DuplicatePaymentRef
    let res = client.try_record_rent_paid(&id, &1u32, &rent, &pay_ref);
    assert_eq!(res, Err(Ok(Error::DuplicatePaymentRef)));

    // Duplicate rent payment ref on retry
    let rent_ref = sample_hash(&env, 56);
    client.record_rent_paid(&id, &1u32, &rent, &rent_ref);
    let res_retry = client.try_record_rent_paid(&id, &2u32, &rent, &rent_ref);
    assert_eq!(res_retry, Err(Ok(Error::DuplicatePaymentRef)));
}

#[test]
fn test_regression_p0_5_deposit_on_inactive_contract_rejected() {
    let (env, client, _admin, _oracle, landlord, tenant) = setup_env();

    let id = sample_id(&env, 12);
    let deposit = 5_000_000i128;

    // Create contract (status is PendingConfirmation)
    client.create_contract(&id, &landlord, &tenant, &sample_hash(&env, 1), &deposit, &3_000_000, &5, &50);

    // Attempt to record deposit BEFORE tenant confirms -> InvalidTransition
    let res = client.try_record_deposit_paid(&id, &sample_hash(&env, 1), &deposit);
    assert_eq!(res, Err(Ok(Error::InvalidTransition)));

    // Confirm then record deposit succeeds
    client.tenant_confirm(&id, &tenant);
    let ok = client.try_record_deposit_paid(&id, &sample_hash(&env, 1), &deposit);
    assert!(ok.is_ok());
}

#[test]
fn test_regression_p0_2_respond_deduction_no_replay() {
    let (env, client, _admin, _oracle, landlord, tenant) = setup_env();

    let id = sample_id(&env, 13);
    let deposit = 5_000_000i128;

    client.create_contract(&id, &landlord, &tenant, &sample_hash(&env, 1), &deposit, &3_000_000, &5, &50);
    client.tenant_confirm(&id, &tenant);
    client.record_deposit_paid(&id, &sample_hash(&env, 2), &deposit);

    // Propose deduction
    client.propose_deduction(&id, &landlord, &1_000_000, &sample_hash(&env, 3));

    // Tenant accepts
    client.respond_deduction(&id, &tenant, &true);
    let contract = client.get_contract(&id);
    assert_eq!(contract.deposit_status, DepositStatus::Deducted);
    assert_eq!(contract.status, ContractStatus::Ended);

    // Replay attempt 1: accept again on ended contract -> InvalidTransition (not PendingRefund)
    let replay1 = client.try_respond_deduction(&id, &tenant, &true);
    assert_eq!(replay1, Err(Ok(Error::InvalidTransition)));

    // Replay attempt 2: reject on ended contract -> InvalidTransition
    let replay2 = client.try_respond_deduction(&id, &tenant, &false);
    assert_eq!(replay2, Err(Ok(Error::InvalidTransition)));
}

#[test]
fn test_regression_p0_6_dispute_amount_mismatch_resets_to_in_progress() {
    let (env, client, _admin, _oracle, landlord, tenant) = setup_env();

    let id = sample_id(&env, 14);
    let deposit = 5_000_000i128;

    client.create_contract(&id, &landlord, &tenant, &sample_hash(&env, 1), &deposit, &3_000_000, &5, &50);
    client.tenant_confirm(&id, &tenant);
    client.record_deposit_paid(&id, &sample_hash(&env, 2), &deposit);

    client.open_dispute(&id, &tenant);
    assert_eq!(client.get_contract(&id).dispute_status, DisputeStatus::InProgress);

    // Landlord submits 2_000_000
    client.resolve_dispute(&id, &landlord, &2_000_000);
    assert_eq!(client.get_contract(&id).dispute_status, DisputeStatus::AwaitingConfirmation);

    // Tenant submits 3_000_000 (mismatch): returns Ok(()), does NOT rollback, resets to InProgress
    let res = client.try_resolve_dispute(&id, &tenant, &3_000_000);
    assert!(res.is_ok());

    let contract = client.get_contract(&id);
    assert_eq!(contract.dispute_status, DisputeStatus::InProgress);

    // Since both were cleared, submitting again moves to AwaitingConfirmation
    client.resolve_dispute(&id, &tenant, &2_500_000);
    assert_eq!(client.get_contract(&id).dispute_status, DisputeStatus::AwaitingConfirmation);

    // Updating own amount while in AwaitingConfirmation works
    client.resolve_dispute(&id, &tenant, &2_000_000);
    assert_eq!(client.get_contract(&id).dispute_status, DisputeStatus::AwaitingConfirmation);

    // Landlord agrees on 2_000_000 -> Resolved!
    client.resolve_dispute(&id, &landlord, &2_000_000);
    let contract = client.get_contract(&id);
    assert_eq!(contract.dispute_status, DisputeStatus::Resolved);
    assert_eq!(contract.deposit_status, DepositStatus::Deducted);
    assert_eq!(contract.refund_amount, 2_000_000);
    assert_eq!(contract.deducted_amount, 3_000_000);
}

#[test]
fn test_regression_p0_7_propose_deduction_transitions_to_pending_refund() {
    let (env, client, _admin, _oracle, landlord, tenant) = setup_env();

    let id = sample_id(&env, 15);
    let deposit = 5_000_000i128;

    client.create_contract(&id, &landlord, &tenant, &sample_hash(&env, 1), &deposit, &3_000_000, &5, &50);
    client.tenant_confirm(&id, &tenant);
    client.record_deposit_paid(&id, &sample_hash(&env, 2), &deposit);
    assert_eq!(client.get_contract(&id).deposit_status, DepositStatus::Recorded);

    // propose_deduction must transition Recorded -> PendingRefund
    client.propose_deduction(&id, &landlord, &1_000_000, &sample_hash(&env, 77));
    assert_eq!(client.get_contract(&id).deposit_status, DepositStatus::PendingRefund);
}

#[test]
fn test_regression_p0_8_extend_due_rules() {
    let (env, client, _admin, _oracle, landlord, tenant) = setup_env();

    let id = sample_id(&env, 16);
    let rent = 3_000_000i128;

    client.create_contract(&id, &landlord, &tenant, &sample_hash(&env, 1), &5_000_000, &rent, &5, &50);
    client.tenant_confirm(&id, &tenant);

    // Period 1 is not overdue yet (not created or AwaitingPayment) -> extend_due must fail with PeriodNotFound or InvalidTransition
    let res = client.try_extend_due(&id, &1u32, &1770000000u64);
    assert!(res.is_err());

    // Mark period 1 overdue
    client.mark_overdue(&id, &1u32, &5);
    let period = client.get_rent_period(&id, &1u32);
    assert_eq!(period.status, RentStatus::Overdue);
    assert_eq!(period.late_days, 5);
    assert!(period.late_fee > 0);

    // Extend due succeeds, resets late_days and late_fee to 0
    client.extend_due(&id, &1u32, &1770000000u64);
    let period = client.get_rent_period(&id, &1u32);
    assert_eq!(period.status, RentStatus::AwaitingPayment);
    assert_eq!(period.late_days, 0);
    assert_eq!(period.late_fee, 0);

    // Calling extend_due again when now AwaitingPayment (not Overdue) must fail with InvalidTransition
    let res2 = client.try_extend_due(&id, &1u32, &1770000001u64);
    assert_eq!(res2, Err(Ok(Error::InvalidTransition)));
}

#[test]
fn test_regression_p1_late_fee_bps_cap_and_period_validation() {
    let (env, client, _admin, _oracle, landlord, tenant) = setup_env();

    let id = sample_id(&env, 17);
    // BPS > 10000 must be rejected
    let res = client.try_create_contract(
        &id,
        &landlord,
        &tenant,
        &sample_hash(&env, 1),
        &5_000_000,
        &3_000_000,
        &5,
        &10_001,
    );
    assert_eq!(res, Err(Ok(Error::InvalidAmount)));

    // Period 0 must be rejected with PeriodNotFound
    client.create_contract(&id, &landlord, &tenant, &sample_hash(&env, 1), &5_000_000, &3_000_000, &5, &50);
    client.tenant_confirm(&id, &tenant);

    let res_rent0 = client.try_record_rent_paid(&id, &0u32, &1_000_000, &sample_hash(&env, 1));
    assert_eq!(res_rent0, Err(Ok(Error::PeriodNotFound)));

    let res_overdue0 = client.try_mark_overdue(&id, &0u32, &3);
    assert_eq!(res_overdue0, Err(Ok(Error::PeriodNotFound)));

    let res_calc0 = client.try_calc_late_fee(&id, &0u32, &3);
    assert_eq!(res_calc0, Err(Ok(Error::PeriodNotFound)));

    let res_get0 = client.try_get_rent_period(&id, &0u32);
    assert_eq!(res_get0, Err(Ok(Error::PeriodNotFound)));
}

// ==================== REVIEW-2 REGRESSION TESTS ====================

#[test]
fn test_regression_review2_landlord_approval_cleared_on_propose_deduction() {
    let (env, client, _admin, _oracle, landlord, tenant) = setup_env();

    let id = sample_id(&env, 18);
    let deposit = 5_000_000i128;

    client.create_contract(&id, &landlord, &tenant, &sample_hash(&env, 1), &deposit, &3_000_000, &5, &50);
    client.tenant_confirm(&id, &tenant);
    client.record_deposit_paid(&id, &sample_hash(&env, 2), &deposit);

    // Landlord approves refund of full deposit
    client.approve_refund(&id, &landlord, &deposit);

    // Landlord changes mind and proposes deduction of 1_500_000
    let reason_hash = sample_hash(&env, 7);
    client.propose_deduction(&id, &landlord, &1_500_000, &reason_hash);

    // Tenant tries to call approve_refund(5_000_000) while deduction proposal is active
    // Must be rejected with InvalidTransition because proposal is active
    let res = client.try_approve_refund(&id, &tenant, &deposit);
    assert_eq!(res, Err(Ok(Error::InvalidTransition)));

    // Tenant rejects deduction -> transitions to PendingDispute and clears approvals
    client.respond_deduction(&id, &tenant, &false);
    assert_eq!(client.get_contract(&id).deposit_status, DepositStatus::PendingDispute);

    // Tenant calling approve_refund in dispute fails
    let res2 = client.try_approve_refund(&id, &tenant, &deposit);
    assert_eq!(res2, Err(Ok(Error::InvalidTransition)));
}

#[test]
fn test_regression_review2_open_dispute_clears_proposal_and_approvals() {
    let (env, client, _admin, _oracle, landlord, tenant) = setup_env();

    let id = sample_id(&env, 19);
    let deposit = 5_000_000i128;

    client.create_contract(&id, &landlord, &tenant, &sample_hash(&env, 1), &deposit, &3_000_000, &5, &50);
    client.tenant_confirm(&id, &tenant);
    client.record_deposit_paid(&id, &sample_hash(&env, 2), &deposit);

    // Landlord approves refund and proposes deduction
    client.approve_refund(&id, &landlord, &deposit);
    client.propose_deduction(&id, &landlord, &1_000_000, &sample_hash(&env, 8));

    // Party opens dispute while proposal is active
    client.open_dispute(&id, &tenant);
    let contract = client.get_contract(&id);
    assert_eq!(contract.deposit_status, DepositStatus::PendingDispute);
    assert_eq!(contract.dispute_status, DisputeStatus::InProgress);

    // Tenant trying to respond to the previous proposal fails (proposal was removed)
    let res_resp = client.try_respond_deduction(&id, &tenant, &true);
    assert_eq!(res_resp, Err(Ok(Error::InvalidTransition)));

    // Tenant trying to approve refund fails (in dispute)
    let res_app = client.try_approve_refund(&id, &tenant, &deposit);
    assert_eq!(res_app, Err(Ok(Error::InvalidTransition)));
}

// ==================== ROUND 2 HARDENING & ADVERSARIAL TESTS ====================

fn count_release_authorized(env: &Env) -> usize {
    env.events()
        .all()
        .events()
        .iter()
        .filter(|e| format!("{:?}", e).contains("release_authorized"))
        .count()
}

#[test]
fn test_adversarial_calls_after_ended_state() {
    let (env, client, _admin, _oracle, landlord, tenant) = setup_env();

    let id = sample_id(&env, 20);
    let deposit = 5_000_000i128;
    let rent = 3_000_000i128;

    client.create_contract(&id, &landlord, &tenant, &sample_hash(&env, 1), &deposit, &rent, &5, &50);
    client.tenant_confirm(&id, &tenant);
    client.record_deposit_paid(&id, &sample_hash(&env, 2), &deposit);

    // End contract via approve_refund
    client.approve_refund(&id, &landlord, &deposit);
    client.approve_refund(&id, &tenant, &deposit);

    let contract = client.get_contract(&id);
    assert_eq!(contract.status, ContractStatus::Ended);
    assert_eq!(contract.deposit_status, DepositStatus::Refunded);

    // Every function called after ended must be rejected with InvalidTransition
    let dummy_hash = sample_hash(&env, 99);
    assert_eq!(client.try_tenant_confirm(&id, &tenant), Err(Ok(Error::InvalidTransition)));
    assert_eq!(client.try_record_deposit_paid(&id, &dummy_hash, &deposit), Err(Ok(Error::InvalidTransition)));
    assert_eq!(client.try_record_rent_paid(&id, &1, &rent, &dummy_hash), Err(Ok(Error::InvalidTransition)));
    assert_eq!(client.try_mark_overdue(&id, &1, &5), Err(Ok(Error::InvalidTransition)));
    assert_eq!(client.try_extend_due(&id, &1, &1770000000), Err(Ok(Error::InvalidTransition)));
    assert_eq!(client.try_request_refund(&id, &landlord), Err(Ok(Error::InvalidTransition)));
    assert_eq!(client.try_request_refund(&id, &tenant), Err(Ok(Error::InvalidTransition)));
    assert_eq!(client.try_approve_refund(&id, &landlord, &deposit), Err(Ok(Error::InvalidTransition)));
    assert_eq!(client.try_approve_refund(&id, &tenant, &deposit), Err(Ok(Error::InvalidTransition)));
    assert_eq!(client.try_propose_deduction(&id, &landlord, &1_000_000, &dummy_hash), Err(Ok(Error::InvalidTransition)));
    assert_eq!(client.try_respond_deduction(&id, &tenant, &true), Err(Ok(Error::InvalidTransition)));
    assert_eq!(client.try_respond_deduction(&id, &tenant, &false), Err(Ok(Error::InvalidTransition)));
    assert_eq!(client.try_open_dispute(&id, &landlord), Err(Ok(Error::InvalidTransition)));
    assert_eq!(client.try_open_dispute(&id, &tenant), Err(Ok(Error::InvalidTransition)));
    assert_eq!(client.try_resolve_dispute(&id, &landlord, &deposit), Err(Ok(Error::InvalidTransition)));
    assert_eq!(client.try_resolve_dispute(&id, &tenant, &deposit), Err(Ok(Error::InvalidTransition)));

    // Contract state remains strictly Ended and unchanged
    let contract_after = client.get_contract(&id);
    assert_eq!(contract_after.status, ContractStatus::Ended);
    assert_eq!(contract_after.deposit_status, DepositStatus::Refunded);
    assert_eq!(contract_after.refund_amount, deposit);
    assert_eq!(contract_after.deducted_amount, 0);
}

#[test]
fn test_adversarial_calls_after_ended_via_deduction_and_dispute() {
    let (env, client, _admin, _oracle, landlord, tenant) = setup_env();

    // Contract 21: ended via deduction accepted
    let id_deduct = sample_id(&env, 21);
    let deposit = 5_000_000i128;
    client.create_contract(&id_deduct, &landlord, &tenant, &sample_hash(&env, 1), &deposit, &3_000_000, &5, &50);
    client.tenant_confirm(&id_deduct, &tenant);
    client.record_deposit_paid(&id_deduct, &sample_hash(&env, 2), &deposit);
    client.propose_deduction(&id_deduct, &landlord, &2_000_000, &sample_hash(&env, 3));
    client.respond_deduction(&id_deduct, &tenant, &true);

    let c21 = client.get_contract(&id_deduct);
    assert_eq!(c21.status, ContractStatus::Ended);
    assert_eq!(c21.deposit_status, DepositStatus::Deducted);
    assert_eq!(c21.refund_amount, 3_000_000);
    assert_eq!(c21.deducted_amount, 2_000_000);

    assert_eq!(client.try_approve_refund(&id_deduct, &tenant, &deposit), Err(Ok(Error::InvalidTransition)));
    assert_eq!(client.try_resolve_dispute(&id_deduct, &tenant, &deposit), Err(Ok(Error::InvalidTransition)));
    assert_eq!(client.try_record_rent_paid(&id_deduct, &1, &1_000_000, &sample_hash(&env, 99)), Err(Ok(Error::InvalidTransition)));

    // Contract 22: ended via dispute resolved
    let id_disp = sample_id(&env, 22);
    client.create_contract(&id_disp, &landlord, &tenant, &sample_hash(&env, 1), &deposit, &3_000_000, &5, &50);
    client.tenant_confirm(&id_disp, &tenant);
    client.record_deposit_paid(&id_disp, &sample_hash(&env, 2), &deposit);
    client.open_dispute(&id_disp, &tenant);
    client.resolve_dispute(&id_disp, &landlord, &2_500_000);
    client.resolve_dispute(&id_disp, &tenant, &2_500_000);

    let c22 = client.get_contract(&id_disp);
    assert_eq!(c22.status, ContractStatus::Ended);
    assert_eq!(c22.dispute_status, DisputeStatus::Resolved);
    assert_eq!(c22.refund_amount, 2_500_000);
    assert_eq!(c22.deducted_amount, 2_500_000);

    assert_eq!(client.try_approve_refund(&id_disp, &landlord, &deposit), Err(Ok(Error::InvalidTransition)));
    assert_eq!(client.try_respond_deduction(&id_disp, &tenant, &true), Err(Ok(Error::InvalidTransition)));
    assert_eq!(client.try_resolve_dispute(&id_disp, &landlord, &2_500_000), Err(Ok(Error::InvalidTransition)));
}

#[test]
fn test_adversarial_unauthorized_all_functions() {
    let (env, client, _admin, _oracle, landlord, tenant) = setup_env();
    let stranger = Address::generate(&env);

    let id = sample_id(&env, 23);
    let deposit = 5_000_000i128;
    let rent = 3_000_000i128;

    client.create_contract(&id, &landlord, &tenant, &sample_hash(&env, 1), &deposit, &rent, &5, &50);

    // Stranger tries to confirm tenant's contract
    assert_eq!(client.try_tenant_confirm(&id, &stranger), Err(Ok(Error::Unauthorized)));
    assert_eq!(client.try_tenant_confirm(&id, &landlord), Err(Ok(Error::Unauthorized)));

    // Confirm legitimately
    client.tenant_confirm(&id, &tenant);
    client.record_deposit_paid(&id, &sample_hash(&env, 2), &deposit);

    // Stranger tries refund request and approval
    assert_eq!(client.try_request_refund(&id, &stranger), Err(Ok(Error::Unauthorized)));
    assert_eq!(client.try_approve_refund(&id, &stranger, &deposit), Err(Ok(Error::Unauthorized)));

    // Tenant or stranger tries to propose deduction (only landlord can)
    assert_eq!(client.try_propose_deduction(&id, &stranger, &1_000_000, &sample_hash(&env, 3)), Err(Ok(Error::Unauthorized)));
    assert_eq!(client.try_propose_deduction(&id, &tenant, &1_000_000, &sample_hash(&env, 3)), Err(Ok(Error::Unauthorized)));

    // Propose legitimately
    client.propose_deduction(&id, &landlord, &1_000_000, &sample_hash(&env, 3));

    // Landlord or stranger tries to respond to deduction (only tenant can)
    assert_eq!(client.try_respond_deduction(&id, &stranger, &true), Err(Ok(Error::Unauthorized)));
    assert_eq!(client.try_respond_deduction(&id, &landlord, &true), Err(Ok(Error::Unauthorized)));

    // Stranger tries to open dispute
    assert_eq!(client.try_open_dispute(&id, &stranger), Err(Ok(Error::Unauthorized)));

    // Reject deduction to move to dispute
    client.respond_deduction(&id, &tenant, &false);

    // Stranger tries to resolve dispute
    assert_eq!(client.try_resolve_dispute(&id, &stranger, &2_000_000), Err(Ok(Error::Unauthorized)));
}

#[test]
fn test_adversarial_stale_approvals() {
    let (env, client, _admin, _oracle, landlord, tenant) = setup_env();

    let id = sample_id(&env, 24);
    let deposit = 5_000_000i128;
    let rent = 3_000_000i128;

    client.create_contract(&id, &landlord, &tenant, &sample_hash(&env, 1), &deposit, &rent, &5, &50);
    client.tenant_confirm(&id, &tenant);
    client.record_deposit_paid(&id, &sample_hash(&env, 2), &deposit);

    // Landlord approves 5M refund
    client.approve_refund(&id, &landlord, &deposit);

    // Landlord proposes deduction of 1M -> clears landlord's approval
    client.propose_deduction(&id, &landlord, &1_000_000, &sample_hash(&env, 3));

    // Tenant cannot approve refund while proposal is active
    assert_eq!(client.try_approve_refund(&id, &tenant, &deposit), Err(Ok(Error::InvalidTransition)));

    // Opening dispute clears any proposal and refund approvals
    client.open_dispute(&id, &tenant);

    // In dispute: approving refund must fail with InvalidTransition (deposit is in PendingDispute)
    assert_eq!(client.try_approve_refund(&id, &landlord, &deposit), Err(Ok(Error::InvalidTransition)));
    assert_eq!(client.try_approve_refund(&id, &tenant, &deposit), Err(Ok(Error::InvalidTransition)));

    // Tenant submits 2M in dispute; landlord submits 3M -> mismatch resets to InProgress and clears both
    client.resolve_dispute(&id, &tenant, &2_000_000);
    assert_eq!(client.get_contract(&id).dispute_status, DisputeStatus::AwaitingConfirmation);

    // Landlord mismatch
    let res = client.try_resolve_dispute(&id, &landlord, &3_000_000);
    assert!(res.is_ok());
    assert_eq!(client.get_contract(&id).dispute_status, DisputeStatus::InProgress);

    // Both previous entries were cleared; submitting again moves to AwaitingConfirmation
    client.resolve_dispute(&id, &landlord, &4_000_000);
    assert_eq!(client.get_contract(&id).dispute_status, DisputeStatus::AwaitingConfirmation);

    // Tenant matches 4M -> Resolved!
    client.resolve_dispute(&id, &tenant, &4_000_000);
    let c = client.get_contract(&id);
    assert_eq!(c.dispute_status, DisputeStatus::Resolved);
    assert_eq!(c.deposit_status, DepositStatus::Deducted);
    assert_eq!(c.refund_amount, 4_000_000);
    assert_eq!(c.deducted_amount, 1_000_000);
    assert_eq!(c.status, ContractStatus::Ended);
}

#[test]
fn test_adversarial_replay_payment_ref_hash() {
    let (env, client, _admin, _oracle, landlord, tenant) = setup_env();

    let id = sample_id(&env, 25);
    let deposit = 5_000_000i128;
    let rent = 3_000_000i128;

    client.create_contract(&id, &landlord, &tenant, &sample_hash(&env, 1), &deposit, &rent, &5, &50);
    client.tenant_confirm(&id, &tenant);

    let shared_ref = sample_hash(&env, 88);

    // Record deposit paid with shared_ref
    client.record_deposit_paid(&id, &shared_ref, &deposit);

    // Replay attempt 1: Replaying deposit's payment_ref_hash for rent payment must fail
    let res1 = client.try_record_rent_paid(&id, &1u32, &rent, &shared_ref);
    assert_eq!(res1, Err(Ok(Error::DuplicatePaymentRef)));

    // Replay attempt 2: Rent payment ref replayed for next period on same contract
    let rent_ref_1 = sample_hash(&env, 89);
    client.record_rent_paid(&id, &1u32, &rent, &rent_ref_1);

    let res2 = client.try_record_rent_paid(&id, &2u32, &rent, &rent_ref_1);
    assert_eq!(res2, Err(Ok(Error::DuplicatePaymentRef)));

    // Replay attempt 3: Rent payment ref replayed for deposit on another contract where rent was paid first?
    // Contract 26: rent paid first, then deposit tries to reuse rent's ref
    let id2 = sample_id(&env, 26);
    client.create_contract(&id2, &landlord, &tenant, &sample_hash(&env, 1), &deposit, &rent, &5, &50);
    client.tenant_confirm(&id2, &tenant);

    let cross_ref = sample_hash(&env, 90);
    client.record_rent_paid(&id2, &1u32, &rent, &cross_ref);

    let res3 = client.try_record_deposit_paid(&id2, &cross_ref, &deposit);
    assert_eq!(res3, Err(Ok(Error::DuplicatePaymentRef)));
}

#[test]
fn test_adversarial_overflow() {
    let (env, client, _admin, _oracle, landlord, tenant) = setup_env();

    let id = sample_id(&env, 27);
    let deposit = 5_000_000i128;
    let rent = 3_000_000i128;

    client.create_contract(&id, &landlord, &tenant, &sample_hash(&env, 1), &deposit, &rent, &5, &50);
    client.tenant_confirm(&id, &tenant);

    // Initial partial payment
    client.record_rent_paid(&id, &1u32, &1_000_000i128, &sample_hash(&env, 1));

    // Overflows period_rec.amount_paid when adding i128::MAX
    let res = client.try_record_rent_paid(&id, &1u32, &i128::MAX, &sample_hash(&env, 2));
    assert_eq!(res, Err(Ok(Error::Overflow)));

    // Late fee overflow check: rent * bps * days_late overflows i128
    let id_huge = sample_id(&env, 28);
    let huge_rent = i128::MAX / 2;
    client.create_contract(&id_huge, &landlord, &tenant, &sample_hash(&env, 1), &deposit, &huge_rent, &5, &10000);
    client.tenant_confirm(&id_huge, &tenant);

    let fee_overflow = client.try_calc_late_fee(&id_huge, &1u32, &100);
    assert_eq!(fee_overflow, Err(Ok(Error::Overflow)));

    let overdue_overflow = client.try_mark_overdue(&id_huge, &1u32, &100);
    assert_eq!(overdue_overflow, Err(Ok(Error::Overflow)));
}

#[test]
fn test_adversarial_period_zero() {
    let (env, client, _admin, _oracle, landlord, tenant) = setup_env();

    let id = sample_id(&env, 29);
    let deposit = 5_000_000i128;
    let rent = 3_000_000i128;

    client.create_contract(&id, &landlord, &tenant, &sample_hash(&env, 1), &deposit, &rent, &5, &50);
    client.tenant_confirm(&id, &tenant);

    // All functions taking period must reject period = 0 with PeriodNotFound
    assert_eq!(client.try_record_rent_paid(&id, &0u32, &rent, &sample_hash(&env, 1)), Err(Ok(Error::PeriodNotFound)));
    assert_eq!(client.try_mark_overdue(&id, &0u32, &5), Err(Ok(Error::PeriodNotFound)));
    assert_eq!(client.try_calc_late_fee(&id, &0u32, &5), Err(Ok(Error::PeriodNotFound)));
    assert_eq!(client.try_extend_due(&id, &0u32, &1770000000u64), Err(Ok(Error::PeriodNotFound)));
    assert_eq!(client.try_get_rent_period(&id, &0u32), Err(Ok(Error::PeriodNotFound)));
}

#[test]
fn test_adversarial_negative_and_invalid_amounts() {
    let (env, client, _admin, _oracle, landlord, tenant) = setup_env();

    let id = sample_id(&env, 30);
    let doc = sample_hash(&env, 1);

    // Negative / zero deposit in create_contract
    assert_eq!(client.try_create_contract(&id, &landlord, &tenant, &doc, &-1, &3_000_000, &5, &50), Err(Ok(Error::InvalidAmount)));
    assert_eq!(client.try_create_contract(&id, &landlord, &tenant, &doc, &0, &3_000_000, &5, &50), Err(Ok(Error::InvalidAmount)));

    // Negative / zero rent in create_contract
    assert_eq!(client.try_create_contract(&id, &landlord, &tenant, &doc, &5_000_000, &-1, &5, &50), Err(Ok(Error::InvalidAmount)));
    assert_eq!(client.try_create_contract(&id, &landlord, &tenant, &doc, &5_000_000, &0, &5, &50), Err(Ok(Error::InvalidAmount)));

    // Valid create
    client.create_contract(&id, &landlord, &tenant, &doc, &5_000_000, &3_000_000, &5, &50);
    client.tenant_confirm(&id, &tenant);

    // Negative deposit payment
    assert_eq!(client.try_record_deposit_paid(&id, &sample_hash(&env, 2), &-5_000_000), Err(Ok(Error::DepositMismatch)));

    // Legitimate deposit payment
    client.record_deposit_paid(&id, &sample_hash(&env, 2), &5_000_000);

    // Negative / zero rent payment
    assert_eq!(client.try_record_rent_paid(&id, &1u32, &-1, &sample_hash(&env, 3)), Err(Ok(Error::InvalidAmount)));
    assert_eq!(client.try_record_rent_paid(&id, &1u32, &0, &sample_hash(&env, 3)), Err(Ok(Error::InvalidAmount)));

    // Negative refund approval or exceeds deposit
    assert_eq!(client.try_approve_refund(&id, &landlord, &-1), Err(Ok(Error::InvalidAmount)));
    assert_eq!(client.try_approve_refund(&id, &landlord, &5_000_001), Err(Ok(Error::InvalidAmount)));

    // Negative / zero deduction proposal or exceeds deposit
    assert_eq!(client.try_propose_deduction(&id, &landlord, &-1, &sample_hash(&env, 4)), Err(Ok(Error::InvalidAmount)));
    assert_eq!(client.try_propose_deduction(&id, &landlord, &0, &sample_hash(&env, 4)), Err(Ok(Error::InvalidAmount)));
    assert_eq!(client.try_propose_deduction(&id, &landlord, &5_000_001, &sample_hash(&env, 4)), Err(Ok(Error::DeductionExceedsDeposit)));

    // In dispute: negative or exceeds deposit agreed amount
    client.open_dispute(&id, &tenant);
    assert_eq!(client.try_resolve_dispute(&id, &landlord, &-1), Err(Ok(Error::InvalidAmount)));
    assert_eq!(client.try_resolve_dispute(&id, &landlord, &5_000_001), Err(Ok(Error::InvalidAmount)));
}

#[test]
fn test_adversarial_release_authorized_never_emitted_twice() {
    let (env, client, _admin, _oracle, landlord, tenant) = setup_env();

    // Test Case A: Finalized via approve_refund
    let id_a = sample_id(&env, 31);
    let deposit = 5_000_000i128;
    client.create_contract(&id_a, &landlord, &tenant, &sample_hash(&env, 1), &deposit, &3_000_000, &5, &50);
    client.tenant_confirm(&id_a, &tenant);
    client.record_deposit_paid(&id_a, &sample_hash(&env, 2), &deposit);

    assert_eq!(count_release_authorized(&env), 0);

    // Landlord approves refund: release_authorized must NOT be emitted yet
    client.approve_refund(&id_a, &landlord, &deposit);
    assert_eq!(count_release_authorized(&env), 0);

    // Tenant approves matching refund: release_authorized emitted EXACTLY ONCE
    client.approve_refund(&id_a, &tenant, &deposit);
    assert_eq!(count_release_authorized(&env), 1);

    // Repeated attempts to approve, deduct, or dispute must fail and emit 0 release_authorized events
    assert_eq!(client.try_approve_refund(&id_a, &landlord, &deposit), Err(Ok(Error::InvalidTransition)));
    assert_eq!(count_release_authorized(&env), 0);
    assert_eq!(client.try_approve_refund(&id_a, &tenant, &deposit), Err(Ok(Error::InvalidTransition)));
    assert_eq!(count_release_authorized(&env), 0);
    assert_eq!(client.try_propose_deduction(&id_a, &landlord, &1000, &sample_hash(&env, 3)), Err(Ok(Error::InvalidTransition)));
    assert_eq!(count_release_authorized(&env), 0);
    assert_eq!(client.try_respond_deduction(&id_a, &tenant, &true), Err(Ok(Error::InvalidTransition)));
    assert_eq!(count_release_authorized(&env), 0);
    assert_eq!(client.try_resolve_dispute(&id_a, &landlord, &deposit), Err(Ok(Error::InvalidTransition)));
    assert_eq!(count_release_authorized(&env), 0);

    // Test Case B: Finalized via respond_deduction
    let (env_b, client_b, _admin_b, _oracle_b, landlord_b, tenant_b) = setup_env();
    let id_b = sample_id(&env_b, 32);
    client_b.create_contract(&id_b, &landlord_b, &tenant_b, &sample_hash(&env_b, 1), &deposit, &3_000_000, &5, &50);
    client_b.tenant_confirm(&id_b, &tenant_b);
    client_b.record_deposit_paid(&id_b, &sample_hash(&env_b, 2), &deposit);

    client_b.propose_deduction(&id_b, &landlord_b, &1_500_000, &sample_hash(&env_b, 4));
    assert_eq!(count_release_authorized(&env_b), 0);

    // Tenant accepts: release_authorized emitted EXACTLY ONCE
    client_b.respond_deduction(&id_b, &tenant_b, &true);
    assert_eq!(count_release_authorized(&env_b), 1);

    // Repeated responses or approvals fail and emit 0 events
    assert_eq!(client_b.try_respond_deduction(&id_b, &tenant_b, &true), Err(Ok(Error::InvalidTransition)));
    assert_eq!(count_release_authorized(&env_b), 0);
    assert_eq!(client_b.try_approve_refund(&id_b, &tenant_b, &deposit), Err(Ok(Error::InvalidTransition)));
    assert_eq!(count_release_authorized(&env_b), 0);

    // Test Case C: Finalized via resolve_dispute
    let (env_c, client_c, _admin_c, _oracle_c, landlord_c, tenant_c) = setup_env();
    let id_c = sample_id(&env_c, 33);
    client_c.create_contract(&id_c, &landlord_c, &tenant_c, &sample_hash(&env_c, 1), &deposit, &3_000_000, &5, &50);
    client_c.tenant_confirm(&id_c, &tenant_c);
    client_c.record_deposit_paid(&id_c, &sample_hash(&env_c, 2), &deposit);
    client_c.open_dispute(&id_c, &tenant_c);

    client_c.resolve_dispute(&id_c, &landlord_c, &3_000_000);
    assert_eq!(count_release_authorized(&env_c), 0);

    client_c.resolve_dispute(&id_c, &tenant_c, &3_000_000);
    assert_eq!(count_release_authorized(&env_c), 1);

    assert_eq!(client_c.try_resolve_dispute(&id_c, &tenant_c, &3_000_000), Err(Ok(Error::InvalidTransition)));
    assert_eq!(count_release_authorized(&env_c), 0);
    assert_eq!(client_c.try_approve_refund(&id_c, &tenant_c, &deposit), Err(Ok(Error::InvalidTransition)));
    assert_eq!(count_release_authorized(&env_c), 0);
}

// ==================== RANDOM COMMAND SEQUENCE PROPERTY INVARIANT TESTS ====================

struct SimpleLcg {
    state: u64,
}

impl SimpleLcg {
    fn new(seed: u64) -> Self {
        Self { state: seed }
    }

    fn next_u64(&mut self) -> u64 {
        // Standard 64-bit Linear Congruential Generator
        self.state = self.state.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        self.state
    }

    fn next_range(&mut self, min: u64, max: u64) -> u64 {
        if min >= max {
            return min;
        }
        min + (self.next_u64() % (max - min + 1))
    }

    fn next_bool(&mut self) -> bool {
        (self.next_u64() & 1) == 1
    }
}

#[test]
fn test_random_command_sequence_invariants() {
    let mut rng = SimpleLcg::new(0xCAFE_BABE_1234_5678);

    for run in 0..10 {
        let (env, client, _admin, _oracle, landlord, tenant) = setup_env();
        let stranger = Address::generate(&env);

        let id = sample_id(&env, 100 + run as u8);
        let deposit = (rng.next_range(1, 10) * 1_000_000) as i128;
        let rent = (rng.next_range(1, 5) * 1_000_000) as i128;
        let doc_hash = sample_hash(&env, run as u8);

        let mut contract_created = false;
        let mut was_ended = false;
        let mut total_release_authorized = 0;

        let total_steps = 150;
        for step in 0..total_steps {
            let action = rng.next_range(0, 11);
            let actor_choice = rng.next_range(0, 3);
            let actor = match actor_choice {
                0 => landlord.clone(),
                1 => tenant.clone(),
                _ => stranger.clone(),
            };

            let random_amount = (rng.next_range(0, 12) * 500_000) as i128;
            let period = rng.next_range(0, 4) as u32;
            let random_hash = sample_hash(&env, (step % 255) as u8);

            match action {
                0 => {
                    // create_contract
                    let due_day = rng.next_range(1, 31) as u32;
                    let bps = rng.next_range(1, 100) as u32;
                    let res = client.try_create_contract(&id, &landlord, &tenant, &doc_hash, &deposit, &rent, &due_day, &bps);
                    if res.is_ok() {
                        contract_created = true;
                    }
                }
                1 => {
                    // tenant_confirm
                    let _ = client.try_tenant_confirm(&id, &actor);
                }
                2 => {
                    // record_deposit_paid
                    let _ = client.try_record_deposit_paid(&id, &random_hash, &random_amount);
                }
                3 => {
                    // record_rent_paid
                    let _ = client.try_record_rent_paid(&id, &period, &random_amount, &random_hash);
                }
                4 => {
                    // mark_overdue
                    let days = rng.next_range(0, 30) as u32;
                    let _ = client.try_mark_overdue(&id, &period, &days);
                }
                5 => {
                    // extend_due
                    let ts = 1770000000u64 + step as u64;
                    let _ = client.try_extend_due(&id, &period, &ts);
                }
                6 => {
                    // request_refund
                    let _ = client.try_request_refund(&id, &actor);
                }
                7 => {
                    // approve_refund
                    let _ = client.try_approve_refund(&id, &actor, &random_amount);
                }
                8 => {
                    // propose_deduction
                    let _ = client.try_propose_deduction(&id, &actor, &random_amount, &random_hash);
                }
                9 => {
                    // respond_deduction
                    let accept = rng.next_bool();
                    let _ = client.try_respond_deduction(&id, &actor, &accept);
                }
                10 => {
                    // open_dispute
                    let _ = client.try_open_dispute(&id, &actor);
                }
                11 => {
                    // resolve_dispute
                    let _ = client.try_resolve_dispute(&id, &actor, &random_amount);
                }
                _ => {}
            }

            total_release_authorized += count_release_authorized(&env);

            // ==================== INVARIANT CHECKS AT EVERY STEP ====================
            if contract_created {
                let contract = client.get_contract(&id);

                // INVARIANT 1: Terminal state idempotency & conservation:
                // Once Ended, refund_amount + deducted_amount == deposit_amount,
                // and contract status never reverts from Ended.
                if contract.status == ContractStatus::Ended {
                    assert_eq!(
                        contract.refund_amount + contract.deducted_amount,
                        contract.deposit_amount,
                        "Invariant violation: refund ({}) + deducted ({}) != deposit ({}) at step {}",
                        contract.refund_amount, contract.deducted_amount, contract.deposit_amount, step
                    );
                    assert!(
                        contract.deposit_status == DepositStatus::Refunded || contract.deposit_status == DepositStatus::Deducted,
                        "Ended contract must have deposit status Refunded or Deducted, got {:?}",
                        contract.deposit_status
                    );
                    assert!(contract.refund_amount >= 0 && contract.deducted_amount >= 0);
                    was_ended = true;
                } else if was_ended {
                    panic!("Invariant violation: contract status changed from Ended back to {:?}", contract.status);
                }

                // INVARIANT 2: No release while in dispute
                if contract.dispute_status == DisputeStatus::InProgress
                    || contract.dispute_status == DisputeStatus::AwaitingConfirmation
                {
                    assert_eq!(
                        contract.deposit_status,
                        DepositStatus::PendingDispute,
                        "Deposit status cannot be finalized while dispute is active, got {:?}",
                        contract.deposit_status
                    );
                    assert_ne!(
                        contract.status,
                        ContractStatus::Ended,
                        "Contract cannot be Ended while dispute is still active"
                    );
                }

                // INVARIANT 3: release_authorized event emitted at most once
                if contract.status == ContractStatus::Ended {
                    assert_eq!(
                        total_release_authorized, 1,
                        "Ended contract must have exactly 1 total release_authorized event, got {} at step {}",
                        total_release_authorized, step
                    );
                } else {
                    assert_eq!(
                        total_release_authorized, 0,
                        "Non-ended contract must have 0 total release_authorized events, got {} at step {}",
                        total_release_authorized, step
                    );
                }
            }
        }
    }
}


