"use client";

import { useState } from "react";
import Link from "next/link";
import { marketingVi } from "@/i18n/sections/marketing";
import { JourneyStepper } from "@/components/shared/JourneyStepper";
import { DepositSafe, type DepositSafeState } from "@/components/motion/DepositSafe";
import { ArrowRight, ShieldAlert } from "lucide-react";
import type { JourneyStep } from "@/domain/dto";

export function HowItWorksSection() {
  const steps = marketingVi.chapter03.steps;
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);

  const currentStepData = steps[activeStepIndex] ?? steps[0];
  const currentStepId = currentStepData.step as JourneyStep;

  // Chuyển đổi trạng thái két cọc theo bước hiện tại
  let safeState: DepositSafeState = "UNPAID";
  if (currentStepId === "SIGN") {
    safeState = "UNPAID";
  } else if (currentStepId === "DEPOSIT" || currentStepId === "RENT") {
    safeState = "RECORDED";
  } else if (currentStepId === "SETTLE") {
    safeState = "REFUNDED";
  } else if (currentStepId === "DISPUTE") {
    safeState = "DISPUTE";
  }

  const handleManualSafeState = (st: DepositSafeState) => {
    if (st === "RECORDED") setActiveStepIndex(1);
    else if (st === "REFUNDED") setActiveStepIndex(3);
    else if (st === "DISPUTE") setActiveStepIndex(4);
    else setActiveStepIndex(0);
  };

  return (
    <section id="cach-hoat-dong" className="relative py-20 sm:py-28 overflow-hidden scroll-mt-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Tiêu đề chương 03 */}
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-primary-strong uppercase">
            <span className="font-mono text-base">{marketingVi.chapter03.number}</span>
            <span>•</span>
            <span>{marketingVi.chapter03.subtitle}</span>
          </div>
          <h2 className="mt-2 text-[length:var(--text-section)] font-extrabold leading-tight text-ink">
            {marketingVi.chapter03.title}
          </h2>
          <p className="mt-3 text-base sm:text-lg text-ink/75">
            {marketingVi.chapter03.description}
          </p>
        </div>

        {/* Stepper dùng chung (JourneyStepper) hiển thị tiến trình */}
        <div className="mt-10">
          <JourneyStepper
            current={currentStepId}
            disputed={currentStepId === "DISPUTE"}
          />
        </div>

        {/* Khung tương tác chính: Két cọc (Trái) & Chi tiết bước nghiệp vụ (Phải) */}
        <div className="mt-10 grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-12">
          {/* Cột trái: Két cọc hai chìa khóa trung tâm (DepositSafe) */}
          <div className="flex flex-col items-center justify-center rounded-3xl border border-line bg-paper p-6 sm:p-8 shadow-soft lg:col-span-5">
            <DepositSafe
              state={safeState}
              amount={12000000}
              onSelectState={handleManualSafeState}
            />
          </div>

          {/* Cột phải: Thẻ nội dung chi tiết bước đang chọn */}
          <div className="flex flex-col rounded-3xl border border-line bg-paper p-6 sm:p-10 shadow-soft lg:col-span-7">
            {/* Bộ chọn bước (Step Pills) */}
            <div className="flex flex-wrap gap-2 border-b border-line pb-6">
              {steps.map((st, idx) => {
                const isActive = activeStepIndex === idx;
                const isDispute = st.step === "DISPUTE";

                return (
                  <button
                    key={st.step}
                    type="button"
                    onClick={() => setActiveStepIndex(idx)}
                    className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                      isActive
                        ? isDispute
                          ? "bg-brick text-paper shadow-sm"
                          : "bg-primary text-paper shadow-sm"
                        : "bg-surface text-ink/70 hover:bg-line/30"
                    }`}
                    data-cursor-hover="true"
                  >
                    <span>{st.stepNumber}</span>
                    <span>{st.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Chi tiết nội dung bước đang chọn */}
            <div className="mt-6 flex flex-col gap-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-primary-strong uppercase tracking-wider">
                  Bước {currentStepData.stepNumber} / 05
                </span>
                {currentStepId === "DISPUTE" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-brick/15 px-2.5 py-0.5 text-xs font-bold text-brick-ink">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    <span>Trạng thái khóa an toàn</span>
                  </span>
                )}
              </div>

              <h3 className="text-2xl sm:text-3xl font-extrabold text-ink">
                {currentStepData.name}
              </h3>

              <p className="text-base font-semibold text-primary-strong">
                {currentStepData.shortDesc}
              </p>

              <p className="text-sm sm:text-base leading-relaxed text-ink/80">
                {currentStepData.detail}
              </p>

              {/* Thông tin Soroban On-chain tương ứng */}
              <div className="mt-2 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs">
                <span className="font-bold text-primary-strong">Tác vụ Soroban trên Stellar Testnet:</span>
                <p className="mt-1 text-ink/80">{currentStepData.onchainAction}</p>
              </div>

              {/* Nút Deep-Link thử bước này trong demo */}
              <div className="mt-6 flex flex-wrap items-center gap-4 pt-4 border-t border-line/60">
                <Link
                  href={currentStepData.deepLink}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-paper shadow-sm hover:bg-primary-strong transition-colors"
                  data-cursor-hover="true"
                >
                  <span>Thử bước này trong demo</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>

                <span className="text-xs text-ink/60">
                  Chuyển hướng vào màn hình tương ứng với tài khoản demo
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Câu dẫn sang chương sau */}
        <div className="mt-12">
          <a
            href="#blockchain"
            className="inline-flex items-center text-sm sm:text-base font-bold text-primary-strong hover:underline"
          >
            {marketingVi.chapter03.nextBridge}
          </a>
        </div>
      </div>
    </section>
  );
}
