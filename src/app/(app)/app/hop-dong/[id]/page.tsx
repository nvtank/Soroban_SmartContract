"use client";

import React, { useState, useEffect, use } from "react";
import { AppNavbar } from "@/components/app/app-navbar";
import { useSession } from "@/components/app/session-context";
import { apiClient } from "@/components/app/api-client";
import { LoadingSkeleton, ErrorState } from "@/components/app/ui-state";
import { PaymentModal } from "@/components/app/payment-modal";
import { StepUpModal } from "@/components/app/step-up-modal";
import { OnchainDrawer } from "@/components/app/onchain-drawer";
import {
  ContractHeader,
  ContractTabs,
  OverviewTab,
  DepositTab,
  RentAndChargesTab,
  RefundAndDisputeTab,
  OnchainProofTab,
  useContractDetail,
  type ContractTabKey,
} from "@/components/app/contract";
import type { PaymentDto } from "@/domain/dto";

const VALID_TABS: ContractTabKey[] = ["tong-quan", "tien-coc", "tien-thue", "hoan-coc", "bang-chung"];

function ContractDetailContent({ id }: { id: string }) {
  const { role } = useSession();
  const { contract, onchainTxs, loading, error, loadContract } = useContractDetail(id, role);

  const [actionError, setActionError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ContractTabKey>("tong-quan");
  const [activePayment, setActivePayment] = useState<PaymentDto | null>(null);
  const [stepUpData, setStepUpData] = useState<{
    action: "SIGN_CONTRACT" | "APPROVE_REFUND" | "RESPOND_DEDUCTION" | "RESOLVE_DISPUTE" | "EXTEND_DUE";
    title: string;
    onSuccess: (stepUpToken: string) => Promise<void>;
  } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const syncHash = () => {
      const hash = window.location.hash.replace("#", "") as ContractTabKey;
      if (VALID_TABS.includes(hash)) setActiveTab(hash);
    };
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  const switchTab = (tab: ContractTabKey) => {
    setActiveTab(tab);
    window.location.hash = tab;
  };

  const runSafe = async (fn: () => Promise<void>, fallbackMsg: string) => {
    setActionError(null);
    try {
      await fn();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : fallbackMsg);
    }
  };

  if (loading || error || !contract) {
    return (
      <div className="min-h-screen bg-paper flex flex-col">
        <AppNavbar />
        <main className="mx-auto max-w-6xl w-full px-4 sm:px-6 py-8">
          {loading ? (
            <LoadingSkeleton lines={6} />
          ) : (
            <ErrorState message={error || "Hợp đồng không tồn tại"} onRetry={loadContract} />
          )}
        </main>
      </div>
    );
  }

  const effectiveRole = contract.myRole || role;
  const isTenant = effectiveRole === "TENANT";
  const isLandlord = effectiveRole === "LANDLORD";
  const isDisputed =
    contract.depositStatus === "PENDING_DISPUTE" ||
    (contract.disputeStatus !== "NONE" && contract.disputeStatus !== "RESOLVED");
  const confirmedTx = onchainTxs.find((t) => t.status === "CONFIRMED");

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <AppNavbar />

      <main className="flex-1 mx-auto max-w-6xl w-full px-4 sm:px-6 py-6 sm:py-8 space-y-5 min-w-0">
        {actionError && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-2xl border border-brick/30 bg-brick/10 px-4 py-3 text-xs sm:text-sm text-brick-ink"
          >
            <span>{actionError}</span>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="text-xs font-bold hover:underline cursor-pointer"
            >
              Đóng
            </button>
          </div>
        )}

        <ContractHeader
          contract={contract}
          activeTab={activeTab}
          isTenant={isTenant}
          hasConfirmedOnchain={Boolean(confirmedTx)}
          onSwitchTab={switchTab}
          onOpenDrawer={() => setDrawerOpen(true)}
          onConfirmContract={() =>
            setStepUpData({
              action: "SIGN_CONTRACT",
              title: "Ký xác nhận hợp đồng thuê",
              onSuccess: (token) =>
                runSafe(async () => {
                  await apiClient.confirmContract(id, token);
                  await loadContract();
                  switchTab("tien-coc");
                }, "Ký hợp đồng thất bại"),
            })
          }
        />

        <ContractTabs activeTab={activeTab} onSwitchTab={switchTab} />

        {activeTab === "tong-quan" && <OverviewTab contract={contract} isTenant={isTenant} />}

        {activeTab === "tien-coc" && (
          <DepositTab
            contract={contract}
            confirmedTx={confirmedTx}
            isTenant={isTenant}
            onPayDeposit={() =>
              runSafe(
                async () => setActivePayment(await apiClient.createDepositPayment(id)),
                "Lỗi tạo thanh toán cọc",
              )
            }
          />
        )}

        {activeTab === "tien-thue" && (
          <RentAndChargesTab
            contract={contract}
            isTenant={isTenant}
            isLandlord={isLandlord}
            onPayRent={(periodNo) =>
              runSafe(
                async () => setActivePayment(await apiClient.createRentPayment(id, periodNo)),
                "Lỗi tạo thanh toán tiền thuê",
              )
            }
            onExtendDue={(periodNo, newDueDate, resetForm) =>
              setStepUpData({
                action: "EXTEND_DUE",
                title: "Xác nhận gia hạn thanh toán",
                onSuccess: (token) =>
                  runSafe(async () => {
                    await apiClient.extendDue(id, periodNo, newDueDate, token);
                    resetForm();
                    await loadContract();
                  }, "Gia hạn thất bại"),
              })
            }
            onCreateCharge={async (payload) => {
              await apiClient.createCharge(id, payload);
              await loadContract();
            }}
            onMarkChargePaid={(chargeId) =>
              runSafe(async () => {
                await apiClient.markChargePaid(id, chargeId);
                await loadContract();
              }, "Cập nhật khoản phí thất bại")
            }
          />
        )}

        {activeTab === "hoan-coc" && (
          <RefundAndDisputeTab
            contract={contract}
            isTenant={isTenant}
            isLandlord={isLandlord}
            isDisputed={isDisputed}
            onApproveRefund={(amount) =>
              setStepUpData({
                action: "APPROVE_REFUND",
                title: "Xác nhận số tiền hoàn cọc",
                onSuccess: (token) =>
                  runSafe(async () => {
                    await apiClient.approveRefund(id, amount, token);
                    await loadContract();
                  }, "Duyệt hoàn cọc thất bại"),
              })
            }
            onProposeDeduction={(amount, reason) =>
              runSafe(async () => {
                await apiClient.proposeDeduction(id, amount, reason);
                await loadContract();
              }, "Lỗi gửi đề xuất khấu trừ")
            }
            onRespondDeduction={(deductionId, accept) =>
              setStepUpData({
                action: "RESPOND_DEDUCTION",
                title: accept ? "Đồng ý khấu trừ tiền cọc" : "Từ chối khấu trừ & Mở tranh chấp",
                onSuccess: (token) =>
                  runSafe(async () => {
                    await apiClient.respondDeduction(deductionId, accept, token);
                    await loadContract();
                  }, "Phản hồi khấu trừ thất bại"),
              })
            }
            onOpenDispute={(note) =>
              runSafe(async () => {
                await apiClient.openDispute(id, note);
                await loadContract();
              }, "Lỗi mở tranh chấp")
            }
            onResolveDispute={(agreedAmount) =>
              setStepUpData({
                action: "RESOLVE_DISPUTE",
                title: "Xác nhận số tiền đồng thuận",
                onSuccess: (token) =>
                  runSafe(async () => {
                    await apiClient.resolveDispute(id, agreedAmount, token);
                    await loadContract();
                  }, "Chốt tranh chấp thất bại"),
              })
            }
          />
        )}

        {activeTab === "bang-chung" && (
          <OnchainProofTab contract={contract} onchainTxs={onchainTxs} />
        )}
      </main>

      {activePayment && (
        <PaymentModal
          payment={activePayment}
          roomLabel={contract.roomLabel}
          onSuccess={loadContract}
          onClose={() => setActivePayment(null)}
        />
      )}

      {stepUpData && (
        <StepUpModal
          action={stepUpData.action}
          title={stepUpData.title}
          onSuccess={async (token) => {
            const fn = stepUpData.onSuccess;
            setStepUpData(null);
            await fn(token);
          }}
          onCancel={() => setStepUpData(null)}
        />
      )}

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

export default function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-paper flex flex-col">
          <main className="mx-auto max-w-6xl w-full px-4 sm:px-6 py-8">
            <LoadingSkeleton lines={6} />
          </main>
        </div>
      }
    >
      <ResolvedContractDetail params={params} />
    </React.Suspense>
  );
}
