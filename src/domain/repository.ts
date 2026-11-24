import type {
  AuditLogEntity,
  ContractEntity,
  DeductionEntity,
  DepositEntity,
  DisputeEntity,
  NotificationEntity,
  PaymentEntity,
  ProfileEntity,
  RentPeriodEntity,
} from "./types";

export type OnchainSigner = { kind: "USER"; userId: string } | { kind: "ORACLE" } | { kind: "PLATFORM" };

export type EnqueueOnchainFn = (
  db: unknown,
  payload: {
    contractId: string;
    action: string;
    args: unknown[];
    signer: OnchainSigner;
  },
) => Promise<{ id: string }>;

export type RequireStepUpFn = (
  request: Request,
  userId: string,
  action: "SIGN_CONTRACT" | "APPROVE_REFUND" | "RESPOND_DEDUCTION" | "RESOLVE_DISPUTE",
) => Promise<void>;

export interface DomainRepository {
  contracts: {
    findById(id: string): Promise<ContractEntity | null>;
    listByUserId(userId: string): Promise<ContractEntity[]>;
    create(contract: ContractEntity): Promise<ContractEntity>;
    update(id: string, updates: Partial<ContractEntity>): Promise<ContractEntity>;
  };
  deposits: {
    findByContractId(contractId: string): Promise<DepositEntity | null>;
    create(deposit: DepositEntity): Promise<DepositEntity>;
    update(contractId: string, updates: Partial<DepositEntity>): Promise<DepositEntity>;
  };
  rentPeriods: {
    listByContractId(contractId: string): Promise<RentPeriodEntity[]>;
    findByPeriod(contractId: string, periodNo: number): Promise<RentPeriodEntity | null>;
    createMany(periods: RentPeriodEntity[]): Promise<void>;
    update(
      contractId: string,
      periodNo: number,
      updates: Partial<RentPeriodEntity>,
    ): Promise<RentPeriodEntity>;
    findOverdueCandidates(asOfDate: string, contractId?: string): Promise<RentPeriodEntity[]>;
  };
  deductions: {
    listByContractId(contractId: string): Promise<DeductionEntity[]>;
    findById(id: string): Promise<DeductionEntity | null>;
    create(deduction: DeductionEntity): Promise<DeductionEntity>;
    update(id: string, updates: Partial<DeductionEntity>): Promise<DeductionEntity>;
  };
  disputes: {
    findByContractId(contractId: string): Promise<DisputeEntity | null>;
    create(dispute: DisputeEntity): Promise<DisputeEntity>;
    update(contractId: string, updates: Partial<DisputeEntity>): Promise<DisputeEntity>;
  };
  payments: {
    findById(id: string): Promise<PaymentEntity | null>;
    findByContractId(contractId: string): Promise<PaymentEntity[]>;
    create(payment: PaymentEntity): Promise<PaymentEntity>;
    update(id: string, updates: Partial<PaymentEntity>): Promise<PaymentEntity>;
  };
  notifications: {
    create(notification: NotificationEntity): Promise<void>;
    listByUserId(userId: string): Promise<NotificationEntity[]>;
    markAsRead(id: string, userId: string): Promise<boolean>;
  };
  auditLogs: {
    create(log: AuditLogEntity): Promise<void>;
    listByContractId(contractId: string): Promise<AuditLogEntity[]>;
  };
  profiles: {
    findById(id: string): Promise<ProfileEntity | null>;
    findByPhone(phone: string): Promise<ProfileEntity | null>;
    create(profile: ProfileEntity): Promise<ProfileEntity>;
  };
}

/**
 * Fake repository chạy hoàn toàn trên RAM, dùng cho unit và integration tests.
 */
export class FakeDomainRepository implements DomainRepository {
  readonly contractsStore = new Map<string, ContractEntity>();
  readonly depositsStore = new Map<string, DepositEntity>();
  readonly rentPeriodsStore = new Map<string, RentPeriodEntity[]>();
  readonly deductionsStore = new Map<string, DeductionEntity>();
  readonly disputesStore = new Map<string, DisputeEntity>();
  readonly paymentsStore = new Map<string, PaymentEntity>();
  readonly notificationsStore: NotificationEntity[] = [];
  readonly auditLogsStore: AuditLogEntity[] = [];
  readonly profilesStore = new Map<string, ProfileEntity>();

  readonly contracts = {
    findById: async (id: string) => {
      const item = this.contractsStore.get(id);
      return item ? { ...item } : null;
    },
    listByUserId: async (userId: string) => {
      return Array.from(this.contractsStore.values())
        .filter((c) => c.landlord_id === userId || c.tenant_id === userId)
        .map((c) => ({ ...c }));
    },
    create: async (contract: ContractEntity) => {
      this.contractsStore.set(contract.id, { ...contract });
      return { ...contract };
    },
    update: async (id: string, updates: Partial<ContractEntity>) => {
      const existing = this.contractsStore.get(id);
      if (!existing) throw new Error(`Contract not found: ${id}`);
      const updated = { ...existing, ...updates, updated_at: new Date().toISOString() };
      this.contractsStore.set(id, updated);
      return { ...updated };
    },
  };

  readonly deposits = {
    findByContractId: async (contractId: string) => {
      const item = this.depositsStore.get(contractId);
      return item ? { ...item } : null;
    },
    create: async (deposit: DepositEntity) => {
      this.depositsStore.set(deposit.contract_id, { ...deposit });
      return { ...deposit };
    },
    update: async (contractId: string, updates: Partial<DepositEntity>) => {
      const existing = this.depositsStore.get(contractId);
      if (!existing) throw new Error(`Deposit not found: ${contractId}`);
      const updated = { ...existing, ...updates, updated_at: new Date().toISOString() };
      this.depositsStore.set(contractId, updated);
      return { ...updated };
    },
  };

  readonly rentPeriods = {
    listByContractId: async (contractId: string) => {
      const list = this.rentPeriodsStore.get(contractId) ?? [];
      return list.map((p) => ({ ...p })).sort((a, b) => a.period_no - b.period_no);
    },
    findByPeriod: async (contractId: string, periodNo: number) => {
      const list = this.rentPeriodsStore.get(contractId) ?? [];
      const item = list.find((p) => p.period_no === periodNo);
      return item ? { ...item } : null;
    },
    createMany: async (periods: RentPeriodEntity[]) => {
      if (periods.length === 0) return;
      const contractId = periods[0].contract_id;
      const current = this.rentPeriodsStore.get(contractId) ?? [];
      this.rentPeriodsStore.set(contractId, [...current, ...periods.map((p) => ({ ...p }))]);
    },
    update: async (contractId: string, periodNo: number, updates: Partial<RentPeriodEntity>) => {
      const list = this.rentPeriodsStore.get(contractId) ?? [];
      const idx = list.findIndex((p) => p.period_no === periodNo);
      if (idx === -1) throw new Error(`Rent period not found: ${contractId} / ${periodNo}`);
      const updated = { ...list[idx], ...updates, updated_at: new Date().toISOString() };
      list[idx] = updated;
      this.rentPeriodsStore.set(contractId, list);
      return { ...updated };
    },
    findOverdueCandidates: async (asOfDate: string, contractId?: string) => {
      const result: RentPeriodEntity[] = [];
      for (const [cId, periods] of this.rentPeriodsStore.entries()) {
        if (contractId && cId !== contractId) continue;
        const contract = this.contractsStore.get(cId);
        if (contract?.status !== "ACTIVE") continue;
        for (const p of periods) {
          if (
            (p.status === "AWAITING_PAYMENT" || p.status === "PARTIALLY_PAID" || p.status === "OVERDUE") &&
            p.due_date < asOfDate
          ) {
            result.push({ ...p });
          }
        }
      }
      return result;
    },
  };

  readonly deductions = {
    listByContractId: async (contractId: string) => {
      return Array.from(this.deductionsStore.values())
        .filter((d) => d.contract_id === contractId)
        .map((d) => ({ ...d }))
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
    },
    findById: async (id: string) => {
      const item = this.deductionsStore.get(id);
      return item ? { ...item } : null;
    },
    create: async (deduction: DeductionEntity) => {
      this.deductionsStore.set(deduction.id, { ...deduction });
      return { ...deduction };
    },
    update: async (id: string, updates: Partial<DeductionEntity>) => {
      const existing = this.deductionsStore.get(id);
      if (!existing) throw new Error(`Deduction not found: ${id}`);
      const updated = { ...existing, ...updates, updated_at: new Date().toISOString() };
      this.deductionsStore.set(id, updated);
      return { ...updated };
    },
  };

  readonly disputes = {
    findByContractId: async (contractId: string) => {
      const item = this.disputesStore.get(contractId);
      return item ? { ...item } : null;
    },
    create: async (dispute: DisputeEntity) => {
      this.disputesStore.set(dispute.contract_id, { ...dispute });
      return { ...dispute };
    },
    update: async (contractId: string, updates: Partial<DisputeEntity>) => {
      const existing = this.disputesStore.get(contractId);
      if (!existing) throw new Error(`Dispute not found: ${contractId}`);
      const updated = { ...existing, ...updates, updated_at: new Date().toISOString() };
      this.disputesStore.set(contractId, updated);
      return { ...updated };
    },
  };

  readonly payments = {
    findById: async (id: string) => {
      const item = this.paymentsStore.get(id);
      return item ? { ...item } : null;
    },
    findByContractId: async (contractId: string) => {
      return Array.from(this.paymentsStore.values())
        .filter((p) => p.contract_id === contractId)
        .map((p) => ({ ...p }));
    },
    create: async (payment: PaymentEntity) => {
      this.paymentsStore.set(payment.id, { ...payment });
      return { ...payment };
    },
    update: async (id: string, updates: Partial<PaymentEntity>) => {
      const existing = this.paymentsStore.get(id);
      if (!existing) throw new Error(`Payment not found: ${id}`);
      const updated = { ...existing, ...updates };
      this.paymentsStore.set(id, updated);
      return { ...updated };
    },
  };

  readonly notifications = {
    create: async (notification: NotificationEntity) => {
      this.notificationsStore.push({ ...notification });
    },
    listByUserId: async (userId: string) => {
      return this.notificationsStore
        .filter((n) => n.user_id === userId)
        .map((n) => ({ ...n }))
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
    markAsRead: async (id: string, userId: string) => {
      const item = this.notificationsStore.find((n) => n.id === id && n.user_id === userId);
      if (!item) return false;
      item.read_at = new Date().toISOString();
      return true;
    },
  };

  readonly auditLogs = {
    create: async (log: AuditLogEntity) => {
      this.auditLogsStore.push({ ...log });
    },
    listByContractId: async (contractId: string) => {
      return this.auditLogsStore
        .filter((l) => l.entity_id === contractId || l.meta.contractId === contractId)
        .map((l) => ({ ...l }))
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
    },
  };

  readonly profiles = {
    findById: async (id: string) => {
      const item = this.profilesStore.get(id);
      return item ? { ...item } : null;
    },
    findByPhone: async (phone: string) => {
      const item = Array.from(this.profilesStore.values()).find((p) => p.phone === phone);
      return item ? { ...item } : null;
    },
    create: async (profile: ProfileEntity) => {
      this.profilesStore.set(profile.id, { ...profile });
      return { ...profile };
    },
  };
}
