use soroban_sdk::{contracttype, Address, BytesN};
use crate::types::{ContractStatus, DepositStatus, DisputeStatus, RentStatus};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContractRecord {
    pub id: BytesN<16>,
    pub landlord: Address,
    pub tenant: Address,
    pub doc_hash: BytesN<32>,
    pub deposit_amount: i128,
    pub rent_amount: i128,
    pub due_day: u32,
    pub late_fee_bps_per_day: u32,
    pub status: ContractStatus,
    pub deposit_status: DepositStatus,
    pub dispute_status: DisputeStatus,
    pub deposit_paid_amount: i128,
    pub refund_amount: i128,
    pub deducted_amount: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RentPeriodRecord {
    pub contract_id: BytesN<16>,
    pub period_no: u32,
    pub amount_due: i128,
    pub amount_paid: i128,
    pub late_days: u32,
    pub late_fee: i128,
    pub status: RentStatus,
    pub due_date_ts: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DeductionProposal {
    pub amount: i128,
    pub reason_hash: BytesN<32>,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Oracle,
    Contract(BytesN<16>),
    RentPeriod(BytesN<16>, u32),
    RefundApproval(BytesN<16>, Address),
    DeductionProposal(BytesN<16>),
    DisputeAgreed(BytesN<16>, Address),
    PaymentRef(BytesN<16>, BytesN<32>),
}
