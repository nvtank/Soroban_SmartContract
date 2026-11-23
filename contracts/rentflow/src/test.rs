#![cfg(test)]

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

