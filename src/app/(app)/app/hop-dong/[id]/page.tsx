"use client";

import React, { useState, useEffect, use, useCallback, useRef } from "react";
import Link from "next/link";
import { AppNavbar } from "@/components/app/app-navbar";
import { useSession } from "@/components/app/session-context";
import { apiClient } from "@/components/app/api-client";
import { LoadingSkeleton, ErrorState } from "@/components/app/ui-state";
import { PaymentModal } from "@/components/app/payment-modal";
import { StepUpModal } from "@/components/app/step-up-modal";
import { OnchainDrawer } from "@/components/app/onchain-drawer";
import { OnchainStamp } from "@/components/app/onchain-stamp";
import { formatDate, formatDateTime } from "@/components/app/date-format";
import { JourneyStepper, StatusBadge, MoneyAmount, OnchainProofChip, MockBadge } from "@/components/shared";
import type { ContractDetailDto, PaymentDto, OnchainTxDto, ChargeDto, ChargeKind } from "@/domain/dto";

type TabKey = "tong-quan" | "tien-coc" | "tien-thue" | "hoan-coc" | "bang-chung";

function ContractDetailContent({ id }: { id: string }) {
  const { role } = useSession();

  const [contract, setContract] = useState<ContractDetailDto | null>(null);
  const [onchainTxs, setOnchainTxs] = useState<OnchainTxDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("tong-quan");

  const effectiveRole = contract?.myRole || role;
  const isTenant = effectiveRole === "TENANT";
  const isLandlord = effectiveRole === "LANDLORD";

  // Modals & Drawer
  const [activePayment, setActivePayment] = useState<PaymentDto | null>(null);
  const [showStepUp, setShowStepUp] = useState<string | null>(null);
  const [stepUpData, setStepUpData] = useState<{
    action: "SIGN_CONTRACT" | "APPROVE_REFUND" | "RESPOND_DEDUCTION" | "RESOLVE_DISPUTE" | "EXTEND_DUE";
    title: string;
    onSuccess: (stepUpToken: string) => Promise<void>;
  } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Forms in Settlement Tab
  const [deductionAmount, setDeductionAmount] = useState("1000000");
  const [deductionReason, setDeductionReason] = useState("Khấu trừ hư hỏng vòi nước và ổ khóa");
  const [refundAmountInput, setRefundAmountInput] = useState("");
  const [disputeNoteInput, setDisputeNoteInput] = useState("Hai bên không thống nhất chi phí sửa chữa");
  const [agreedAmountInput, setAgreedAmountInput] = useState("");

  // Charges state
  const [chargeKind, setChargeKind] = useState<"ELECTRICITY" | "WATER" | "SERVICE" | "OTHER">("ELECTRICITY");
  const [chargeAmount, setChargeAmount] = useState("");
  const [chargeNote, setChargeNote] = useState("");
  const [chargePeriod, setChargePeriod] = useState<string>("");
  const [addingCharge, setAddingCharge] = useState(false);
  const [chargeFormError, setChargeFormError] = useState<string | null>(null);
  const [chargeFormSuccess, setChargeFormSuccess] = useState<string | null>(null);
  const [confirmingCharge, setConfirmingCharge] = useState<ChargeDto | null>(null);
  const [markingChargePaid, setMarkingChargePaid] = useState(false);

  const pollCountRef = useRef(0);
  const MAX_POLLS = 15;

  const loadContract = useCallback(async () => {
    try {
      const data = await apiClient.getContractById(id, role === "TENANT" ? "TENANT" : "LANDLORD");
      setContract(data);
      const txs = await apiClient.getOnchainTxs(id);
      setOnchainTxs(txs);
      if (!refundAmountInput) setRefundAmountInput(data.depositAmount);
      if (!agreedAmountInput) setAgreedAmountInput(data.depositAmount);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Không tìm thấy hợp đồng");
    } finally {
      setLoading(false);
    }
  }, [id, role, refundAmountInput, agreedAmountInput]);

  useEffect(() => {
    let ignore = false;
    apiClient
      .getContractById(id, role === "TENANT" ? "TENANT" : "LANDLORD")
      .then(async (data) => {
        if (!ignore) {
          setContract(data);
          const txs = await apiClient.getOnchainTxs(id);
          if (!ignore) {
            setOnchainTxs(txs);
            setRefundAmountInput(data.depositAmount);
            setAgreedAmountInput(data.depositAmount);
            setLoading(false);
          }
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Không tìm thấy hợp đồng");
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [id, role]);

  // Polling with limit and unmount cleanup
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    let isActive = true;

    const poll = async () => {
      if (!isActive) return;
      if (pollCountRef.current >= MAX_POLLS) return;

      const hasPendingTx = onchainTxs.some((t) => t.status === "PENDING" || t.status === "SUBMITTED");
      const needsPoll =
        hasPendingTx || contract?.status === "PENDING_CONFIRMATION" || contract?.depositStatus === "UNPAID";

      if (!needsPoll) return;

      pollCountRef.current += 1;
      try {
        const data = await apiClient.getContractById(id, role === "TENANT" ? "TENANT" : "LANDLORD");
        const txs = await apiClient.getOnchainTxs(id);
        if (isActive) {
          setContract(data);
          setOnchainTxs(txs);
        }
      } catch {
        // Ignored in passive background poll
      }

      if (isActive && pollCountRef.current < MAX_POLLS) {
        timer = setTimeout(poll, 3000);
      }
    };

    timer = setTimeout(poll, 3000);

    return () => {
      isActive = false;
      if (timer) clearTimeout(timer);
    };
  }, [id, role, contract?.status, contract?.depositStatus, onchainTxs]);

  // Deep-linking with URL hash
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace("#", "") as TabKey;
      if (["tong-quan", "tien-coc", "tien-thue", "hoan-coc", "bang-chung"].includes(hash)) {
        setActiveTab(hash);
      }
    };
    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  const switchTab = (tab: TabKey) => {
    setActiveTab(tab);
    window.location.hash = tab;
  };

  // Actions
  const handleConfirmContract = () => {
    setActionError(null);
    setStepUpData({
      action: "SIGN_CONTRACT",
      title: "Ký xác nhận hợp đồng thuê",
      onSuccess: async (stepUpToken: string) => {
        try {
          await apiClient.confirmContract(id, stepUpToken);
          await loadContract();
          switchTab("tien-coc");
        } catch (err: unknown) {
          console.error("[confirm contract client error]:", err);
          setActionError(err instanceof Error ? err.message : "Ký xác nhận hợp đồng thất bại");
        }
      },
    });
    setShowStepUp("CONFIRM");
  };

  const handlePayDeposit = async () => {
    setActionError(null);
    try {
      const p = await apiClient.createDepositPayment(id);
      setActivePayment(p);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Lỗi tạo thanh toán tiền cọc");
    }
  };

  const [extendPeriod, setExtendPeriod] = useState<number | null>(null);
  const [extendDate, setExtendDate] = useState("");

  const handleExtendDue = (periodNo: number) => {
    setActionError(null);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(extendDate)) {
      setActionError("Vui lòng chọn hạn thanh toán mới.");
      return;
    }
    setStepUpData({
      action: "EXTEND_DUE",
      title: "Xác nhận gia hạn thanh toán",
      onSuccess: async (stepUpToken: string) => {
        try {
          await apiClient.extendDue(id, periodNo, extendDate, stepUpToken);
          setExtendPeriod(null);
          setExtendDate("");
          await loadContract();
        } catch (err: unknown) {
          setActionError(err instanceof Error ? err.message : "Gia hạn thanh toán thất bại");
        }
      },
    });
    setShowStepUp("EXTEND_DUE");
  };

  const handlePayRent = async (periodNo: number) => {
    setActionError(null);
    try {
      const p = await apiClient.createRentPayment(id, periodNo);
      setActivePayment(p);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Lỗi tạo thanh toán tiền thuê");
    }
  };

  const handleAddCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    setChargeFormError(null);
    setChargeFormSuccess(null);

    const cleanAmount = chargeAmount.trim();
    if (!cleanAmount) {
      setChargeFormError("Vui lòng nhập số tiền.");
      return;
    }
    if (!/^\d+$/.test(cleanAmount) || BigInt(cleanAmount) <= BigInt(0)) {
      setChargeFormError("Số tiền phải là chuỗi chữ số nguyên dương lớn hơn 0.");
      return;
    }

    setAddingCharge(true);
    try {
      await apiClient.createCharge(id, {
        kind: chargeKind,
        amount: cleanAmount,
        note: chargeNote.trim() || undefined,
        periodNo: chargePeriod ? Number(chargePeriod) : undefined,
      });
      setChargeFormSuccess("Đã thêm khoản nợ phát sinh thành công.");
      setChargeAmount("");
      setChargeNote("");
      setChargePeriod("");
      await loadContract();
    } catch (err: unknown) {
      setChargeFormError(err instanceof Error ? err.message : "Thêm khoản nợ phát sinh thất bại");
    } finally {
      setAddingCharge(false);
    }
  };

  const handleConfirmMarkChargePaid = async () => {
    if (!confirmingCharge) return;
    setMarkingChargePaid(true);
    setActionError(null);
    try {
      await apiClient.markChargePaid(id, confirmingCharge.id);
      setConfirmingCharge(null);
      await loadContract();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Cập nhật trạng thái khoản phát sinh thất bại");
    } finally {
      setMarkingChargePaid(false);
    }
  };

  const handleProposeDeduction = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      await apiClient.proposeDeduction(id, deductionAmount, deductionReason);
      await loadContract();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Lỗi gửi đề xuất khấu trừ");
    }
  };

  const handleRespondDeduction = (deductionId: string, accept: boolean) => {
    setActionError(null);
    setStepUpData({
      action: "RESPOND_DEDUCTION",
      title: accept ? "Chấp thuận khấu trừ tiền cọc" : "Từ chối khấu trừ & Chuyển sang Tranh chấp",
      onSuccess: async (stepUpToken: string) => {
        try {
          await apiClient.respondDeduction(deductionId, accept, stepUpToken);
          await loadContract();
        } catch (err: unknown) {
          setActionError(err instanceof Error ? err.message : "Phản hồi khấu trừ thất bại");
        }
      },
    });
    setShowStepUp("RESPOND_DEDUCTION");
  };

  const handleOpenDispute = async () => {
    setActionError(null);
    try {
      await apiClient.openDispute(id, disputeNoteInput);
      await loadContract();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Lỗi mở tranh chấp");
    }
  };

  const handleResolveDispute = () => {
    setActionError(null);
    setStepUpData({
      action: "RESOLVE_DISPUTE",
      title: "Xác nhận số tiền giải quyết tranh chấp",
      onSuccess: async (stepUpToken: string) => {
        try {
          await apiClient.resolveDispute(id, agreedAmountInput, stepUpToken);
          await loadContract();
        } catch (err: unknown) {
          setActionError(err instanceof Error ? err.message : "Chốt thỏa thuận tranh chấp thất bại");
        }
      },
    });
    setShowStepUp("RESOLVE_DISPUTE");
  };

  const handleApproveRefund = () => {
    setActionError(null);
    setStepUpData({
      action: "APPROVE_REFUND",
      title: "Xác nhận số tiền hoàn cọc",
      onSuccess: async (stepUpToken: string) => {
        try {
          await apiClient.approveRefund(id, refundAmountInput, stepUpToken);
          await loadContract();
        } catch (err: unknown) {
          setActionError(err instanceof Error ? err.message : "Duyệt hoàn cọc thất bại");
        }
      },
    });
    setShowStepUp("APPROVE_REFUND");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex flex-col">
        <AppNavbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-6">
          <LoadingSkeleton lines={6} />
        </main>
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="min-h-screen bg-paper flex flex-col">
        <AppNavbar />
        <main className="max-w-3xl mx-auto px-4 py-12 w-full">
          <ErrorState message={error || "Hợp đồng không tồn tại"} onRetry={loadContract} />
        </main>
      </div>
    );
  }

  const isDisputed = contract.depositStatus === "PENDING_DISPUTE" || contract.disputeStatus !== "NONE";
  // Con dấu chỉ đóng khi có giao dịch thật CONFIRMED
  const confirmedTx = onchainTxs.find((t) => t.status === "CONFIRMED");

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <AppNavbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 min-w-0">
        {/* Breadcrumb & Quick actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs sm:text-sm text-ink/60">
            <Link href="/app" className="hover:text-primary transition-colors">
              Bảng điều khiển
            </Link>
            <span>/</span>
            <span className="text-ink font-semibold truncate max-w-xs">{contract.roomLabel}</span>
          </div>

          <button
            onClick={() => setDrawerOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-surface border border-line text-xs font-bold text-ink hover:bg-line/20 transition-colors cursor-pointer shadow-xs self-start sm:self-auto"
          >
            <span>🔗</span> Bằng chứng On-chain
            {confirmedTx && <span className="w-2 h-2 rounded-full bg-primary" />}
          </button>
        </div>

        {actionError && (
          <div
            role="alert"
            className="p-4 rounded-xl bg-brick/10 border border-brick/30 text-brick text-xs sm:text-sm flex items-center justify-between gap-2"
          >
            <span>⚠️ {actionError}</span>
            <button
              onClick={() => setActionError(null)}
              className="text-xs font-bold hover:underline cursor-pointer"
            >
              Đóng
            </button>
          </div>
        )}

        {/* Contract Header Card */}
        <section className="bg-paper rounded-panel border border-line p-6 sm:p-8 shadow-soft space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">
                  {contract.roomLabel}
                </h1>
                <StatusBadge kind="contract" status={contract.status} />
                <StatusBadge kind="deposit" status={contract.depositStatus} />
              </div>
              <div className="text-xs sm:text-sm text-ink/70">
                Chủ nhà: <strong>{contract.landlordName}</strong> • Người thuê:{" "}
                <strong>{contract.tenantName}</strong>
              </div>
            </div>

            {/* Financial Badges */}
            <div className="flex items-center gap-4 bg-surface/60 p-3 rounded-2xl border border-line text-xs">
              <div>
                <span className="text-ink/60 block">Giá thuê:</span>
                <MoneyAmount value={contract.rentAmount} size="sm" />
              </div>
              <div className="h-8 w-px bg-line" />
              <div>
                <span className="text-ink/60 block">Tiền cọc:</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <MoneyAmount value={contract.depositAmount} size="sm" />
                </div>
              </div>
            </div>
          </div>

          {/* Top Journey Stepper */}
          <div className="border-t border-line/60 pt-4">
            <JourneyStepper current={contract.journeyStep} disputed={isDisputed} />
          </div>
        </section>

        {/* 5 Tab Navigation with data-lenis-prevent */}
        <nav
          aria-label="Tabs hợp đồng"
          className="flex border-b border-line gap-2 sm:gap-6 overflow-x-auto text-xs sm:text-sm font-semibold select-none w-full max-w-full min-w-0"
          data-lenis-prevent
        >
          <button
            onClick={() => switchTab("tong-quan")}
            className={`pb-3 px-2 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "tong-quan"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-ink/60 hover:text-ink"
            }`}
          >
            1. Tổng quan
          </button>
          <button
            onClick={() => switchTab("tien-coc")}
            className={`pb-3 px-2 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "tien-coc"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-ink/60 hover:text-ink"
            }`}
          >
            2. Tiền cọc
          </button>
          <button
            onClick={() => switchTab("tien-thue")}
            className={`pb-3 px-2 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "tien-thue"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-ink/60 hover:text-ink"
            }`}
          >
            3. Tiền thuê & công nợ
          </button>
          <button
            onClick={() => switchTab("hoan-coc")}
            className={`pb-3 px-2 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "hoan-coc"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-ink/60 hover:text-ink"
            }`}
          >
            4. Hoàn cọc & Tranh chấp
          </button>
          <button
            onClick={() => switchTab("bang-chung")}
            className={`pb-3 px-2 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "bang-chung"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-ink/60 hover:text-ink"
            }`}
          >
            5. Bằng chứng on-chain
          </button>
        </nav>

        {/* TAB 1: TỔNG QUAN */}
        {activeTab === "tong-quan" && (
          <section className="bg-surface/40 rounded-card border border-line p-4 sm:p-6 lg:p-8 space-y-6 w-full max-w-full min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-ink">Thông tin hợp đồng</h2>

            {/* Confirmation Banner if PENDING_CONFIRMATION */}
            {contract.status === "PENDING_CONFIRMATION" && (
              <div className="p-4 rounded-xl bg-amber/15 border border-amber/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1 text-xs sm:text-sm text-amber-ink">
                  <div className="font-bold flex items-center gap-1.5">
                    <span>⚠️</span> Hợp đồng đang chờ ký xác nhận
                  </div>
                  <p>
                    {isTenant
                      ? "Chủ nhà đã tạo hợp đồng này. Vui lòng kiểm tra kỹ các điều khoản trước khi ký xác nhận."
                      : "Bạn đã tạo hợp đồng. Đang chờ Người thuê xác nhận và ký kết qua ứng dụng."}
                  </p>
                </div>
                {isTenant && (
                  <button
                    onClick={handleConfirmContract}
                    className="px-5 py-2.5 rounded-xl bg-primary text-paper font-bold hover:bg-primary-strong transition-colors shadow-xs cursor-pointer text-xs sm:text-sm whitespace-nowrap self-start sm:self-auto"
                  >
                    Xác nhận & Ký hợp đồng
                  </button>
                )}
              </div>
            )}

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 text-sm">
              <div className="p-4 rounded-xl bg-paper border border-line space-y-1">
                <span className="text-xs text-ink/50">Thời hạn hợp đồng</span>
                <div className="font-semibold text-ink">
                  {formatDate(contract.startDate)} đến {formatDate(contract.endDate)}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-paper border border-line space-y-1">
                <span className="text-xs text-ink/50">Lịch thanh toán định kỳ</span>
                <div className="font-semibold text-ink">Ngày {contract.dueDay} hàng tháng</div>
              </div>

              <div className="p-4 rounded-xl bg-paper border border-line space-y-1">
                <span className="text-xs text-ink/50">Phí phạt trễ hạn</span>
                <div className="font-semibold text-ink">
                  {contract.lateFeeBpsPerDay / 100}% / ngày ({contract.lateFeeBpsPerDay} bps)
                </div>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-paper border border-line space-y-2">
              <h3 className="font-bold text-sm text-ink">Điều khoản thỏa thuận</h3>
              <p className="text-xs sm:text-sm text-ink/80 whitespace-pre-line leading-relaxed">
                {contract.termsText}
              </p>
            </div>
          </section>
        )}

        {/* TAB 2: TIỀN CỌC */}
        {activeTab === "tien-coc" && (
          <section className="bg-surface/40 rounded-card border border-line p-4 sm:p-6 lg:p-8 space-y-6 w-full max-w-full min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-lg sm:text-xl font-bold text-ink">Bảo chứng tiền cọc</h2>
              <StatusBadge kind="deposit" status={contract.depositStatus} />
            </div>

            {/* Stamp only when on-chain confirmed */}
            {confirmedTx && (
              <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-left">
                  <div className="font-bold text-primary text-sm sm:text-base">
                    Tiền cọc đã được bảo chứng an toàn trong hệ thống (mô phỏng)
                  </div>
                  <p className="text-xs text-ink/70">
                    Khoản tiền này bị khóa ở trạng thái trung lập. Chỉ được giải ngân khi có sự đồng thuận của
                    cả Chủ nhà và Người thuê.
                  </p>
                </div>
                <OnchainStamp timestamp={confirmedTx.createdAt} />
              </div>
            )}

            {/* Unpaid Action Banner */}
            {contract.depositStatus === "UNPAID" && (
              <div className="p-5 rounded-xl bg-amber/15 border border-amber/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1 text-xs sm:text-sm text-amber-ink">
                  <div className="font-bold flex items-center gap-1.5">
                    <span>💳</span> Chưa nạp tiền cọc bảo chứng
                  </div>
                  <p>
                    Số tiền cọc cần nạp là <MoneyAmount value={contract.depositAmount} size="sm" />. Quét mã
                    VietQR để hoàn tất nạp cọc.
                  </p>
                </div>
                {isTenant && (
                  <button
                    onClick={handlePayDeposit}
                    className="px-5 py-2.5 rounded-xl bg-primary text-paper font-bold hover:bg-primary-strong transition-colors shadow-xs cursor-pointer text-xs sm:text-sm whitespace-nowrap self-start sm:self-auto"
                  >
                    Nạp tiền cọc ngay
                  </button>
                )}
              </div>
            )}

            {/* Financial Details */}
            <div className="grid sm:grid-cols-3 gap-4 text-sm">
              <div className="p-4 rounded-xl bg-paper border border-line space-y-1">
                <span className="text-xs text-ink/50">Số tiền cọc cam kết</span>
                <MoneyAmount value={contract.depositAmount} size="md" />
              </div>

              <div className="p-4 rounded-xl bg-paper border border-line space-y-1">
                <span className="text-xs text-ink/50">Đã nạp thực tế</span>
                <MoneyAmount value={contract.deposit.paidAmount} size="md" />
              </div>

              <div className="p-4 rounded-xl bg-paper border border-line space-y-1">
                <span className="text-xs text-ink/50">Cơ chế quản lý</span>
                <div className="font-semibold text-xs text-ink flex items-center gap-1.5">
                  <span>🔒 Escrow trung lập</span>
                  <MockBadge label="MÔ PHỎNG" />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* TAB 3: TIỀN THUÊ & CÔNG NỢ */}
        {activeTab === "tien-thue" && (() => {
          const unpaidRentTotal = (contract.rentPeriods || []).reduce((acc, p) => {
            if (p.status !== "PAID") {
              const due = BigInt(p.amountDue || "0");
              const paid = BigInt(p.amountPaid || "0");
              const rem = due > paid ? due - paid : BigInt(0);
              return acc + rem;
            }
            return acc;
          }, BigInt(0));

          const lateFeeTotal = (contract.rentPeriods || []).reduce((acc, p) => {
            return acc + BigInt(p.lateFee || "0");
          }, BigInt(0));

          const chargesList: ChargeDto[] = contract.charges || [];
          const unpaidChargesTotal = chargesList.reduce((acc, c) => {
            if (c.status === "UNPAID") {
              return acc + BigInt(c.amount || "0");
            }
            return acc;
          }, BigInt(0));

          const grandTotalDebt = unpaidRentTotal + lateFeeTotal + unpaidChargesTotal;

          const kindLabels: Record<string, string> = {
            ELECTRICITY: "Tiền điện",
            WATER: "Tiền nước",
            SERVICE: "Phí dịch vụ",
            OTHER: "Khoản khác",
          };

          return (
            <section className="bg-surface/40 rounded-card border border-line p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 w-full max-w-full min-w-0">
              {/* 1. DÒNG TỔNG CÔNG NỢ */}
              <div className="p-4 sm:p-6 rounded-panel bg-paper border border-line shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3">
                  <div className="space-y-0.5">
                    <h3 className="font-extrabold text-base sm:text-lg text-ink">
                      Tổng hợp công nợ hợp đồng
                    </h3>
                    <p className="text-xs text-ink/60">
                      Bao gồm tiền thuê chưa nộp, tiền phạt quá hạn và các khoản phát sinh (điện, nước, dịch vụ).
                    </p>
                  </div>
                  <div className="flex items-center gap-2 bg-surface/80 px-3 py-1.5 rounded-xl border border-line self-start sm:self-auto">
                    <span className="text-xs font-bold text-ink/70">Tổng công nợ:</span>
                    <MoneyAmount value={grandTotalDebt.toString()} size="md" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs sm:text-sm">
                  <div className="p-3.5 rounded-xl bg-surface border border-line space-y-1">
                    <span className="text-ink/60 block text-xs">Tiền thuê chưa trả:</span>
                    <MoneyAmount value={unpaidRentTotal.toString()} size="sm" />
                  </div>
                  <div className="p-3.5 rounded-xl bg-surface border border-line space-y-1">
                    <span className="text-ink/60 block text-xs">Phí phạt chậm trả:</span>
                    <div className={lateFeeTotal > BigInt(0) ? "text-brick font-bold" : ""}>
                      <MoneyAmount value={lateFeeTotal.toString()} size="sm" />
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-surface border border-line space-y-1">
                    <span className="text-ink/60 block text-xs">Khoản phát sinh chưa trả:</span>
                    <MoneyAmount value={unpaidChargesTotal.toString()} size="sm" />
                  </div>
                </div>
              </div>

              {/* 2. BẢNG TIỀN THUÊ THEO KỲ */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base sm:text-lg font-bold text-ink">Lịch thu tiền thuê theo kỳ</h3>
                  <span className="text-xs text-ink/60">{contract.rentPeriods.length} kỳ thuê</span>
                </div>

                <div className="overflow-x-auto w-full max-w-full min-w-0" data-lenis-prevent>
                  <table className="w-full text-left text-xs sm:text-sm whitespace-nowrap min-w-[600px]">
                    <thead>
                      <tr className="border-b border-line text-ink/50 font-semibold">
                        <th className="py-2.5 px-3">Kỳ</th>
                        <th className="py-2.5 px-3">Hạn thanh toán</th>
                        <th className="py-2.5 px-3">Phải nộp</th>
                        <th className="py-2.5 px-3">Đã nộp</th>
                        <th className="py-2.5 px-3">Quá hạn</th>
                        <th className="py-2.5 px-3">Phí trễ</th>
                        <th className="py-2.5 px-3">Trạng thái</th>
                        <th className="py-2.5 px-3 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/60">
                      {contract.rentPeriods.map((period) => (
                        <tr key={period.periodNo} className="hover:bg-paper/50 transition-colors">
                          <td className="py-3 px-3 font-bold text-ink">Kỳ {period.periodNo}</td>
                          <td className="py-3 px-3 text-ink/80">{formatDate(period.dueDate)}</td>
                          <td className="py-3 px-3">
                            <MoneyAmount value={period.amountDue} size="sm" />
                          </td>
                          <td className="py-3 px-3">
                            <MoneyAmount value={period.amountPaid} size="sm" />
                          </td>
                          <td className="py-3 px-3">
                            {period.lateDays > 0 ? (
                              <span className="text-brick font-bold">{period.lateDays} ngày</span>
                            ) : (
                              <span className="text-ink/40">0</span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            {period.lateFee !== "0" ? (
                              <span className="text-brick font-semibold">
                                <MoneyAmount value={period.lateFee} size="sm" />
                              </span>
                            ) : (
                              <span className="text-ink/40">0 ₫</span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <StatusBadge kind="rent" status={period.status} />
                          </td>
                          <td className="py-3 px-3 text-right">
                            {isLandlord &&
                              contract.status === "ACTIVE" &&
                              period.status === "OVERDUE" &&
                              (extendPeriod === period.periodNo ? (
                                <span className="inline-flex flex-wrap items-center justify-end gap-2">
                                  <input
                                    type="date"
                                    value={extendDate}
                                    min={tomorrowIso()}
                                    onChange={(e) => setExtendDate(e.target.value)}
                                    aria-label="Hạn thanh toán mới"
                                    className="rounded-lg border border-line bg-paper px-2 py-1 text-xs sm:text-sm"
                                  />
                                  <button
                                    onClick={() => handleExtendDue(period.periodNo)}
                                    className="px-3 py-1.5 rounded-lg bg-primary text-paper font-bold hover:bg-primary-strong transition-colors text-xs"
                                  >
                                    Xác nhận
                                  </button>
                                  <button
                                    onClick={() => setExtendPeriod(null)}
                                    className="px-3 py-1.5 rounded-lg border border-line text-ink/70 hover:bg-surface text-xs"
                                  >
                                    Hủy
                                  </button>
                                </span>
                              ) : (
                                <button
                                  onClick={() => setExtendPeriod(period.periodNo)}
                                  className="px-3 py-1.5 rounded-lg border border-primary text-primary-strong font-bold hover:bg-primary/10 transition-colors text-xs"
                                >
                                  Gia hạn thanh toán
                                </button>
                              ))}
                            {period.status !== "PAID" && isTenant && (
                              <button
                                onClick={() => handlePayRent(period.periodNo)}
                                className="px-3.5 py-1.5 rounded-lg bg-primary text-paper font-bold hover:bg-primary-strong transition-colors cursor-pointer text-xs"
                              >
                                Nộp tiền
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 3. PHẦN KHOẢN PHÁT SINH (ĐIỆN, NƯỚC, DỊCH VỤ) */}
              <div className="space-y-4 pt-6 border-t border-line">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <h3 className="text-base sm:text-lg font-bold text-ink">
                      Khoản phát sinh (Điện, nước, dịch vụ)
                    </h3>
                    <p className="text-xs text-ink/60">
                      Các chi phí thực tế phát sinh trong quá trình thuê nhà.
                    </p>
                  </div>
                  <span className="text-xs text-ink/60 self-start sm:self-auto">
                    {chargesList.length} khoản phát sinh
                  </span>
                </div>

                {/* Bảng các khoản phát sinh */}
                <div className="overflow-x-auto w-full max-w-full min-w-0" data-lenis-prevent>
                  <table className="w-full text-left text-xs sm:text-sm whitespace-nowrap min-w-[600px]">
                    <thead>
                      <tr className="border-b border-line text-ink/50 font-semibold">
                        <th className="py-2.5 px-3">Loại khoản</th>
                        <th className="py-2.5 px-3">Kỳ liên quan</th>
                        <th className="py-2.5 px-3">Ghi chú</th>
                        <th className="py-2.5 px-3">Số tiền</th>
                        <th className="py-2.5 px-3">Trạng thái</th>
                        <th className="py-2.5 px-3 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/60">
                      {chargesList.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-xs text-ink/50">
                            Chưa có khoản nợ phát sinh nào.
                          </td>
                        </tr>
                      ) : (
                        chargesList.map((charge) => (
                          <tr key={charge.id} className="hover:bg-paper/50 transition-colors">
                            <td className="py-3 px-3 font-bold text-ink">
                              {kindLabels[charge.kind] || charge.kind}
                            </td>
                            <td className="py-3 px-3 text-ink/70">
                              {charge.periodNo ? `Kỳ ${charge.periodNo}` : "Ngoài kỳ"}
                            </td>
                            <td className="py-3 px-3 text-ink/80 max-w-xs truncate">
                              {charge.note || "—"}
                            </td>
                            <td className="py-3 px-3 font-semibold">
                              <MoneyAmount value={charge.amount} size="sm" />
                            </td>
                            <td className="py-3 px-3">
                              {charge.status === "PAID" ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-primary/15 text-primary border border-primary/30">
                                  ✓ Đã thanh toán
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber/20 text-amber-ink border border-amber/40">
                                  ⏳ Chưa thanh toán
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right">
                              {isLandlord && contract.status === "ACTIVE" && charge.status === "UNPAID" ? (
                                <button
                                  type="button"
                                  onClick={() => setConfirmingCharge(charge)}
                                  className="px-3 py-1.5 rounded-lg border border-primary text-primary-strong font-bold hover:bg-primary/10 transition-colors text-xs whitespace-nowrap cursor-pointer"
                                >
                                  Đã nhận ngoài hệ thống
                                </button>
                              ) : isTenant && charge.status === "UNPAID" ? (
                                <span className="text-[11px] text-ink/50 italic">Cần thanh toán trực tiếp</span>
                              ) : (
                                <span className="text-[11px] text-ink/40">—</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Form thêm khoản nợ phát sinh cho chủ nhà khi hợp đồng đang hiệu lực */}
                {isLandlord && contract.status === "ACTIVE" && (
                  <div className="p-4 sm:p-6 rounded-panel bg-paper border border-line space-y-4 mt-4">
                    <h4 className="font-bold text-sm sm:text-base text-ink">
                      Thêm khoản nợ phát sinh mới
                    </h4>

                    {chargeFormError && (
                      <div role="alert" className="p-3 rounded-xl bg-brick/10 border border-brick/30 text-brick text-xs font-semibold">
                        ⚠️ {chargeFormError}
                      </div>
                    )}
                    {chargeFormSuccess && (
                      <div role="status" className="p-3 rounded-xl bg-primary/10 border border-primary/30 text-primary text-xs font-semibold">
                        ✓ {chargeFormSuccess}
                      </div>
                    )}

                    <form onSubmit={handleAddCharge} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-ink/80 block">
                          Loại khoản phí:
                        </label>
                        <select
                          value={chargeKind}
                          onChange={(e) => setChargeKind(e.target.value as ChargeKind)}
                          className="w-full px-3 py-2.5 rounded-xl border border-line bg-surface text-ink text-xs sm:text-sm focus:outline-primary cursor-pointer"
                        >
                          <option value="ELECTRICITY">Tiền điện</option>
                          <option value="WATER">Tiền nước</option>
                          <option value="SERVICE">Phí dịch vụ</option>
                          <option value="OTHER">Khoản khác</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-ink/80 block">
                          Số tiền (₫):
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={chargeAmount}
                          onChange={(e) => setChargeAmount(e.target.value)}
                          placeholder="Ví dụ: 350000"
                          className="w-full px-3 py-2.5 rounded-xl border border-line bg-surface text-ink text-xs sm:text-sm font-mono focus:outline-primary"
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-ink/80 block">
                          Kỳ liên quan (tùy chọn):
                        </label>
                        <select
                          value={chargePeriod}
                          onChange={(e) => setChargePeriod(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl border border-line bg-surface text-ink text-xs sm:text-sm focus:outline-primary cursor-pointer"
                        >
                          <option value="">Không gắn kỳ cụ thể</option>
                          {contract.rentPeriods.map((p) => (
                            <option key={p.periodNo} value={p.periodNo}>
                              Kỳ {p.periodNo} ({formatDate(p.dueDate)})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-ink/80 block">
                          Ghi chú diễn giải:
                        </label>
                        <input
                          type="text"
                          value={chargeNote}
                          onChange={(e) => setChargeNote(e.target.value)}
                          placeholder="Ví dụ: Số điện 150 kWh..."
                          className="w-full px-3 py-2.5 rounded-xl border border-line bg-surface text-ink text-xs sm:text-sm focus:outline-primary"
                        />
                      </div>

                      <div className="sm:col-span-2 lg:col-span-4 flex justify-end pt-2">
                        <button
                          type="submit"
                          disabled={addingCharge}
                          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-primary text-paper font-bold hover:bg-primary-strong transition-colors cursor-pointer text-xs sm:text-sm disabled:opacity-50 shadow-xs"
                        >
                          {addingCharge ? "Đang thêm…" : "Thêm khoản phát sinh"}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>

              {/* Modal xác nhận đã nhận tiền ngoài hệ thống */}
              {confirmingCharge && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="confirm-charge-title"
                >
                  <div className="w-full max-w-md bg-paper rounded-panel border border-line p-6 shadow-soft space-y-5">
                    <div className="flex items-center justify-between border-b border-line pb-3">
                      <h3 id="confirm-charge-title" className="font-bold text-base text-ink">
                        Xác nhận nhận tiền ngoài hệ thống
                      </h3>
                      <button
                        onClick={() => setConfirmingCharge(null)}
                        className="text-ink/40 hover:text-ink text-lg leading-none cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Warning banner: KHÔNG PHẢI XÁC NHẬN CỦA NGÂN HÀNG */}
                    <div className="p-3.5 rounded-xl bg-amber/15 border-2 border-amber/40 text-xs text-amber-ink space-y-1">
                      <div className="font-extrabold flex items-center gap-1.5">
                        <span>⚠️</span> Lưu ý quan trọng
                      </div>
                      <p className="leading-relaxed">
                        Đây là chủ nhà tự xác nhận, <strong>không phải xác nhận của ngân hàng</strong>. Khoản tiền này được thanh toán trực tiếp qua tiền mặt hoặc chuyển khoản ngoài hệ thống RentFlow.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-surface border border-line text-xs space-y-1.5 text-ink/80">
                      <div>
                        Loại khoản: <strong>{kindLabels[confirmingCharge.kind] || confirmingCharge.kind}</strong>
                      </div>
                      <div>
                        Số tiền: <MoneyAmount value={confirmingCharge.amount} size="sm" />
                      </div>
                      {confirmingCharge.note && (
                        <div>
                          Ghi chú: <em>{confirmingCharge.note}</em>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setConfirmingCharge(null)}
                        className="px-4 py-2 rounded-xl border border-line text-ink/70 hover:bg-surface text-xs font-semibold cursor-pointer"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmMarkChargePaid}
                        disabled={markingChargePaid}
                        className="px-4 py-2 rounded-xl bg-primary text-paper font-bold hover:bg-primary-strong transition-colors text-xs cursor-pointer disabled:opacity-50 shadow-xs"
                      >
                        {markingChargePaid ? "Đang xác nhận…" : "Xác nhận đã nhận"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>
          );
        })()}

        {/* TAB 4: HOÀN CỌC & TRANH CHẤP */}
        {activeTab === "hoan-coc" && (
          <section className="bg-surface/40 rounded-card border border-line p-6 sm:p-8 space-y-8">
            <div className="space-y-1">
              <h2 className="text-lg sm:text-xl font-bold text-ink">Hoàn cọc, Khấu trừ & Xử lý tranh chấp</h2>
              <p className="text-xs sm:text-sm text-ink/70">
                Tiền cọc chỉ giải ngân khi có sự đồng thuận từ cả hai phía. Hệ thống RentFlow không tự ý quyết
                định thay bạn.
              </p>
            </div>

            {/* Dispute Locked Alert if active dispute */}
            {isDisputed && (
              <div
                role="alert"
                className="p-4 sm:p-5 rounded-panel bg-brick/15 border-2 border-brick/40 space-y-2"
              >
                <div className="flex items-center gap-2 text-brick font-extrabold text-sm sm:text-base">
                  <span>🚨</span> TIỀN CỌC ĐANG BỊ KHÓA DO TRANH CHẤP
                </div>
                <p className="text-xs sm:text-sm text-brick-ink leading-relaxed">
                  Hai bên chưa đạt được thỏa thuận về số tiền khấu trừ hoặc hoàn trả. Tiền cọc được bảo chứng
                  an toàn và khóa chặt trong contract. Hệ thống <strong>không tự giải ngân</strong> cho bất kỳ
                  bên nào khi chưa có sự xác nhận thống nhất từ cả hai bên.
                </p>
              </div>
            )}

            {/* Section 1: Refund Agreement */}
            <div className="p-5 rounded-panel bg-paper border border-line space-y-4">
              <h3 className="font-bold text-base text-ink flex items-center gap-2">
                <span>1.</span> Thỏa thuận hoàn tiền cọc
              </h3>
              <p className="text-xs text-ink/60">
                Khi kết thúc hợp đồng không có hư hỏng tài sản, cả hai bên cùng xác nhận hoàn cọc.
              </p>

              <div className="grid sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3 rounded-xl bg-surface border border-line">
                  <span className="text-ink/60 block mb-1">Chủ nhà xác nhận:</span>
                  <div className="font-bold text-ink">
                    {contract.deposit.landlordRefundAmount ? (
                      <MoneyAmount value={contract.deposit.landlordRefundAmount} size="sm" />
                    ) : (
                      <span className="text-ink/40 font-normal">Chưa gửi xác nhận</span>
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-surface border border-line">
                  <span className="text-ink/60 block mb-1">Người thuê xác nhận:</span>
                  <div className="font-bold text-ink">
                    {contract.deposit.tenantRefundAmount ? (
                      <MoneyAmount value={contract.deposit.tenantRefundAmount} size="sm" />
                    ) : (
                      <span className="text-ink/40 font-normal">Chưa gửi xác nhận</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                <input
                  type="number"
                  value={refundAmountInput}
                  onChange={(e) => setRefundAmountInput(e.target.value)}
                  placeholder="Số tiền hoàn trả (₫)"
                  className="px-3.5 py-2.5 rounded-xl border border-line bg-surface text-xs sm:text-sm font-mono w-full sm:w-48 focus:outline-primary"
                />
                <button
                  onClick={handleApproveRefund}
                  className="px-4 py-2.5 rounded-xl bg-primary text-paper text-xs sm:text-sm font-bold hover:bg-primary-strong transition-colors cursor-pointer text-center"
                >
                  Xác nhận hoàn cọc
                </button>
              </div>
            </div>

            {/* Section 2: Deduction Proposals */}
            <div className="p-5 rounded-panel bg-paper border border-line space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base text-ink flex items-center gap-2">
                  <span>2.</span> Đề xuất khấu trừ chi phí hư hỏng
                </h3>
                <span className="text-xs text-ink/50">{contract.deductions.length} đề xuất</span>
              </div>

              {/* Deductions list */}
              {contract.deductions.length === 0 ? (
                <p className="text-xs text-ink/50 py-2">Chưa có đề xuất khấu trừ nào.</p>
              ) : (
                <div className="space-y-3">
                  {contract.deductions.map((ded) => (
                    <div
                      key={ded.id}
                      className="p-4 rounded-xl bg-surface/60 border border-line space-y-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <MoneyAmount value={ded.amount} size="sm" />
                          <StatusBadge kind="deduction" status={ded.status} />
                        </div>
                        <p className="text-xs text-ink/80">{ded.reasonText}</p>
                      </div>

                      {ded.status === "PROPOSED" && isTenant && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleRespondDeduction(ded.id, true)}
                            className="px-3 py-1.5 rounded-lg bg-primary text-paper text-xs font-bold hover:bg-primary-strong cursor-pointer"
                          >
                            Đồng ý khấu trừ
                          </button>
                          <button
                            onClick={() => handleRespondDeduction(ded.id, false)}
                            className="px-3 py-1.5 rounded-lg bg-brick/15 text-brick border border-brick/30 text-xs font-bold hover:bg-brick/25 cursor-pointer"
                          >
                            Từ chối (Tranh chấp)
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Landlord Form to propose new deduction */}
              {isLandlord && contract.status === "ACTIVE" && (
                <form onSubmit={handleProposeDeduction} className="pt-3 border-t border-line space-y-3">
                  <h4 className="text-xs font-bold text-ink uppercase tracking-wider">
                    Tạo đề xuất khấu trừ mới (Chủ nhà):
                  </h4>
                  <div className="grid sm:grid-cols-3 gap-3">
                    <input
                      type="number"
                      value={deductionAmount}
                      onChange={(e) => setDeductionAmount(e.target.value)}
                      placeholder="Số tiền khấu trừ (₫)"
                      className="px-3 py-2 rounded-xl border border-line bg-surface text-xs font-mono"
                      required
                    />
                    <input
                      type="text"
                      value={deductionReason}
                      onChange={(e) => setDeductionReason(e.target.value)}
                      placeholder="Lý do chi tiết (ví dụ: hỏng điều hòa)"
                      className="sm:col-span-2 px-3 py-2 rounded-xl border border-line bg-surface text-xs"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-ink text-paper text-xs font-bold hover:bg-ink/90 cursor-pointer"
                  >
                    Gửi đề xuất khấu trừ cho Người thuê
                  </button>
                </form>
              )}
            </div>

            {/* Section 3: Dispute Resolution */}
            <div className="p-5 rounded-panel bg-paper border border-line space-y-4">
              <h3 className="font-bold text-base text-ink flex items-center gap-2">
                <span>3.</span> Mở tranh chấp hoặc Thỏa thuận giải quyết
              </h3>

              {!isDisputed ? (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <input
                    type="text"
                    value={disputeNoteInput}
                    onChange={(e) => setDisputeNoteInput(e.target.value)}
                    placeholder="Lý do mở tranh chấp..."
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-line bg-surface text-xs sm:text-sm"
                  />
                  <button
                    onClick={handleOpenDispute}
                    className="px-4 py-2.5 rounded-xl bg-brick/15 text-brick border border-brick/40 text-xs sm:text-sm font-bold hover:bg-brick/25 cursor-pointer whitespace-nowrap text-center"
                  >
                    Mở tranh chấp & Khóa cọc
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4 text-xs">
                    <div className="p-3 rounded-xl bg-surface border border-line">
                      <span className="text-ink/60 block mb-1">Chủ nhà đề xuất giải quyết:</span>
                      <div className="font-bold text-ink">
                        {contract.dispute?.landlordAgreedAmount ? (
                          <MoneyAmount value={contract.dispute.landlordAgreedAmount} size="sm" />
                        ) : (
                          <span className="text-ink/40 font-normal">Chưa gửi số tiền</span>
                        )}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-surface border border-line">
                      <span className="text-ink/60 block mb-1">Người thuê đề xuất giải quyết:</span>
                      <div className="font-bold text-ink">
                        {contract.dispute?.tenantAgreedAmount ? (
                          <MoneyAmount value={contract.dispute.tenantAgreedAmount} size="sm" />
                        ) : (
                          <span className="text-ink/40 font-normal">Chưa gửi số tiền</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <input
                      type="number"
                      value={agreedAmountInput}
                      onChange={(e) => setAgreedAmountInput(e.target.value)}
                      placeholder="Số tiền thỏa thuận (₫)"
                      className="px-3.5 py-2.5 rounded-xl border border-line bg-surface text-xs sm:text-sm font-mono w-full sm:w-48"
                    />
                    <button
                      onClick={handleResolveDispute}
                      className="px-4 py-2.5 rounded-xl bg-primary text-paper text-xs sm:text-sm font-bold hover:bg-primary-strong cursor-pointer whitespace-nowrap text-center"
                    >
                      Xác nhận số tiền đồng thuận
                    </button>
                  </div>
                  <p className="text-[11px] text-ink/50">
                    Khi cả hai bên nhập cùng một số tiền, hợp đồng sẽ tự động mở khóa và giải ngân hoàn cọc
                    theo số tiền đã thống nhất.
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* TAB 5: BẰNG CHỨNG ON-CHAIN */}
        {activeTab === "bang-chung" && (
          <section className="bg-surface/40 rounded-card border border-line p-4 sm:p-6 lg:p-8 space-y-6 w-full max-w-full min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-ink">
                  Sổ cái minh bạch & Bằng chứng Stellar
                </h2>
                <p className="text-xs text-ink/60">
                  Mã định danh nội bộ: <span className="font-mono text-ink font-semibold">{contract.id}</span>
                </p>
              </div>

              {confirmedTx && <OnchainStamp timestamp={confirmedTx.createdAt} />}
            </div>

            {/* Non-PII Banner */}
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 text-xs text-ink space-y-1">
              <div className="font-bold text-primary flex items-center gap-1.5">
                <span>🛡️</span> Nguyên tắc bảo vệ dữ liệu cá nhân
              </div>
              <p className="text-[11px] text-ink/80 leading-relaxed">
                Không có tên, SĐT, CCCD, địa chỉ, ảnh, hay nội dung văn bản hợp đồng nào được đưa lên
                blockchain. On-chain chỉ ghi nhận mã định danh hợp đồng nội bộ, mã băm SHA-256 có salt và các
                trạng thái chuyển đổi.
              </p>
            </div>

            {/* Doc Hash */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-ink uppercase tracking-wider block">
                Mã băm SHA-256 hợp đồng (Salted Doc Hash):
              </span>
              <div className="p-3 rounded-xl bg-paper border border-line font-mono text-xs text-ink/80 break-all select-all">
                {contract.docHash || "Chưa có mã băm"}
              </div>
            </div>

            {/* Txs table */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-ink uppercase tracking-wider block">
                Các giao dịch Soroban đã ghi nhận ({onchainTxs.length}):
              </span>

              <div className="overflow-x-auto w-full max-w-full min-w-0" data-lenis-prevent>
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-line text-ink/50 font-semibold">
                      <th className="py-2.5 px-3">Hành động</th>
                      <th className="py-2.5 px-3">Trạng thái</th>
                      <th className="py-2.5 px-3">Tx Hash</th>
                      <th className="py-2.5 px-3">Thời điểm</th>
                      <th className="py-2.5 px-3 text-right">Khám phá</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {onchainTxs.map((tx) => (
                      <tr key={tx.id} className="hover:bg-paper/50 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-ink">{tx.action}</td>
                        <td className="py-3 px-3">
                          <OnchainProofChip status={tx.status} />
                        </td>
                        <td className="py-3 px-3 font-mono text-ink/70">
                          {tx.txHash ? `${tx.txHash.slice(0, 10)}…${tx.txHash.slice(-6)}` : "—"}
                        </td>
                        <td className="py-3 px-3 text-ink/60">{formatDateTime(tx.createdAt)}</td>
                        <td className="py-3 px-3 text-right">
                          {tx.explorerUrl ? (
                            <a
                              href={tx.explorerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary font-semibold hover:underline"
                            >
                              Stellar Expert ↗
                            </a>
                          ) : (
                            <span className="text-ink/40 text-[11px] italic">Dữ liệu mẫu</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Payment Modal */}
      {activePayment && (
        <PaymentModal
          payment={activePayment}
          roomLabel={contract.roomLabel}
          onSuccess={async () => {
            await loadContract();
          }}
          onClose={() => setActivePayment(null)}
        />
      )}

      {/* Step up Signature Modal */}
      {showStepUp && stepUpData && (
        <StepUpModal
          action={stepUpData.action}
          title={stepUpData.title}
          onSuccess={async (stepUpToken: string) => {
            setShowStepUp(null);
            await stepUpData.onSuccess(stepUpToken);
          }}
          onCancel={() => setShowStepUp(null)}
        />
      )}

      {/* Drawer */}
      <OnchainDrawer
        contractId={contract.id}
        docHash={contract.docHash}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}

function ResolvedContractDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ContractDetailContent id={id} />;
}

/** Ngày mai theo định dạng YYYY-MM-DD, dùng làm ngày nhỏ nhất khi gia hạn thanh toán. */
function tomorrowIso(): string {
  return new Date(Date.now() + 86400000).toISOString().slice(0, 10);
}

export default function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-paper flex flex-col">
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-6">
            <LoadingSkeleton lines={6} />
          </main>
        </div>
      }
    >
      <ResolvedContractDetail params={params} />
    </React.Suspense>
  );
}
