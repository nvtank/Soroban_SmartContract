//! Must match src/domain/states.ts 1-1: discriminant = index in the TS array.
//! tests/unit/states-sync.test.ts fails when the two files drift apart.

use soroban_sdk::{contracterror, contracttype};

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum ContractStatus {
    PendingConfirmation = 0,
    Active = 1,
    Ended = 2,
    Cancelled = 3,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum DepositStatus {
    Unpaid = 0,
    Recorded = 1,
    PendingRefund = 2,
    PendingDispute = 3,
    Refunded = 4,
    Deducted = 5,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum RentStatus {
    NotDue = 0,
    AwaitingPayment = 1,
    Paid = 2,
    Overdue = 3,
    PartiallyPaid = 4,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum DisputeStatus {
    None = 0,
    AwaitingConfirmation = 1,
    InProgress = 2,
    Resolved = 3,
}

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    ContractExists = 4,
    ContractNotFound = 5,
    PeriodNotFound = 6,
    InvalidTransition = 7,
    InvalidAmount = 8,
    DepositMismatch = 9,
    DeductionExceedsDeposit = 10,
    DeductionNotFound = 11,
    RefundAmountMismatch = 12,
    DisputeActive = 13,
    DisputeAmountMismatch = 14,
    InvalidDueDay = 15,
    Overflow = 16,
    DuplicatePaymentRef = 17,
    SamePartyNotAllowed = 18,
}
