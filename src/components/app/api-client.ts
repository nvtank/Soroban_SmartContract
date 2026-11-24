import type {
  ContractDetailDto,
  ContractSummaryDto,
  NotificationDto,
  OnchainTxDto,
  PaymentDto,
} from "@/domain/dto";
import { mockService, type PendingRecovery } from "./mock/mock-service";
import { getPublicOnchainTxsAction } from "@/app/(app)/bang-chung/actions";
import { getNotificationsAction, markNotificationReadAction } from "./notification-actions";
import { getPendingRecoveriesAction, approveRecoveryAction } from "./recovery-actions";

export function isMockEnabled(): boolean {
  return process.env.NEXT_PUBLIC_UI_MOCK === "true";
}

class ApiClient {
  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) {
      const message = json.error?.message || `Lỗi API (${res.status}): ${res.statusText}`;
      throw new Error(message);
    }
    return json.data as T;
  }

  // Contracts
  async getContracts(role: "LANDLORD" | "TENANT" = "LANDLORD"): Promise<ContractSummaryDto[]> {
    if (isMockEnabled()) {
      return mockService.getContracts(role);
    }
    return await this.request<ContractSummaryDto[]>("/api/contracts");
  }

  async getContractById(id: string, role: "LANDLORD" | "TENANT" = "LANDLORD"): Promise<ContractDetailDto> {
    if (isMockEnabled()) {
      const found = mockService.getContractById(id, role);
      if (!found) throw new Error("Không tìm thấy hợp đồng");
      return found;
    }
    return await this.request<ContractDetailDto>(`/api/contracts/${id}`);
  }

  async createContract(data: {
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
  }): Promise<ContractDetailDto> {
    if (isMockEnabled()) {
      return mockService.createContract(data);
    }
    return await this.request<ContractDetailDto>("/api/contracts", {
      method: "POST",
      body: JSON.stringify({
        roomLabel: data.roomLabel,
        rentAmount: data.rentAmount,
        depositAmount: data.depositAmount,
        startDate: data.startDate,
        endDate: data.endDate,
        dueDay: data.dueDay,
        lateFeeBpsPerDay: data.lateFeeBpsPerDay,
        termsText: data.termsText,
        tenantPhoneInvited: data.tenantPhone,
      }),
    });
  }

  async confirmContract(id: string, stepUpToken?: string): Promise<ContractDetailDto> {
    if (isMockEnabled()) {
      return mockService.confirmContract(id, "TENANT");
    }
    return await this.request<ContractDetailDto>(`/api/contracts/${id}/confirm`, {
      method: "POST",
      headers: stepUpToken ? { "x-step-up-token": stepUpToken } : {},
    });
  }

  // Payments
  async createDepositPayment(contractId: string, provider: "PAYOS" | "SIMULATED" = "SIMULATED"): Promise<PaymentDto> {
    if (isMockEnabled()) {
      return mockService.createPayment(contractId, "DEPOSIT");
    }
    return await this.request<PaymentDto>(`/api/contracts/${contractId}/deposit/pay`, {
      method: "POST",
      body: JSON.stringify({ provider }),
    });
  }

  async createRentPayment(
    contractId: string,
    periodNo: number,
    provider: "PAYOS" | "SIMULATED" = "SIMULATED",
  ): Promise<PaymentDto> {
    if (isMockEnabled()) {
      return mockService.createPayment(contractId, "RENT", periodNo);
    }
    return await this.request<PaymentDto>(`/api/contracts/${contractId}/rent/${periodNo}/pay`, {
      method: "POST",
      body: JSON.stringify({ provider }),
    });
  }

  async getPaymentById(paymentId: string): Promise<PaymentDto> {
    if (isMockEnabled()) {
      return mockService.getPaymentById(paymentId) as PaymentDto;
    }
    return await this.request<PaymentDto>(`/api/payments/${paymentId}`);
  }

  async recheckPayment(paymentId: string): Promise<PaymentDto> {
    if (isMockEnabled()) {
      return mockService.getPaymentById(paymentId) as PaymentDto;
    }
    return await this.request<PaymentDto>(`/api/payments/${paymentId}/recheck`, {
      method: "POST",
    });
  }

  async simulatePayment(
    paymentId: string,
    outcome: "CONFIRMED" | "UNDERPAID" | "OVERPAID" | "FAILED",
  ): Promise<{ payment: PaymentDto; contract: ContractDetailDto }> {
    if (isMockEnabled()) {
      return mockService.simulatePayment(paymentId, outcome);
    }

    if (outcome === "FAILED") {
      const payment = await this.request<PaymentDto>(`/api/payments/${paymentId}/simulate-fail`, {
        method: "POST",
        body: JSON.stringify({ reason: "Giao dịch mô phỏng thất bại hoặc bị hủy" }),
      });
      const contract = await this.getContractById(payment.contractId);
      return { payment, contract };
    }

    const scenario = outcome === "CONFIRMED" ? "FULL" : outcome;
    const payment = await this.request<PaymentDto>(`/api/payments/${paymentId}/simulate-confirm`, {
      method: "POST",
      body: JSON.stringify({ scenario }),
    });
    const contract = await this.getContractById(payment.contractId);
    return { payment, contract };
  }

  // Settlement: Refund & Deductions & Disputes
  async requestRefund(contractId: string): Promise<ContractDetailDto> {
    if (isMockEnabled()) {
      return mockService.handleRefund(contractId, "0", "TENANT");
    }
    return await this.request<ContractDetailDto>(`/api/contracts/${contractId}/refund/request`, {
      method: "POST",
    });
  }

  async approveRefund(contractId: string, amount: string, stepUpToken?: string): Promise<ContractDetailDto> {
    if (isMockEnabled()) {
      return mockService.handleRefund(contractId, amount, "LANDLORD");
    }
    return await this.request<ContractDetailDto>(`/api/contracts/${contractId}/refund/approve`, {
      method: "POST",
      headers: stepUpToken ? { "x-step-up-token": stepUpToken } : {},
      body: JSON.stringify({ refundAmount: amount }),
    });
  }

  async proposeDeduction(contractId: string, amount: string, reasonText: string): Promise<ContractDetailDto> {
    if (isMockEnabled()) {
      return mockService.proposeDeduction(contractId, amount, reasonText);
    }
    await this.request(`/api/contracts/${contractId}/deduction/propose`, {
      method: "POST",
      body: JSON.stringify({ amount, reasonText }),
    });
    return await this.getContractById(contractId);
  }

  async respondDeduction(deductionId: string, accept: boolean, stepUpToken?: string): Promise<ContractDetailDto> {
    if (isMockEnabled()) {
      return mockService.respondDeduction(deductionId, accept);
    }
    return await this.request<ContractDetailDto>(`/api/deductions/${deductionId}/respond`, {
      method: "POST",
      headers: stepUpToken ? { "x-step-up-token": stepUpToken } : {},
      body: JSON.stringify({ accept }),
    });
  }

  async openDispute(contractId: string, note: string): Promise<ContractDetailDto> {
    if (isMockEnabled()) {
      return mockService.openDispute(contractId, note);
    }
    await this.request(`/api/contracts/${contractId}/dispute/open`, {
      method: "POST",
      body: JSON.stringify({ note }),
    });
    return await this.getContractById(contractId);
  }

  async resolveDispute(
    contractId: string,
    agreedAmount: string,
    stepUpToken?: string,
  ): Promise<ContractDetailDto> {
    if (isMockEnabled()) {
      return mockService.resolveDispute(contractId, agreedAmount, "TENANT");
    }
    await this.request(`/api/contracts/${contractId}/dispute/resolve`, {
      method: "POST",
      headers: stepUpToken ? { "x-step-up-token": stepUpToken } : {},
      body: JSON.stringify({ agreedAmount }),
    });
    return await this.getContractById(contractId);
  }

  // Onchain
  async getOnchainTxs(contractId?: string): Promise<OnchainTxDto[]> {
    if (isMockEnabled()) {
      return mockService.getOnchainTxs(contractId);
    }
    if (contractId) {
      return await this.request<OnchainTxDto[]>(`/api/contracts/${contractId}/onchain`);
    }
    return await getPublicOnchainTxsAction();
  }

  async retryOnchainTx(id: string): Promise<OnchainTxDto> {
    if (isMockEnabled()) {
      return mockService.retryOnchainTx(id);
    }
    return await this.request<OnchainTxDto>(`/api/onchain/${id}/retry`, {
      method: "POST",
    });
  }

  // Notifications
  async getNotifications(): Promise<NotificationDto[]> {
    if (isMockEnabled()) {
      return mockService.getNotifications();
    }
    return await getNotificationsAction();
  }

  async markNotificationRead(id: string): Promise<void> {
    if (isMockEnabled()) {
      mockService.markNotificationRead(id);
      return;
    }
    await markNotificationReadAction(id);
  }

  // Admin / Demo
  async runOverdueScan(): Promise<{ updatedCount: number }> {
    if (isMockEnabled()) {
      return mockService.runOverdueScan();
    }
    return await this.request<{ updatedCount: number }>("/api/jobs/overdue-scan", {
      method: "POST",
    });
  }

  async flushOnchain(): Promise<{ confirmedCount: number }> {
    if (isMockEnabled()) {
      return mockService.flushOnchain();
    }
    const res = await this.request<{ confirmed: number; failed: number }>("/api/jobs/flush-onchain", {
      method: "POST",
    });
    return { confirmedCount: res.confirmed };
  }

  async seedDemo(): Promise<void> {
    if (isMockEnabled()) {
      mockService.seedDemo();
      return;
    }
    await this.request("/api/demo/seed", { method: "POST" });
  }

  async resetDemo(): Promise<void> {
    if (isMockEnabled()) {
      mockService.resetDemo();
      return;
    }
    await this.request("/api/demo/reset", { method: "POST" });
  }

  getPaymentMode(): "payos" | "simulated" | "both" {
    return mockService.getPaymentMode();
  }

  setPaymentMode(mode: "payos" | "simulated" | "both"): void {
    mockService.setPaymentMode(mode);
  }

  // Recovery
  async submitRecovery(phone: string, note?: string): Promise<PendingRecovery> {
    if (isMockEnabled()) {
      return mockService.submitRecovery(phone);
    }
    const res = await this.request<{ requestId: string; status: string }>("/api/recovery/request", {
      method: "POST",
      body: JSON.stringify({ phone, note }),
    });
    return {
      id: res.requestId,
      phone,
      status: res.status as "PENDING" | "APPROVED",
      createdAt: new Date().toISOString(),
    };
  }

  async getPendingRecoveries(): Promise<PendingRecovery[]> {
    if (isMockEnabled()) {
      return mockService.getPendingRecoveries();
    }
    return await getPendingRecoveriesAction();
  }

  async approveRecovery(id: string): Promise<void> {
    if (isMockEnabled()) {
      mockService.approveRecovery(id);
      return;
    }
    await approveRecoveryAction(id);
  }
}

export const apiClient = new ApiClient();
