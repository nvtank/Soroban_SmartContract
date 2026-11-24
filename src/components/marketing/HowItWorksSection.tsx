"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { marketingVi } from "@/i18n/sections/marketing";
import { JourneyStepper } from "@/components/shared/JourneyStepper";
import { DepositSafe, type DepositSafeState } from "@/components/motion/DepositSafe";
import { scrollTo } from "@/components/layout/SmoothScrollProvider";
import { ArrowRight, ShieldAlert } from "lucide-react";
import type { JourneyStep } from "@/domain/dto";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const STEP_DEEP_LINKS: Record<string, string> = {
  SIGN: "/dang-nhap?demo=landlord&next=/app/hop-dong/ct-001#tong-quan",
  DEPOSIT: "/dang-nhap?demo=tenant&next=/app/hop-dong/ct-001#tien-coc",
  RENT: "/dang-nhap?demo=tenant&next=/app/hop-dong/ct-002#tien-thue",
  SETTLE: "/dang-nhap?demo=landlord&next=/app/hop-dong/ct-002#hoan-coc",
  DISPUTE: "/dang-nhap?demo=tenant&next=/app/hop-dong/ct-003#hoan-coc",
};

export function HowItWorksSection() {
  const steps = marketingVi.chapter03.steps;
  const sectionRef = useRef<HTMLElement>(null);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const activeStepRef = useRef<number>(0);
  const scrollTriggerRef = useRef<ScrollTrigger | null>(null);

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

  // 12. Ghim toàn màn hình và cuộn scrub qua 5 bước trên Desktop
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const mm = gsap.matchMedia();

    // Chỉ ghim khi màn hình lớn, chiều cao >= 600px, con trỏ chính xác và không reduced motion
    mm.add(
      "(min-width: 1024px) and (min-height: 600px) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
      () => {
        const totalSteps = steps.length;
        const pinDistance = window.innerHeight * 2.5;

        const st = ScrollTrigger.create({
          trigger: section,
          start: "top top",
          end: () => `+=${pinDistance}`,
          pin: true,
          anticipatePin: 1,
          scrub: true,
          onUpdate: (self) => {
            // Tính bước hiện tại từ progress (0 đến 1)
            const stepIdx = Math.min(
              totalSteps - 1,
              Math.floor(self.progress * totalSteps)
            );
            // CHỈ cập nhật React khi thực sự đổi bước để tránh re-render mỗi frame cuộn!
            if (activeStepRef.current !== stepIdx) {
              activeStepRef.current = stepIdx;
              setActiveStepIndex(stepIdx);
            }
          },
        });

        scrollTriggerRef.current = st;
      }
    );

    return () => {
      mm.revert();
      scrollTriggerRef.current = null;
    };
  }, [steps.length]);

  // Bấm bước: nếu đang ghim thì cuộn tới đúng vị trí bước, nếu không thì đổi state ngay
  const handleSelectStep = (idx: number) => {
    const st = scrollTriggerRef.current;
    if (st) {
      const totalSteps = steps.length;
      const stepProgress = (idx + 0.5) / totalSteps;
      const targetScroll = st.start + stepProgress * (st.end - st.start);
      scrollTo(targetScroll);
    } else {
      activeStepRef.current = idx;
      setActiveStepIndex(idx);
    }
  };

  const handleManualSafeState = (st: DepositSafeState) => {
    if (st === "RECORDED") handleSelectStep(1);
    else if (st === "REFUNDED") handleSelectStep(3);
    else if (st === "DISPUTE") handleSelectStep(4);
    else handleSelectStep(0);
  };

  const deepLink = STEP_DEEP_LINKS[currentStepId] || currentStepData.deepLink;

  return (
    <section
      ref={sectionRef}
      id="cach-hoat-dong"
      className="relative min-h-screen py-16 sm:py-24 overflow-hidden flex flex-col justify-center"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 w-full">
        {/* Tiêu đề chương 03 */}
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-primary-strong uppercase">
            <span className="font-mono text-base">{marketingVi.chapter03.number}</span>
            <span>•</span>
            <span>{marketingVi.chapter03.subtitle}</span>
          </div>
          <h2 className="mt-1.5 text-[length:var(--text-section)] font-extrabold leading-tight text-ink">
            {marketingVi.chapter03.title}
          </h2>
          <p className="mt-2 text-base sm:text-lg text-ink/75">
            {marketingVi.chapter03.description}
          </p>
        </div>

        {/* Stepper dùng chung (JourneyStepper) */}
        <div className="mt-6">
          <JourneyStepper
            current={currentStepId}
            disputed={currentStepId === "DISPUTE"}
          />
        </div>

        {/* Khung tương tác chính: Két cọc (Trái) & Chi tiết bước (Phải) */}
        <div className="mt-8 grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-10">
          {/* Cột trái: Két cọc hai chìa khóa trung tâm (DepositSafe) */}
          <div className="flex flex-col items-center justify-center rounded-3xl border border-line bg-paper p-5 sm:p-7 shadow-soft lg:col-span-5">
            <DepositSafe
              state={safeState}
              amount={12000000}
              onSelectState={handleManualSafeState}
            />
          </div>

          {/* Cột phải: Thẻ nội dung chi tiết bước */}
          <div className="flex flex-col rounded-3xl border border-line bg-paper p-6 sm:p-8 shadow-soft lg:col-span-7">
            {/* Bộ chọn bước (Step Pills) */}
            <div className="flex flex-wrap gap-2 border-b border-line pb-4">
              {steps.map((st, idx) => {
                const isActive = activeStepIndex === idx;
                const isDispute = st.step === "DISPUTE";

                return (
                  <button
                    key={st.step}
                    type="button"
                    onClick={() => handleSelectStep(idx)}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
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
            <div className="mt-5 flex flex-col gap-3">
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

              <h3 className="text-xl sm:text-2xl font-extrabold text-ink">
                {currentStepData.name}
              </h3>

              <p className="text-sm font-semibold text-primary-strong">
                {currentStepData.shortDesc}
              </p>

              <p className="text-xs sm:text-sm leading-relaxed text-ink/80">
                {currentStepData.detail}
              </p>

              {/* Thông tin Soroban On-chain */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs">
                <span className="font-bold text-primary-strong">Tác vụ Soroban trên Stellar Testnet:</span>
                <p className="mt-0.5 text-ink/80">{currentStepData.onchainAction}</p>
              </div>

              {/* Nút Deep-Link thử bước này trong demo */}
              <div className="mt-4 flex flex-wrap items-center gap-4 pt-4 border-t border-line/60">
                <Link
                  href={deepLink}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-paper shadow-sm hover:bg-primary-strong transition-colors"
                  data-cursor-hover="true"
                >
                  <span>Thử bước này trong demo</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>

                <span className="text-xs text-ink/60">
                  Mở màn hình nghiệp vụ với tài khoản demo tương ứng
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Câu dẫn sang chương sau */}
        <div className="mt-8">
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
