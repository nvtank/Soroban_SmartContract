#![no_std]
#![allow(deprecated)]

pub mod storage;
pub mod types;

#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractimpl, Address, BytesN, Env, Symbol};
use storage::{ContractRecord, DataKey, DeductionProposal, RentPeriodRecord};
use types::{ContractStatus, DepositStatus, DisputeStatus, Error, RentStatus};

const DAY_IN_LEDGERS: u32 = 17280;
const INSTANCE_LIFETIME_THRESHOLD: u32 = DAY_IN_LEDGERS * 7;
const INSTANCE_BUMP_AMOUNT: u32 = DAY_IN_LEDGERS * 30;
const PERSISTENT_LIFETIME_THRESHOLD: u32 = DAY_IN_LEDGERS * 7;
const PERSISTENT_BUMP_AMOUNT: u32 = DAY_IN_LEDGERS * 30;

fn extend_instance_ttl(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
}

fn extend_persistent_ttl(env: &Env, key: &DataKey) {
    env.storage()
        .persistent()
        .extend_ttl(key, PERSISTENT_LIFETIME_THRESHOLD, PERSISTENT_BUMP_AMOUNT);
}

#[contract]
pub struct RentFlowContract;

#[contractimpl]
impl RentFlowContract {
    pub fn __constructor(env: Env, admin: Address, oracle: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Oracle, &oracle);
        extend_instance_ttl(&env);

        env.events().publish(
            (Symbol::new(&env, "admin"), Symbol::new(&env, "init")),
            (admin, oracle),
        );
    }

    pub fn create_contract(
        env: Env,
        id: BytesN<16>,
        landlord: Address,
        tenant: Address,
        doc_hash: BytesN<32>,
        deposit: i128,
        rent: i128,
        due_day: u32,
        late_fee_bps_per_day: u32,
    ) -> Result<(), Error> {
        if !env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::NotInitialized);
        }
        if landlord == tenant {
            return Err(Error::SamePartyNotAllowed);
        }
        landlord.require_auth();

        let contract_key = DataKey::Contract(id.clone());
        if env.storage().persistent().has(&contract_key) {
            return Err(Error::ContractExists);
        }
        if deposit <= 0 || rent <= 0 || late_fee_bps_per_day > 10000 {
            return Err(Error::InvalidAmount);
        }
        if !(1..=31).contains(&due_day) {
            return Err(Error::InvalidDueDay);
        }

        let record = ContractRecord {
            id: id.clone(),
            landlord: landlord.clone(),
            tenant: tenant.clone(),
            doc_hash,
            deposit_amount: deposit,
            rent_amount: rent,
            due_day,
            late_fee_bps_per_day,
            status: ContractStatus::PendingConfirmation,
            deposit_status: DepositStatus::Unpaid,
            dispute_status: DisputeStatus::None,
            deposit_paid_amount: 0,
            refund_amount: 0,
            deducted_amount: 0,
        };

        env.storage().persistent().set(&contract_key, &record);
        extend_persistent_ttl(&env, &contract_key);
        extend_instance_ttl(&env);

        env.events().publish(
            (Symbol::new(&env, "contract"), Symbol::new(&env, "created")),
            (id, landlord, tenant),
        );
        Ok(())
    }

    pub fn tenant_confirm(env: Env, id: BytesN<16>, tenant: Address) -> Result<(), Error> {
        let contract_key = DataKey::Contract(id.clone());
        let mut contract: ContractRecord = env
            .storage()
            .persistent()
            .get(&contract_key)
            .ok_or(Error::ContractNotFound)?;

        if contract.tenant != tenant {
            return Err(Error::Unauthorized);
        }
        tenant.require_auth();

        if contract.status != ContractStatus::PendingConfirmation {
            return Err(Error::InvalidTransition);
        }

        contract.status = ContractStatus::Active;
        env.storage().persistent().set(&contract_key, &contract);
        extend_persistent_ttl(&env, &contract_key);
        extend_instance_ttl(&env);

        env.events().publish(
            (Symbol::new(&env, "contract"), Symbol::new(&env, "confirmed")),
            (id, tenant),
        );
        Ok(())
    }

    pub fn record_deposit_paid(
        env: Env,
        id: BytesN<16>,
        payment_ref_hash: BytesN<32>,
        amount: i128,
    ) -> Result<(), Error> {
        let oracle: Address = env
            .storage()
            .instance()
            .get(&DataKey::Oracle)
            .ok_or(Error::NotInitialized)?;
        oracle.require_auth();

        let contract_key = DataKey::Contract(id.clone());
        let mut contract: ContractRecord = env
            .storage()
            .persistent()
            .get(&contract_key)
            .ok_or(Error::ContractNotFound)?;

        if contract.status != ContractStatus::Active {
            return Err(Error::InvalidTransition);
        }
        if contract.deposit_status != DepositStatus::Unpaid {
            return Err(Error::InvalidTransition);
        }
        if amount != contract.deposit_amount {
            return Err(Error::DepositMismatch);
        }

        let pay_key = DataKey::PaymentRef(id.clone(), payment_ref_hash.clone());
        if env.storage().persistent().has(&pay_key) {
            return Err(Error::DuplicatePaymentRef);
        }

        contract.deposit_status = DepositStatus::Recorded;
        contract.deposit_paid_amount = amount;

        env.storage().persistent().set(&pay_key, &true);
        extend_persistent_ttl(&env, &pay_key);

        env.storage().persistent().set(&contract_key, &contract);
        extend_persistent_ttl(&env, &contract_key);
        extend_instance_ttl(&env);

        env.events().publish(
            (Symbol::new(&env, "deposit"), Symbol::new(&env, "recorded")),
            (id, payment_ref_hash, amount),
        );
        Ok(())
    }

    pub fn record_rent_paid(
        env: Env,
        id: BytesN<16>,
        period: u32,
        amount: i128,
        payment_ref_hash: BytesN<32>,
    ) -> Result<(), Error> {
        if period < 1 {
            return Err(Error::PeriodNotFound);
        }

        let oracle: Address = env
            .storage()
            .instance()
            .get(&DataKey::Oracle)
            .ok_or(Error::NotInitialized)?;
        oracle.require_auth();

        let contract_key = DataKey::Contract(id.clone());
        let contract: ContractRecord = env
            .storage()
            .persistent()
            .get(&contract_key)
            .ok_or(Error::ContractNotFound)?;

        if contract.status != ContractStatus::Active {
            return Err(Error::InvalidTransition);
        }
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let pay_key = DataKey::PaymentRef(id.clone(), payment_ref_hash.clone());
        if env.storage().persistent().has(&pay_key) {
            return Err(Error::DuplicatePaymentRef);
        }

        let period_key = DataKey::RentPeriod(id.clone(), period);
        let mut period_rec: RentPeriodRecord = env
            .storage()
            .persistent()
            .get(&period_key)
            .unwrap_or(RentPeriodRecord {
                contract_id: id.clone(),
                period_no: period,
                amount_due: contract.rent_amount,
                amount_paid: 0,
                late_days: 0,
                late_fee: 0,
                status: RentStatus::AwaitingPayment,
                due_date_ts: 0,
            });

        if period_rec.status == RentStatus::Paid {
            return Err(Error::InvalidTransition);
        }

        let new_paid = period_rec
            .amount_paid
            .checked_add(amount)
            .ok_or(Error::Overflow)?;
        let total_due = period_rec
            .amount_due
            .checked_add(period_rec.late_fee)
            .ok_or(Error::Overflow)?;

        period_rec.amount_paid = new_paid;
        if new_paid >= total_due {
            period_rec.status = RentStatus::Paid;
        } else {
            period_rec.status = RentStatus::PartiallyPaid;
        }

        env.storage().persistent().set(&pay_key, &true);
        extend_persistent_ttl(&env, &pay_key);

        env.storage().persistent().set(&period_key, &period_rec);
        extend_persistent_ttl(&env, &period_key);
        extend_instance_ttl(&env);

        env.events().publish(
            (Symbol::new(&env, "rent"), Symbol::new(&env, "paid")),
            (id, period, amount, payment_ref_hash),
        );
        Ok(())
    }

    pub fn mark_overdue(env: Env, id: BytesN<16>, period: u32, days_late: u32) -> Result<(), Error> {
        if period < 1 {
            return Err(Error::PeriodNotFound);
        }

        let oracle: Address = env
            .storage()
            .instance()
            .get(&DataKey::Oracle)
            .ok_or(Error::NotInitialized)?;
        oracle.require_auth();

        let contract_key = DataKey::Contract(id.clone());
        let contract: ContractRecord = env
            .storage()
            .persistent()
            .get(&contract_key)
            .ok_or(Error::ContractNotFound)?;

        if contract.status != ContractStatus::Active {
            return Err(Error::InvalidTransition);
        }

        let period_key = DataKey::RentPeriod(id.clone(), period);
        let mut period_rec: RentPeriodRecord = env
            .storage()
            .persistent()
            .get(&period_key)
            .unwrap_or(RentPeriodRecord {
                contract_id: id.clone(),
                period_no: period,
                amount_due: contract.rent_amount,
                amount_paid: 0,
                late_days: 0,
                late_fee: 0,
                status: RentStatus::AwaitingPayment,
                due_date_ts: 0,
            });

        if period_rec.status == RentStatus::Paid {
            return Err(Error::InvalidTransition);
        }

        let bps = contract.late_fee_bps_per_day as i128;
        let days = days_late as i128;
        let late_fee = contract
            .rent_amount
            .checked_mul(bps)
            .ok_or(Error::Overflow)?
            .checked_mul(days)
            .ok_or(Error::Overflow)?
            / 10000;

        period_rec.late_days = days_late;
        period_rec.late_fee = late_fee;
        period_rec.status = RentStatus::Overdue;

        env.storage().persistent().set(&period_key, &period_rec);
        extend_persistent_ttl(&env, &period_key);
        extend_instance_ttl(&env);

        env.events().publish(
            (Symbol::new(&env, "rent"), Symbol::new(&env, "overdue")),
            (id, period, days_late, late_fee),
        );
        Ok(())
    }

    pub fn calc_late_fee(env: Env, id: BytesN<16>, period: u32, days_late: u32) -> Result<i128, Error> {
        if period < 1 {
            return Err(Error::PeriodNotFound);
        }

        let contract_key = DataKey::Contract(id);
        let contract: ContractRecord = env
            .storage()
            .persistent()
            .get(&contract_key)
            .ok_or(Error::ContractNotFound)?;

        let bps = contract.late_fee_bps_per_day as i128;
        let days = days_late as i128;
        let fee = contract
            .rent_amount
            .checked_mul(bps)
            .ok_or(Error::Overflow)?
            .checked_mul(days)
            .ok_or(Error::Overflow)?
            / 10000;
        Ok(fee)
    }

    pub fn extend_due(env: Env, id: BytesN<16>, period: u32, new_due_ts: u64) -> Result<(), Error> {
        if period < 1 {
            return Err(Error::PeriodNotFound);
        }

        let contract_key = DataKey::Contract(id.clone());
        let contract: ContractRecord = env
            .storage()
            .persistent()
            .get(&contract_key)
            .ok_or(Error::ContractNotFound)?;

        if contract.status != ContractStatus::Active {
            return Err(Error::InvalidTransition);
        }

        contract.landlord.require_auth();

        let period_key = DataKey::RentPeriod(id.clone(), period);
        let mut period_rec: RentPeriodRecord = env
            .storage()
            .persistent()
            .get(&period_key)
            .ok_or(Error::PeriodNotFound)?;

        if period_rec.status != RentStatus::Overdue {
            return Err(Error::InvalidTransition);
        }

        period_rec.status = RentStatus::AwaitingPayment;
        period_rec.due_date_ts = new_due_ts;
        period_rec.late_days = 0;
        period_rec.late_fee = 0;

        env.storage().persistent().set(&period_key, &period_rec);
        extend_persistent_ttl(&env, &period_key);
        extend_instance_ttl(&env);

        env.events().publish(
            (Symbol::new(&env, "rent"), Symbol::new(&env, "extended")),
            (id, period, new_due_ts),
        );
        Ok(())
    }

    pub fn request_refund(env: Env, id: BytesN<16>, party: Address) -> Result<(), Error> {
        let contract_key = DataKey::Contract(id.clone());
        let mut contract: ContractRecord = env
            .storage()
            .persistent()
            .get(&contract_key)
            .ok_or(Error::ContractNotFound)?;

        if party != contract.landlord && party != contract.tenant {
            return Err(Error::Unauthorized);
        }
        party.require_auth();

        if contract.deposit_status != DepositStatus::Recorded
            && contract.deposit_status != DepositStatus::PendingRefund
        {
            return Err(Error::InvalidTransition);
        }

        contract.deposit_status = DepositStatus::PendingRefund;
        env.storage().persistent().set(&contract_key, &contract);
        extend_persistent_ttl(&env, &contract_key);
        extend_instance_ttl(&env);

        env.events().publish(
            (Symbol::new(&env, "deposit"), Symbol::new(&env, "refund_requested")),
            (id, party),
        );
        Ok(())
    }

    pub fn approve_refund(
        env: Env,
        id: BytesN<16>,
        party: Address,
        refund_amount: i128,
    ) -> Result<(), Error> {
        let contract_key = DataKey::Contract(id.clone());
        let mut contract: ContractRecord = env
            .storage()
            .persistent()
            .get(&contract_key)
            .ok_or(Error::ContractNotFound)?;

        let is_landlord = party == contract.landlord;
        let is_tenant = party == contract.tenant;
        if !is_landlord && !is_tenant {
            return Err(Error::Unauthorized);
        }
        party.require_auth();

        if refund_amount < 0 || refund_amount > contract.deposit_amount {
            return Err(Error::InvalidAmount);
        }

        if contract.deposit_status != DepositStatus::Recorded
            && contract.deposit_status != DepositStatus::PendingRefund
        {
            return Err(Error::InvalidTransition);
        }

        if contract.dispute_status != DisputeStatus::None
            && contract.dispute_status != DisputeStatus::Resolved
        {
            return Err(Error::DisputeActive);
        }

        let proposal_key = DataKey::DeductionProposal(id.clone());
        if env.storage().persistent().has(&proposal_key) {
            return Err(Error::InvalidTransition);
        }

        let other_party = if is_landlord {
            contract.tenant.clone()
        } else {
            contract.landlord.clone()
        };

        let other_approval_key = DataKey::RefundApproval(id.clone(), other_party.clone());
        let other_approval: Option<i128> = env
            .storage()
            .persistent()
            .get(&other_approval_key);

        let my_approval_key = DataKey::RefundApproval(id.clone(), party.clone());
        env.storage().persistent().set(&my_approval_key, &refund_amount);
        extend_persistent_ttl(&env, &my_approval_key);

        if let Some(other_amount) = other_approval {
            if other_amount != refund_amount {
                return Err(Error::RefundAmountMismatch);
            }

            contract.deposit_status = DepositStatus::Refunded;
            contract.refund_amount = refund_amount;
            contract.status = ContractStatus::Ended;

            env.storage().persistent().remove(&other_approval_key);
            env.storage().persistent().remove(&my_approval_key);

            env.storage().persistent().set(&contract_key, &contract);
            extend_persistent_ttl(&env, &contract_key);
            extend_instance_ttl(&env);

            env.events().publish(
                (Symbol::new(&env, "release_authorized"),),
                (id.clone(), refund_amount),
            );
            env.events().publish(
                (Symbol::new(&env, "deposit"), Symbol::new(&env, "refunded")),
                (id, refund_amount),
            );
        } else {
            contract.deposit_status = DepositStatus::PendingRefund;
            env.storage().persistent().set(&contract_key, &contract);
            extend_persistent_ttl(&env, &contract_key);
            extend_instance_ttl(&env);

            env.events().publish(
                (Symbol::new(&env, "deposit"), Symbol::new(&env, "refund_approved")),
                (id, party, refund_amount),
            );
        }

        Ok(())
    }

    pub fn propose_deduction(
        env: Env,
        id: BytesN<16>,
        landlord: Address,
        amount: i128,
        reason_hash: BytesN<32>,
    ) -> Result<(), Error> {
        let contract_key = DataKey::Contract(id.clone());
        let mut contract: ContractRecord = env
            .storage()
            .persistent()
            .get(&contract_key)
            .ok_or(Error::ContractNotFound)?;

        if landlord != contract.landlord {
            return Err(Error::Unauthorized);
        }
        landlord.require_auth();

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        if amount > contract.deposit_amount {
            return Err(Error::DeductionExceedsDeposit);
        }
        if contract.deposit_status != DepositStatus::Recorded
            && contract.deposit_status != DepositStatus::PendingRefund
        {
            return Err(Error::InvalidTransition);
        }
        if contract.dispute_status != DisputeStatus::None {
            return Err(Error::DisputeActive);
        }

        contract.deposit_status = DepositStatus::PendingRefund;
        env.storage().persistent().set(&contract_key, &contract);
        extend_persistent_ttl(&env, &contract_key);

        let landlord_app_key = DataKey::RefundApproval(id.clone(), contract.landlord.clone());
        let tenant_app_key = DataKey::RefundApproval(id.clone(), contract.tenant.clone());
        env.storage().persistent().remove(&landlord_app_key);
        env.storage().persistent().remove(&tenant_app_key);

        let proposal_key = DataKey::DeductionProposal(id.clone());
        let proposal = DeductionProposal {
            amount,
            reason_hash: reason_hash.clone(),
        };
        env.storage().persistent().set(&proposal_key, &proposal);
        extend_persistent_ttl(&env, &proposal_key);
        extend_instance_ttl(&env);

        env.events().publish(
            (Symbol::new(&env, "deduction"), Symbol::new(&env, "proposed")),
            (id, amount, reason_hash),
        );
        Ok(())
    }

    pub fn respond_deduction(
        env: Env,
        id: BytesN<16>,
        tenant: Address,
        accept: bool,
    ) -> Result<(), Error> {
        let contract_key = DataKey::Contract(id.clone());
        let mut contract: ContractRecord = env
            .storage()
            .persistent()
            .get(&contract_key)
            .ok_or(Error::ContractNotFound)?;

        if tenant != contract.tenant {
            return Err(Error::Unauthorized);
        }
        tenant.require_auth();

        if contract.deposit_status != DepositStatus::PendingRefund {
            return Err(Error::InvalidTransition);
        }
        if contract.dispute_status != DisputeStatus::None {
            return Err(Error::DisputeActive);
        }

        let proposal_key = DataKey::DeductionProposal(id.clone());
        let proposal: DeductionProposal = env
            .storage()
            .persistent()
            .get(&proposal_key)
            .ok_or(Error::DeductionNotFound)?;

        env.storage().persistent().remove(&proposal_key);

        if accept {
            let refund = contract
                .deposit_amount
                .checked_sub(proposal.amount)
                .ok_or(Error::Overflow)?;

            contract.deposit_status = DepositStatus::Deducted;
            contract.deducted_amount = proposal.amount;
            contract.refund_amount = refund;
            contract.status = ContractStatus::Ended;

            env.storage().persistent().set(&contract_key, &contract);
            extend_persistent_ttl(&env, &contract_key);
            extend_instance_ttl(&env);

            env.events().publish(
                (Symbol::new(&env, "release_authorized"),),
                (id.clone(), refund, proposal.amount),
            );
            env.events().publish(
                (Symbol::new(&env, "deduction"), Symbol::new(&env, "accepted")),
                (id, proposal.amount),
            );
        } else {
            contract.deposit_status = DepositStatus::PendingDispute;
            contract.dispute_status = DisputeStatus::InProgress;

            let landlord_app_key = DataKey::RefundApproval(id.clone(), contract.landlord.clone());
            let tenant_app_key = DataKey::RefundApproval(id.clone(), contract.tenant.clone());
            env.storage().persistent().remove(&landlord_app_key);
            env.storage().persistent().remove(&tenant_app_key);

            env.storage().persistent().set(&contract_key, &contract);
            extend_persistent_ttl(&env, &contract_key);
            extend_instance_ttl(&env);

            env.events().publish(
                (Symbol::new(&env, "deduction"), Symbol::new(&env, "rejected")),
                id.clone(),
            );
            env.events().publish(
                (Symbol::new(&env, "dispute"), Symbol::new(&env, "opened")),
                (id, tenant),
            );
        }

        Ok(())
    }

    pub fn open_dispute(env: Env, id: BytesN<16>, party: Address) -> Result<(), Error> {
        let contract_key = DataKey::Contract(id.clone());
        let mut contract: ContractRecord = env
            .storage()
            .persistent()
            .get(&contract_key)
            .ok_or(Error::ContractNotFound)?;

        if party != contract.landlord && party != contract.tenant {
            return Err(Error::Unauthorized);
        }
        party.require_auth();

        if contract.deposit_status != DepositStatus::Recorded
            && contract.deposit_status != DepositStatus::PendingRefund
        {
            return Err(Error::InvalidTransition);
        }

        contract.deposit_status = DepositStatus::PendingDispute;
        contract.dispute_status = DisputeStatus::InProgress;

        let proposal_key = DataKey::DeductionProposal(id.clone());
        env.storage().persistent().remove(&proposal_key);
        let landlord_app_key = DataKey::RefundApproval(id.clone(), contract.landlord.clone());
        let tenant_app_key = DataKey::RefundApproval(id.clone(), contract.tenant.clone());
        env.storage().persistent().remove(&landlord_app_key);
        env.storage().persistent().remove(&tenant_app_key);

        env.storage().persistent().set(&contract_key, &contract);
        extend_persistent_ttl(&env, &contract_key);
        extend_instance_ttl(&env);

        env.events().publish(
            (Symbol::new(&env, "dispute"), Symbol::new(&env, "opened")),
            (id, party),
        );
        Ok(())
    }

    pub fn resolve_dispute(
        env: Env,
        id: BytesN<16>,
        party: Address,
        agreed_amount: i128,
    ) -> Result<(), Error> {
        let contract_key = DataKey::Contract(id.clone());
        let mut contract: ContractRecord = env
            .storage()
            .persistent()
            .get(&contract_key)
            .ok_or(Error::ContractNotFound)?;

        let is_landlord = party == contract.landlord;
        let is_tenant = party == contract.tenant;
        if !is_landlord && !is_tenant {
            return Err(Error::Unauthorized);
        }
        party.require_auth();

        if agreed_amount < 0 || agreed_amount > contract.deposit_amount {
            return Err(Error::InvalidAmount);
        }

        if contract.dispute_status != DisputeStatus::InProgress
            && contract.dispute_status != DisputeStatus::AwaitingConfirmation
        {
            return Err(Error::InvalidTransition);
        }

        let other_party = if is_landlord {
            contract.tenant.clone()
        } else {
            contract.landlord.clone()
        };

        let other_key = DataKey::DisputeAgreed(id.clone(), other_party.clone());
        let other_agreed: Option<i128> = env.storage().persistent().get(&other_key);

        let my_key = DataKey::DisputeAgreed(id.clone(), party.clone());
        env.storage().persistent().set(&my_key, &agreed_amount);
        extend_persistent_ttl(&env, &my_key);

        if let Some(other_amount) = other_agreed {
            if other_amount != agreed_amount {
                // Amounts mismatch: clear both agreed amounts, set dispute back to InProgress, emit mismatch event, and return Ok
                env.storage().persistent().remove(&other_key);
                env.storage().persistent().remove(&my_key);
                contract.dispute_status = DisputeStatus::InProgress;

                env.storage().persistent().set(&contract_key, &contract);
                extend_persistent_ttl(&env, &contract_key);
                extend_instance_ttl(&env);

                env.events().publish(
                    (Symbol::new(&env, "dispute"), Symbol::new(&env, "amount_mismatch")),
                    (id, agreed_amount, other_amount),
                );
                return Ok(());
            }

            let deducted = contract
                .deposit_amount
                .checked_sub(agreed_amount)
                .ok_or(Error::Overflow)?;

            contract.dispute_status = DisputeStatus::Resolved;
            contract.refund_amount = agreed_amount;
            contract.deducted_amount = deducted;

            if agreed_amount == contract.deposit_amount {
                contract.deposit_status = DepositStatus::Refunded;
            } else {
                contract.deposit_status = DepositStatus::Deducted;
            }
            contract.status = ContractStatus::Ended;

            env.storage().persistent().remove(&other_key);
            env.storage().persistent().remove(&my_key);

            env.storage().persistent().set(&contract_key, &contract);
            extend_persistent_ttl(&env, &contract_key);
            extend_instance_ttl(&env);

            env.events().publish(
                (Symbol::new(&env, "release_authorized"),),
                (id.clone(), agreed_amount, deducted),
            );
            env.events().publish(
                (Symbol::new(&env, "dispute"), Symbol::new(&env, "resolved")),
                (id, agreed_amount),
            );
        } else {
            contract.dispute_status = DisputeStatus::AwaitingConfirmation;
            env.storage().persistent().set(&contract_key, &contract);
            extend_persistent_ttl(&env, &contract_key);
            extend_instance_ttl(&env);

            env.events().publish(
                (Symbol::new(&env, "dispute"), Symbol::new(&env, "awaiting_confirmation")),
                (id, party, agreed_amount),
            );
        }

        Ok(())
    }

    pub fn get_contract(env: Env, id: BytesN<16>) -> Result<ContractRecord, Error> {
        let contract_key = DataKey::Contract(id);
        let contract = env
            .storage()
            .persistent()
            .get(&contract_key)
            .ok_or(Error::ContractNotFound)?;
        extend_persistent_ttl(&env, &contract_key);
        Ok(contract)
    }

    pub fn get_rent_period(env: Env, id: BytesN<16>, period: u32) -> Result<RentPeriodRecord, Error> {
        if period < 1 {
            return Err(Error::PeriodNotFound);
        }
        let period_key = DataKey::RentPeriod(id, period);
        let period_rec = env
            .storage()
            .persistent()
            .get(&period_key)
            .ok_or(Error::PeriodNotFound)?;
        extend_persistent_ttl(&env, &period_key);
        Ok(period_rec)
    }
}
