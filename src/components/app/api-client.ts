import type {
  ContractDetailDto,
  ContractSummaryDto,
  NotificationDto,
  OnchainTxDto,
  PaymentDto,
} from "@/domain/dto";
import { mockService, type PendingRecovery } from "./mock/mock-service";

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

    const json = await res.json();
    if (!res.ok || json.error) {
      const message = json.error?.message || "Lỗi yêu cầu API";
      throw new Error(message);
    }
    return json.data as T;
  }

  // Contracts
  async getContracts(role: "LANDLORD" | "TENANT" = "LANDLORD"): Promise<ContractSummaryDto[]> {
    if (isMockEnabled()) {
      return mockService.getContracts(role);
    }
    try {
      return await this.request<ContractSummaryDto[]>("/api/contracts");
    } catch {
      // Fallback to mock service if API endpoint is not yet mounted on this branch
      return mockService.getContracts(role);
    }
  }

  async getContractById(id: string, role: "LANDLORD" | "TENANT" = "LANDLORD"): Promise<ContractDetailDto> {
    if (isMockEnabled()) {
      const found = mockService.getContractById(id, role);
      if (!found) throw new Error("Không tìm thấy hợp đồng");
      return found;
    }
    try {
      return await this.request<ContractDetailDto>(`/api/contracts/${id}`);
    } catch {
      const found = mockService.getContractById(id, role);
      if (!found) throw new Error("Không tìm thấy hợp đồng");
      return found;
    }
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
    try {
      return await this.request<ContractDetailDto>("/api/contracts", {
        method: "POST",
        body: JSON.stringify(data),
      });
    } catch {
      return mockService.createContract(data);
    }
  }

  async confirmContract(id: string, role: "LANDLORD" | "TENANT" = "TENANT"): Promise<ContractDetailDto> {
    if (isMockEnabled()) {
      return mockService.confirmContract(id, role);
    }
    try {
      return await this.request<ContractDetailDto>(`/api/contracts/${id}/confirm`, {
        method: "POST",
      });
    } catch {
      return mockService.confirmContract(id, role);
    }
  }

  // Payments
  async createDepositPayment(contractId: string): Promise<PaymentDto> {
    if (isMockEnabled()) {
      return mockService.createPayment(contractId, "DEPOSIT");
    }
    try {
      return await this.request<PaymentDto>(`/api/contracts/${contractId}/deposit/pay`, {
        method: "POST",
      });
    } catch {
      return mockService.createPayment(contractId, "DEPOSIT");
    }
  }

  async createRentPayment(contractId: string, periodNo: number): Promise<PaymentDto> {
    if (isMockEnabled()) {
      return mockService.createPayment(contractId, "RENT", periodNo);
    }
    try {
      return await this.request<PaymentDto>(`/api/contracts/${contractId}/rent/${periodNo}/pay`, {
        method: "POST",
      });
    } catch {
      return mockService.createPayment(contractId, "RENT", periodNo);
    }
  }

  async simulatePayment(
    paymentId: string,
    outcome: "CONFIRMED" | "UNDERPAID" | "OVERPAID" | "FAILED",
  ): Promise<{ payment: PaymentDto; contract: ContractDetailDto }> {
    if (isMockEnabled()) {
      return mockService.simulatePayment(paymentId, outcome);
    }
    try {
      const endpoint =
        outcome === "CONFIRMED"
          ? `/api/payments/${paymentId}/simulate-confirm`
          : `/api/payments/${paymentId}/simulate-fail`;
      return await this.request<{ payment: PaymentDto; contract: ContractDetailDto }>(endpoint, {
        method: "POST",
        body: JSON.stringify({ outcome }),
      });
    } catch {
      return mockService.simulatePayment(paymentId, outcome);
    }
  }

  // Settlement: Refund & Deductions & Disputes
  async requestRefund(contractId: string, amount: string, role: "LANDLORD" | "TENANT"): Promise<ContractDetailDto> {
    if (isMockEnabled()) {
      return mockService.handleRefund(contractId, amount, role);
    }
    try {
      return await this.request<ContractDetailDto>(`/api/contracts/${contractId}/refund/request`, {
        method: "POST",
        body: JSON.stringify({ amount }),
      });
    } catch {
      return mockService.handleRefund(contractId, amount, role);
    }
  }

  async approveRefund(contractId: string, amount: string, role: "LANDLORD" | "TENANT"): Promise<ContractDetailDto> {
    if (isMockEnabled()) {
      return mockService.handleRefund(contractId, amount, role);
    }
    try {
      return await this.request<ContractDetailDto>(`/api/contracts/${contractId}/refund/approve`, {
        method: "POST",
        body: JSON.stringify({ amount }),
      });
    } catch {
      return mockService.handleRefund(contractId, amount, role);
    }
  }

  async proposeDeduction(contractId: string, amount: string, reasonText: string): Promise<ContractDetailDto> {
    if (isMockEnabled()) {
      return mockService.proposeDeduction(contractId, amount, reasonText);
    }
    try {
      return await this.request<ContractDetailDto>(`/api/contracts/${contractId}/deduction/propose`, {
        method: "POST",
        body: JSON.stringify({ amount, reasonText }),
      });
    } catch {
      return mockService.proposeDeduction(contractId, amount, reasonText);
    }
  }

  async respondDeduction(deductionId: string, accept: boolean): Promise<ContractDetailDto> {
    if (isMockEnabled()) {
      return mockService.respondDeduction(deductionId, accept);
    }
    try {
      return await this.request<ContractDetailDto>(`/api/deductions/${deductionId}/respond`, {
        method: "POST",
        body: JSON.stringify({ accept }),
      });
    } catch {
      return mockService.respondDeduction(deductionId, accept);
    }
  }

  async openDispute(contractId: string, note: string): Promise<ContractDetailDto> {
    if (isMockEnabled()) {
      return mockService.openDispute(contractId, note);
    }
    try {
      return await this.request<ContractDetailDto>(`/api/contracts/${contractId}/dispute/open`, {
        method: "POST",
        body: JSON.stringify({ note }),
      });
    } catch {
      return mockService.openDispute(contractId, note);
    }
  }

  async resolveDispute(
    contractId: string,
    agreedAmount: string,
    role: "LANDLORD" | "TENANT",
  ): Promise<ContractDetailDto> {
    if (isMockEnabled()) {
      return mockService.resolveDispute(contractId, agreedAmount, role);
    }
    try {
      return await this.request<ContractDetailDto>(`/api/contracts/${contractId}/dispute/resolve`, {
        method: "POST",
        body: JSON.stringify({ agreedAmount }),
      });
    } catch {
      return mockService.resolveDispute(contractId, agreedAmount, role);
    }
  }

  // Onchain
  async getOnchainTxs(contractId?: string): Promise<OnchainTxDto[]> {
    if (isMockEnabled()) {
      return mockService.getOnchainTxs(contractId);
    }
    try {
      const endpoint = contractId ? `/api/contracts/${contractId}/onchain` : "/api/contracts/onchain";
      return await this.request<OnchainTxDto[]>(endpoint);
    } catch {
      return mockService.getOnchainTxs(contractId);
    }
  }

  async retryOnchainTx(id: string): Promise<OnchainTxDto> {
    if (isMockEnabled()) {
      return mockService.retryOnchainTx(id);
    }
    try {
      return await this.request<OnchainTxDto>(`/api/onchain/${id}/retry`, {
        method: "POST",
      });
    } catch {
      return mockService.retryOnchainTx(id);
    }
  }

  // Notifications
  async getNotifications(): Promise<NotificationDto[]> {
    if (isMockEnabled()) {
      return mockService.getNotifications();
    }
    try {
      return await this.request<NotificationDto[]>("/api/notifications");
    } catch {
      return mockService.getNotifications();
    }
  }

  async markNotificationRead(id: string): Promise<void> {
    if (isMockEnabled()) {
      mockService.markNotificationRead(id);
      return;
    }
    try {
      await this.request(`/api/notifications/${id}/read`, { method: "POST" });
    } catch {
      mockService.markNotificationRead(id);
    }
  }

  // Admin / Demo
  async runOverdueScan(): Promise<{ updatedCount: number }> {
    if (isMockEnabled()) {
      return mockService.runOverdueScan();
    }
    try {
      return await this.request<{ updatedCount: number }>("/api/jobs/overdue-scan", { method: "POST" });
    } catch {
      return mockService.runOverdueScan();
    }
  }

  async flushOnchain(): Promise<{ confirmedCount: number }> {
    if (isMockEnabled()) {
      return mockService.flushOnchain();
    }
    try {
      return await this.request<{ confirmedCount: number }>("/api/jobs/flush-onchain", { method: "POST" });
    } catch {
      return mockService.flushOnchain();
    }
  }

  async seedDemo(): Promise<void> {
    if (isMockEnabled()) {
      mockService.seedDemo();
      return;
    }
    try {
      await this.request("/api/demo/seed", { method: "POST" });
    } catch {
      mockService.seedDemo();
    }
  }

  async resetDemo(): Promise<void> {
    if (isMockEnabled()) {
      mockService.resetDemo();
      return;
    }
    try {
      await this.request("/api/demo/reset", { method: "POST" });
    } catch {
      mockService.resetDemo();
    }
  }

  getPaymentMode(): "payos" | "simulated" | "both" {
    return mockService.getPaymentMode();
  }

  setPaymentMode(mode: "payos" | "simulated" | "both"): void {
    mockService.setPaymentMode(mode);
  }

  // Recovery
  async submitRecovery(phone: string): Promise<PendingRecovery> {
    return mockService.submitRecovery(phone);
  }

  async getPendingRecoveries(): Promise<PendingRecovery[]> {
    return mockService.getPendingRecoveries();
  }

  async approveRecovery(id: string): Promise<void> {
    mockService.approveRecovery(id);
  }
}

export const apiClient = new ApiClient();
