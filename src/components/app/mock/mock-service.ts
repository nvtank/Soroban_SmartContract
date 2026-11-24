import type {
  ContractDetailDto,
  ContractSummaryDto,
  NotificationDto,
  OnchainTxDto,
  PaymentDto,
  ChargeDto,
} from "@/domain/dto";
import {
  DEMO_USERS,
  INITIAL_CONTRACTS,
  INITIAL_NOTIFICATIONS,
  INITIAL_ONCHAIN_TXS,
} from "./mock-data";

export interface PendingRecovery {
  id: string;
  phone: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
}

class MockService {
  private contracts: ContractDetailDto[] = [];
  private onchainTxs: OnchainTxDto[] = [];
  private payments: PaymentDto[] = [];
  private notifications: NotificationDto[] = [];
  private recoveries: PendingRecovery[] = [];
  private paymentMode: "payos" | "simulated" | "both" = "both";
  private initialized = false;

  constructor() {
    this.init();
  }

  private init() {
    if (this.initialized) return;
    if (typeof window !== "undefined") {
      try {
        const savedContracts = localStorage.getItem("rentflow_mock_contracts");
        const savedTxs = localStorage.getItem("rentflow_mock_txs");
        const savedNotifs = localStorage.getItem("rentflow_mock_notifs");
        const savedRecoveries = localStorage.getItem("rentflow_mock_recoveries");

        if (savedContracts) this.contracts = JSON.parse(savedContracts);
        else this.contracts = JSON.parse(JSON.stringify(INITIAL_CONTRACTS));

        if (savedTxs) this.onchainTxs = JSON.parse(savedTxs);
        else this.onchainTxs = JSON.parse(JSON.stringify(INITIAL_ONCHAIN_TXS));

        if (savedNotifs) this.notifications = JSON.parse(savedNotifs);
        else this.notifications = JSON.parse(JSON.stringify(INITIAL_NOTIFICATIONS));

        if (savedRecoveries) this.recoveries = JSON.parse(savedRecoveries);
        else this.recoveries = [];

        this.initialized = true;
        return;
      } catch (err) {
        console.warn("[MockService] LocalStorage load failed, using memory state", err);
      }
    }

    this.contracts = JSON.parse(JSON.stringify(INITIAL_CONTRACTS));
    this.onchainTxs = JSON.parse(JSON.stringify(INITIAL_ONCHAIN_TXS));
    this.notifications = JSON.parse(JSON.stringify(INITIAL_NOTIFICATIONS));
    this.recoveries = [];
    this.initialized = true;
  }

  private persist() {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("rentflow_mock_contracts", JSON.stringify(this.contracts));
        localStorage.setItem("rentflow_mock_txs", JSON.stringify(this.onchainTxs));
        localStorage.setItem("rentflow_mock_notifs", JSON.stringify(this.notifications));
        localStorage.setItem("rentflow_mock_recoveries", JSON.stringify(this.recoveries));
      } catch (err) {
        console.warn("[MockService] LocalStorage save failed", err);
      }
    }
  }

  public resetDemo(): void {
    this.contracts = JSON.parse(JSON.stringify(INITIAL_CONTRACTS));
    this.onchainTxs = JSON.parse(JSON.stringify(INITIAL_ONCHAIN_TXS));
    this.notifications = JSON.parse(JSON.stringify(INITIAL_NOTIFICATIONS));
    this.recoveries = [];
    this.persist();
  }

  public seedDemo(): void {
    this.resetDemo();
  }

  public getContracts(role: "LANDLORD" | "TENANT"): ContractSummaryDto[] {
    this.init();
    return this.contracts.map((c) => ({
      id: c.id,
      roomLabel: c.roomLabel,
      landlordName: c.landlordName,
      tenantName: c.tenantName,
      rentAmount: c.rentAmount,
      depositAmount: c.depositAmount,
      startDate: c.startDate,
      endDate: c.endDate,
      dueDay: c.dueDay,
      status: c.status,
      depositStatus: c.depositStatus,
      disputeStatus: c.disputeStatus,
      journeyStep: c.journeyStep,
      myRole: role,
    }));
  }

  public getContractById(id: string, role: "LANDLORD" | "TENANT" = "LANDLORD"): ContractDetailDto | null {
    this.init();
    const contract = this.contracts.find((c) => c.id === id);
    if (!contract) return null;
    return {
      ...contract,
      myRole: role,
    };
  }

  public createContract(data: {
    roomLabel: string;
    rentAmount: string;
    depositAmount: string;
    startDate: string;
    endDate: string;
    dueDay: number;
    lateFeeBpsPerDay: number;
    tenantPhone: string;
    tenantName?: string;
    termsText: string;
  }): ContractDetailDto {
    this.init();
    const newId = `ct-${Date.now().toString().slice(-4)}`;
    const docHash = `mock_doc_hash_${Math.random().toString(16).slice(2, 10)}${Math.random().toString(16).slice(2, 10)}`;

    const newContract: ContractDetailDto = {
      id: newId,
      roomLabel: data.roomLabel,
      landlordName: DEMO_USERS.landlord.fullName,
      tenantName: data.tenantName || "Trần Thị Bình",
      rentAmount: data.rentAmount,
      depositAmount: data.depositAmount,
      startDate: data.startDate,
      endDate: data.endDate,
      dueDay: data.dueDay,
      status: "PENDING_CONFIRMATION",
      depositStatus: "UNPAID",
      disputeStatus: "NONE",
      journeyStep: "SIGN",
      myRole: "LANDLORD",
      lateFeeBpsPerDay: data.lateFeeBpsPerDay,
      termsText: data.termsText,
      docHash: docHash,
      deposit: {
        status: "UNPAID",
        paidAmount: "0",
        refundAmount: "0",
        deductedAmount: "0",
        landlordRefundAmount: null,
        tenantRefundAmount: null,
      },
      rentPeriods: [
        {
          periodNo: 1,
          dueDate: `${data.startDate.slice(0, 7)}-${String(data.dueDay).padStart(2, "0")}`,
          amountDue: data.rentAmount,
          amountPaid: "0",
          lateDays: 0,
          lateFee: "0",
          status: "NOT_DUE",
        },
      ],
      deductions: [],
      dispute: null,
      charges: [],
    };

    this.contracts.unshift(newContract);

    // Record onchain tx
    const txId = `tx-mock-${Date.now()}`;
    const txHash = `mock_testnet_tx_create_contract_${newId}_${Math.random().toString(16).slice(2, 8)}`;
    this.onchainTxs.unshift({
      id: txId,
      contractId: newId,
      action: "create_contract",
      payloadHash: docHash,
      status: "CONFIRMED",
      txHash,
      explorerUrl: null,
      error: null,
      retryCount: 0,
      createdAt: new Date().toISOString(),
    });

    this.notifications.unshift({
      id: `notif-${Date.now()}`,
      type: "CONTRACT_CREATED",
      title: "Hợp đồng mới đã tạo thành công",
      body: `Hợp đồng cho '${data.roomLabel}' đã được tạo và gửi cho người thuê ký xác nhận.`,
      readAt: null,
      createdAt: new Date().toISOString(),
    });

    this.persist();
    return newContract;
  }

  public confirmContract(id: string, role: "LANDLORD" | "TENANT" = "TENANT"): ContractDetailDto {
    this.init();
    const contract = this.contracts.find((c) => c.id === id);
    if (!contract) throw new Error("Contract not found");

    contract.status = "ACTIVE";
    contract.journeyStep = "DEPOSIT";
    contract.myRole = role;

    const txId = `tx-mock-${Date.now()}`;
    const txHash = `mock_testnet_tx_tenant_confirm_${id}_${Math.random().toString(16).slice(2, 8)}`;
    this.onchainTxs.unshift({
      id: txId,
      contractId: id,
      action: "tenant_confirm",
      payloadHash: `mock_auth_hash_tenant_confirm_${id}`,
      status: "CONFIRMED",
      txHash,
      explorerUrl: null,
      error: null,
      retryCount: 0,
      createdAt: new Date().toISOString(),
    });

    this.persist();
    return contract;
  }

  public createCharge(
    contractId: string,
    data: {
      kind: "ELECTRICITY" | "WATER" | "SERVICE" | "OTHER";
      amount: string;
      note?: string;
      periodNo?: number;
    },
  ): ChargeDto {
    this.init();
    const contract = this.contracts.find((c) => c.id === contractId);
    if (!contract) throw new Error("Không tìm thấy hợp đồng");
    if (!contract.charges) contract.charges = [];

    const newCharge: ChargeDto = {
      id: `chg-${Date.now()}`,
      periodNo: data.periodNo ?? null,
      kind: data.kind,
      amount: data.amount,
      note: data.note || null,
      status: "UNPAID",
      createdAt: new Date().toISOString(),
      paidAt: null,
    };
    contract.charges.unshift(newCharge);
    this.persist();
    return newCharge;
  }

  public markChargePaid(contractId: string, chargeId: string): ChargeDto {
    this.init();
    const contract = this.contracts.find((c) => c.id === contractId);
    if (!contract) throw new Error("Không tìm thấy hợp đồng");
    if (!contract.charges) contract.charges = [];

    const charge = contract.charges.find((ch) => ch.id === chargeId);
    if (!charge) throw new Error("Không tìm thấy khoản phát sinh");

    charge.status = "PAID";
    charge.paidAt = new Date().toISOString();
    this.persist();
    return charge;
  }

  public createPayment(
    contractId: string,
    kind: "DEPOSIT" | "RENT",
    periodNo?: number,
  ): PaymentDto {
    this.init();
    const contract = this.contracts.find((c) => c.id === contractId);
    if (!contract) throw new Error("Contract not found");

    const businessAmount = kind === "DEPOSIT" ? contract.depositAmount : contract.rentAmount;
    // Demo payment amount is scaled down for Ideathon testing
    const expectedAmount = "10000";

    const payment: PaymentDto = {
      id: `pay-${Date.now()}`,
      contractId,
      kind,
      periodNo: periodNo ?? null,
      businessAmount,
      expectedAmount,
      paidAmount: "0",
      provider: "PAYOS",
      status: "PENDING",
      isSimulated: true,
      qrData: `00020101021238540010A0000007270124mock_vietqr_rentflow_${contractId}_${Date.now()}53037045405100005802VN62240820Thanh toan RentFlow6304`,
      checkoutUrl: `https://payos.demo/checkout/mock-${contractId}`,
    };

    this.payments.push(payment);
    return payment;
  }

  public getPaymentById(paymentId: string): PaymentDto | undefined {
    this.init();
    return this.payments.find((p) => p.id === paymentId);
  }

  public simulatePayment(
    paymentId: string,
    outcome: "CONFIRMED" | "UNDERPAID" | "OVERPAID" | "FAILED",
  ): { payment: PaymentDto; contract: ContractDetailDto } {
    this.init();
    const payment = this.payments.find((p) => p.id === paymentId);
    if (!payment) throw new Error("Payment not found");

    const contract = this.contracts.find((c) => c.id === payment.contractId);
    if (!contract) throw new Error("Contract not found");

    payment.status = outcome;

    if (outcome === "CONFIRMED") {
      payment.paidAmount = payment.expectedAmount;

      if (payment.kind === "DEPOSIT") {
        contract.depositStatus = "RECORDED";
        contract.deposit.status = "RECORDED";
        contract.deposit.paidAmount = contract.depositAmount;
        contract.journeyStep = "RENT";

        // Generate onchain tx
        const txHash = `mock_testnet_tx_deposit_paid_${contract.id}_${Math.random().toString(16).slice(2, 8)}`;
        this.onchainTxs.unshift({
          id: `tx-mock-${Date.now()}`,
          contractId: contract.id,
          action: "record_deposit_paid",
          payloadHash: `mock_payment_ref_deposit_${payment.id}`,
          status: "CONFIRMED",
          txHash,
          explorerUrl: null,
          error: null,
          retryCount: 0,
          createdAt: new Date().toISOString(),
        });
      } else if (payment.kind === "RENT" && payment.periodNo) {
        const period = contract.rentPeriods.find((p) => p.periodNo === payment.periodNo);
        if (period) {
          period.amountPaid = period.amountDue;
          period.status = "PAID";
          period.lateDays = 0;
          period.lateFee = "0";

          const txHash = `mock_testnet_tx_rent_paid_p${payment.periodNo}_${contract.id}_${Math.random().toString(16).slice(2, 8)}`;
          this.onchainTxs.unshift({
            id: `tx-mock-${Date.now()}`,
            contractId: contract.id,
            action: "record_rent_paid",
            payloadHash: `mock_payment_ref_rent_p${payment.periodNo}_${payment.id}`,
            status: "CONFIRMED",
            txHash,
            explorerUrl: null,
            error: null,
            retryCount: 0,
            createdAt: new Date().toISOString(),
          });
        }
      }
    } else if (outcome === "UNDERPAID") {
      payment.paidAmount = "5000"; // Nộp thiếu 50%
      if (payment.kind === "RENT" && payment.periodNo) {
        const period = contract.rentPeriods.find((p) => p.periodNo === payment.periodNo);
        if (period) {
          period.amountPaid = "2500000";
          period.status = "PARTIALLY_PAID";
        }
      }
    } else if (outcome === "OVERPAID") {
      payment.paidAmount = "15000"; // Nộp thừa
    }

    this.persist();
    return { payment, contract };
  }

  public proposeDeduction(contractId: string, amount: string, reasonText: string): ContractDetailDto {
    this.init();
    const contract = this.contracts.find((c) => c.id === contractId);
    if (!contract) throw new Error("Contract not found");

    const newDed = {
      id: `ded-${Date.now()}`,
      amount,
      reasonText,
      status: "PROPOSED" as const,
      createdAt: new Date().toISOString(),
    };
    contract.deductions.unshift(newDed);

    const txHash = `mock_testnet_tx_propose_deduction_${contractId}_${Math.random().toString(16).slice(2, 8)}`;
    this.onchainTxs.unshift({
      id: `tx-mock-${Date.now()}`,
      contractId,
      action: "propose_deduction",
      payloadHash: `mock_reason_hash_${newDed.id}`,
      status: "CONFIRMED",
      txHash,
      explorerUrl: null,
      error: null,
      retryCount: 0,
      createdAt: new Date().toISOString(),
    });

    this.persist();
    return contract;
  }

  public respondDeduction(deductionId: string, accept: boolean): ContractDetailDto {
    this.init();
    let targetContract: ContractDetailDto | null = null;
    let targetDed: { id: string; amount: string; status: "PROPOSED" | "ACCEPTED" | "REJECTED" } | null = null;

    for (const c of this.contracts) {
      const d = c.deductions.find((item) => item.id === deductionId);
      if (d) {
        targetContract = c;
        targetDed = d;
        break;
      }
    }

    if (!targetContract || !targetDed) throw new Error("Deduction not found");

    if (accept) {
      targetDed.status = "ACCEPTED";
      targetContract.depositStatus = "DEDUCTED";
      targetContract.deposit.status = "DEDUCTED";
      targetContract.deposit.deductedAmount = targetDed.amount;
      targetContract.journeyStep = "SETTLE";

      const txHash = `mock_testnet_tx_respond_deduction_accept_${targetContract.id}_${Math.random().toString(16).slice(2, 8)}`;
      this.onchainTxs.unshift({
        id: `tx-mock-${Date.now()}`,
        contractId: targetContract.id,
        action: "respond_deduction",
        payloadHash: `mock_deduction_accept_hash_${deductionId}`,
        status: "CONFIRMED",
        txHash,
        explorerUrl: null,
        error: null,
        retryCount: 0,
        createdAt: new Date().toISOString(),
      });
    } else {
      targetDed.status = "REJECTED";
      targetContract.depositStatus = "PENDING_DISPUTE";
      targetContract.deposit.status = "PENDING_DISPUTE";
      targetContract.disputeStatus = "IN_PROGRESS";
      targetContract.journeyStep = "DISPUTE";
      targetContract.dispute = {
        status: "IN_PROGRESS",
        openedBy: targetContract.tenantName,
        note: `Người thuê từ chối khấu trừ số tiền ${targetDed.amount} ₫.`,
        landlordAgreedAmount: null,
        tenantAgreedAmount: null,
      };

      const txHash = `mock_testnet_tx_open_dispute_${targetContract.id}_${Math.random().toString(16).slice(2, 8)}`;
      this.onchainTxs.unshift({
        id: `tx-mock-${Date.now()}`,
        contractId: targetContract.id,
        action: "open_dispute",
        payloadHash: `mock_dispute_reason_hash_${deductionId}`,
        status: "CONFIRMED",
        txHash,
        explorerUrl: null,
        error: null,
        retryCount: 0,
        createdAt: new Date().toISOString(),
      });
    }

    this.persist();
    return targetContract;
  }

  public openDispute(contractId: string, note: string): ContractDetailDto {
    this.init();
    const contract = this.contracts.find((c) => c.id === contractId);
    if (!contract) throw new Error("Contract not found");

    contract.depositStatus = "PENDING_DISPUTE";
    contract.deposit.status = "PENDING_DISPUTE";
    contract.disputeStatus = "IN_PROGRESS";
    contract.journeyStep = "DISPUTE";
    contract.dispute = {
      status: "IN_PROGRESS",
      openedBy: contract.myRole === "LANDLORD" ? contract.landlordName : contract.tenantName,
      note,
      landlordAgreedAmount: null,
      tenantAgreedAmount: null,
    };

    const txHash = `mock_testnet_tx_open_dispute_${contractId}_${Math.random().toString(16).slice(2, 8)}`;
    this.onchainTxs.unshift({
      id: `tx-mock-${Date.now()}`,
      contractId,
      action: "open_dispute",
      payloadHash: `mock_dispute_note_hash_${Date.now()}`,
      status: "CONFIRMED",
      txHash,
      explorerUrl: null,
      error: null,
      retryCount: 0,
      createdAt: new Date().toISOString(),
    });

    this.persist();
    return contract;
  }

  public resolveDispute(contractId: string, agreedAmount: string, role: "LANDLORD" | "TENANT"): ContractDetailDto {
    this.init();
    const contract = this.contracts.find((c) => c.id === contractId);
    if (!contract) throw new Error("Contract not found");

    if (!contract.dispute) {
      contract.dispute = {
        status: "IN_PROGRESS",
        openedBy: null,
        note: null,
        landlordAgreedAmount: null,
        tenantAgreedAmount: null,
      };
    }

    if (role === "LANDLORD") {
      contract.dispute.landlordAgreedAmount = agreedAmount;
    } else {
      contract.dispute.tenantAgreedAmount = agreedAmount;
    }

    // Check if both sides match
    if (
      contract.dispute.landlordAgreedAmount &&
      contract.dispute.tenantAgreedAmount &&
      contract.dispute.landlordAgreedAmount === contract.dispute.tenantAgreedAmount
    ) {
      contract.dispute.status = "RESOLVED";
      contract.disputeStatus = "RESOLVED";
      contract.depositStatus = "REFUNDED";
      contract.deposit.status = "REFUNDED";
      contract.deposit.refundAmount = agreedAmount;
      contract.journeyStep = "SETTLE";

      const txHash = `mock_testnet_tx_resolve_dispute_${contractId}_${Math.random().toString(16).slice(2, 8)}`;
      this.onchainTxs.unshift({
        id: `tx-mock-${Date.now()}`,
        contractId,
        action: "resolve_dispute",
        payloadHash: `mock_resolved_amount_hash_${agreedAmount}`,
        status: "CONFIRMED",
        txHash,
        explorerUrl: null,
        error: null,
        retryCount: 0,
        createdAt: new Date().toISOString(),
      });
    } else {
      contract.dispute.status = "AWAITING_CONFIRMATION";
      contract.disputeStatus = "AWAITING_CONFIRMATION";
    }

    this.persist();
    return contract;
  }

  public handleRefund(contractId: string, amount: string, role: "LANDLORD" | "TENANT"): ContractDetailDto {
    this.init();
    const contract = this.contracts.find((c) => c.id === contractId);
    if (!contract) throw new Error("Contract not found");

    contract.depositStatus = "PENDING_REFUND";
    contract.deposit.status = "PENDING_REFUND";

    if (role === "LANDLORD") {
      contract.deposit.landlordRefundAmount = amount;
    } else {
      contract.deposit.tenantRefundAmount = amount;
    }

    if (
      contract.deposit.landlordRefundAmount &&
      contract.deposit.tenantRefundAmount &&
      contract.deposit.landlordRefundAmount === contract.deposit.tenantRefundAmount
    ) {
      contract.depositStatus = "REFUNDED";
      contract.deposit.status = "REFUNDED";
      contract.deposit.refundAmount = amount;
      contract.status = "ENDED";
      contract.journeyStep = "SETTLE";

      const txHash = `mock_testnet_tx_refund_approved_${contractId}_${Math.random().toString(16).slice(2, 8)}`;
      this.onchainTxs.unshift({
        id: `tx-mock-${Date.now()}`,
        contractId,
        action: "approve_refund",
        payloadHash: `mock_refund_hash_${amount}`,
        status: "CONFIRMED",
        txHash,
        explorerUrl: null,
        error: null,
        retryCount: 0,
        createdAt: new Date().toISOString(),
      });
    }

    this.persist();
    return contract;
  }

  public getOnchainTxs(contractId?: string): OnchainTxDto[] {
    this.init();
    if (!contractId) return this.onchainTxs;
    return this.onchainTxs.filter((t) => t.contractId === contractId);
  }

  public retryOnchainTx(id: string): OnchainTxDto {
    this.init();
    const tx = this.onchainTxs.find((t) => t.id === id);
    if (!tx) throw new Error("Transaction not found");

    tx.status = "CONFIRMED";
    tx.retryCount += 1;
    tx.error = null;
    tx.txHash = `mock_testnet_tx_retried_${Math.random().toString(16).slice(2, 8)}`;
    tx.explorerUrl = null;

    this.persist();
    return tx;
  }

  public getNotifications(): NotificationDto[] {
    this.init();
    return this.notifications;
  }

  public markNotificationRead(id: string): void {
    this.init();
    const notif = this.notifications.find((n) => n.id === id);
    if (notif) {
      notif.readAt = new Date().toISOString();
      this.persist();
    }
  }

  public runOverdueScan(): { updatedCount: number } {
    this.init();
    let count = 0;
    for (const c of this.contracts) {
      for (const p of c.rentPeriods) {
        if (p.status === "AWAITING_PAYMENT" || p.status === "NOT_DUE") {
          const due = new Date(p.dueDate);
          const now = new Date();
          if (now > due) {
            const diffDays = Math.max(1, Math.floor((now.getTime() - due.getTime()) / (1000 * 3600 * 24)));
            p.lateDays = diffDays;
            const fee = (BigInt(p.amountDue) * BigInt(c.lateFeeBpsPerDay) * BigInt(diffDays)) / BigInt(10000);
            p.lateFee = fee.toString();
            p.status = "OVERDUE";
            count++;
          }
        }
      }
    }
    this.persist();
    return { updatedCount: count };
  }

  public flushOnchain(): { confirmedCount: number } {
    this.init();
    let count = 0;
    for (const t of this.onchainTxs) {
      if (t.status === "PENDING" || t.status === "SUBMITTED" || t.status === "FAILED") {
        t.status = "CONFIRMED";
        t.error = null;
        if (!t.txHash) {
          t.txHash = `mock_testnet_tx_flushed_${Math.random().toString(16).slice(2, 8)}`;
          t.explorerUrl = null;
        }
        count++;
      }
    }
    this.persist();
    return { confirmedCount: count };
  }

  public getPaymentMode(): "payos" | "simulated" | "both" {
    return this.paymentMode;
  }

  public setPaymentMode(mode: "payos" | "simulated" | "both"): void {
    this.paymentMode = mode;
  }

  public submitRecovery(phone: string): PendingRecovery {
    this.init();
    const rec: PendingRecovery = {
      id: `rec-${Date.now()}`,
      phone,
      status: "PENDING",
      createdAt: new Date().toISOString(),
    };
    this.recoveries.unshift(rec);
    this.persist();
    return rec;
  }

  public getPendingRecoveries(): PendingRecovery[] {
    this.init();
    return this.recoveries;
  }

  public approveRecovery(id: string): void {
    this.init();
    const r = this.recoveries.find((item) => item.id === id);
    if (r) {
      r.status = "APPROVED";
      this.persist();
    }
  }
}

export const mockService = new MockService();
