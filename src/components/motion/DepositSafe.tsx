"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { MockBadge } from "@/components/shared/MockBadge";
import { MoneyAmount } from "@/components/shared/MoneyAmount";
import { KeyRound, Lock, Unlock, AlertOctagon, ShieldCheck } from "lucide-react";

export type DepositSafeState = "UNPAID" | "RECORDED" | "REFUNDED" | "DISPUTE";

export type DepositSafeProps = {
  state: DepositSafeState;
  amount?: string | number;
  className?: string;
  onSelectState?: (state: DepositSafeState) => void;
};

export function DepositSafe({
  state,
  amount = 10000000,
  className = "",
  onSelectState,
}: DepositSafeProps) {
  const safeDoorRef = useRef<SVGGElement>(null);
  const leftKeyRef = useRef<SVGGElement>(null);
  const rightKeyRef = useRef<SVGGElement>(null);
  const banknoteRef = useRef<SVGGElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const safeDoor = safeDoorRef.current;
    const leftKey = leftKeyRef.current;
    const rightKey = rightKeyRef.current;
    const banknote = banknoteRef.current;
    if (!safeDoor || !leftKey || !rightKey || !banknote) return;

    const tl = gsap.timeline();

    if (state === "UNPAID") {
      tl.to(safeDoor, { rotateY: 0, transformOrigin: "left center", duration: 0.4 })
        .to([leftKey, rightKey], { rotate: 0, opacity: 0.3, duration: 0.3 })
        .to(banknote, { y: -80, opacity: 0, duration: 0.3 });
    } else if (state === "RECORDED") {
      // Tiền VNĐ trượt vào trong két rồi cửa đóng lại
      tl.fromTo(
        banknote,
        { y: -60, opacity: 0, scale: 0.7 },
        { y: 0, opacity: 1, scale: 1, duration: 0.6, ease: "bounce.out" }
      )
        .to(safeDoor, { rotateY: 0, transformOrigin: "left center", duration: 0.4 })
        .to([leftKey, rightKey], { opacity: 0.7, rotate: 0, duration: 0.3 });
    } else if (state === "REFUNDED") {
      // Hai chìa khóa cùng xoay 90 độ và két mở bung ra
      tl.to(leftKey, { rotate: 90, opacity: 1, duration: 0.5, transformOrigin: "120px 140px" })
        .to(rightKey, { rotate: -90, opacity: 1, duration: 0.5, transformOrigin: "200px 140px" }, "<")
        .to(
          safeDoor,
          {
            rotateY: -65,
            transformOrigin: "left center",
            duration: 0.7,
            ease: "back.out(1.2)",
          },
          "-=0.2"
        )
        .to(banknote, { y: 20, opacity: 1, scale: 1.05, duration: 0.4 });
    } else if (state === "DISPUTE") {
      // Tranh chấp: Két đóng chặt, chìa khóa bị khóa ngược, hiệu ứng rung báo động
      tl.to(safeDoor, { rotateY: 0, duration: 0.3 })
        .to([leftKey, rightKey], { rotate: 45, opacity: 0.5, duration: 0.3 })
        .fromTo(
          safeDoor,
          { x: -4 },
          { x: 4, duration: 0.08, repeat: 5, yoyo: true, ease: "power1.inOut" }
        );
    }

    return () => {
      tl.kill();
    };
  }, [state]);

  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      {/* Vỏ ngoài và hình minh họa két sắt */}
      <div className="relative flex items-center justify-center rounded-3xl border-2 border-line bg-surface/80 p-6 shadow-xl backdrop-blur-md">
        <svg
          viewBox="0 0 320 280"
          className="h-60 w-60 sm:h-72 sm:w-72 overflow-visible"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="Két cọc hai chìa khóa Soroban"
        >
          {/* Thân két sắt (Safe Body) */}
          <rect
            x="30"
            y="30"
            width="260"
            height="220"
            rx="24"
            fill={state === "DISPUTE" ? "#faeae6" : "var(--paper)"}
            stroke={state === "DISPUTE" ? "var(--brick)" : "var(--ink)"}
            strokeWidth="4"
          />

          {/* Ngăn chứa bên trong két */}
          <rect
            x="48"
            y="48"
            width="224"
            height="184"
            rx="16"
            fill="var(--surface)"
            stroke="var(--line)"
            strokeWidth="2"
          />

          {/* Tờ tiền cọc (Banknote sliding inside) */}
          <g ref={banknoteRef}>
            <rect
              x="80"
              y="110"
              width="160"
              height="75"
              rx="8"
              fill="var(--primary)"
              stroke="var(--primary-strong)"
              strokeWidth="2.5"
            />
            <rect x="90" y="120" width="140" height="55" rx="4" fill="none" stroke="var(--paper)" strokeWidth="1.5" strokeDasharray="3 3" />
            <circle cx="160" cy="147.5" r="18" fill="var(--paper)" opacity="0.9" />
            <text
              x="160"
              y="153"
              textAnchor="middle"
              fill="var(--primary-strong)"
              fontSize="16"
              fontWeight="bold"
              fontFamily="sans-serif"
            >
              ₫
            </text>
          </g>

          {/* Cánh cửa két sắt xoay (Safe Door with GSAP 3D transform) */}
          <g ref={safeDoorRef}>
            <rect
              x="45"
              y="45"
              width="230"
              height="190"
              rx="18"
              fill="var(--paper)"
              stroke={state === "DISPUTE" ? "var(--brick)" : "var(--ink)"}
              strokeWidth="3.5"
              filter="drop-shadow(2px 6px 12px rgba(20,33,61,0.15))"
            />

            {/* Núm vặn trung tâm (Center Dial) */}
            <circle cx="160" cy="95" r="28" fill="var(--surface)" stroke="var(--ink)" strokeWidth="3" />
            <circle cx="160" cy="95" r="14" fill="var(--ink)" />
            <line x1="160" y1="72" x2="160" y2="78" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="160" y1="112" x2="160" y2="118" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="137" y1="95" x2="143" y2="95" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="177" y1="95" x2="183" y2="95" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" />

            {/* Ổ khóa 1 (Chủ nhà - Trái) */}
            <g>
              <rect x="95" y="150" width="45" height="40" rx="8" fill="var(--surface)" stroke="var(--line)" strokeWidth="2" />
              <circle cx="117.5" cy="165" r="5" fill="var(--ink)" />
              <line x1="117.5" y1="167" x2="117.5" y2="178" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" />
              <text x="117.5" y="202" textAnchor="middle" fontSize="9" fontWeight="bold" fill="var(--ink)" opacity="0.7">
                CHỦ NHÀ
              </text>
            </g>

            {/* Ổ khóa 2 (Người thuê - Phải) */}
            <g>
              <rect x="177.5" y="150" width="45" height="40" rx="8" fill="var(--surface)" stroke="var(--line)" strokeWidth="2" />
              <circle cx="200" cy="165" r="5" fill="var(--ink)" />
              <line x1="200" y1="167" x2="200" y2="178" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" />
              <text x="200" y="202" textAnchor="middle" fontSize="9" fontWeight="bold" fill="var(--ink)" opacity="0.7">
                NGƯỜI THUÊ
              </text>
            </g>

            {/* Chìa khóa trái (Landlord key) */}
            <g ref={leftKeyRef} className="origin-center transition-transform">
              <path
                d="M 117.5 130 L 117.5 160 M 117.5 145 L 126 145 M 117.5 152 L 123 152"
                stroke="var(--primary-strong)"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              <circle cx="117.5" cy="120" r="10" stroke="var(--primary-strong)" strokeWidth="3" fill="var(--paper)" />
            </g>

            {/* Chìa khóa phải (Tenant key) */}
            <g ref={rightKeyRef} className="origin-center transition-transform">
              <path
                d="M 200 130 L 200 160 M 200 145 L 191 145 M 200 152 L 194 152"
                stroke="var(--primary-strong)"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              <circle cx="200" cy="120" r="10" stroke="var(--primary-strong)" strokeWidth="3" fill="var(--paper)" />
            </g>
          </g>

          {/* Biểu tượng trạng thái tranh chấp nếu có */}
          {state === "DISPUTE" && (
            <g className="animate-pulse">
              <rect x="75" y="18" width="170" height="28" rx="6" fill="var(--brick)" />
              <text x="160" y="37" textAnchor="middle" fill="var(--paper)" fontSize="11" fontWeight="bold">
                KHÓA TRANH CHẤP
              </text>
            </g>
          )}
        </svg>

        {/* Huy hiệu mô phỏng nổi trên két */}
        <div className="absolute top-3 right-3">
          <MockBadge label="KÉT MÔ PHỎNG" />
        </div>
      </div>

      {/* Thông tin số tiền và trạng thái két */}
      <div className="flex flex-col items-center gap-1.5 text-center">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-ink/60 uppercase tracking-wider">Tiền cọc bảo chứng:</span>
          <MoneyAmount value={amount} size="lg" />
        </div>

        <div className="flex items-center gap-2 text-sm font-bold">
          {state === "RECORDED" && (
            <span className="flex items-center gap-1.5 text-primary-strong">
              <ShieldCheck className="h-4 w-4" />
              <span>Tiền cọc đã vào két (Khóa bảo chứng RECORDED)</span>
            </span>
          )}
          {state === "REFUNDED" && (
            <span className="flex items-center gap-1.5 text-primary-strong">
              <Unlock className="h-4 w-4" />
              <span>Hai chìa khóa cùng xoay — Két mở hoàn cọc (REFUNDED)</span>
            </span>
          )}
          {state === "DISPUTE" && (
            <span className="flex items-center gap-1.5 text-brick-ink">
              <AlertOctagon className="h-4 w-4 text-brick" />
              <span>Két bị khóa cứng: Chờ xử lý tranh chấp (PENDING_DISPUTE)</span>
            </span>
          )}
          {state === "UNPAID" && (
            <span className="flex items-center gap-1.5 text-ink/60">
              <Lock className="h-4 w-4" />
              <span>Chờ nạp cọc qua VietQR (UNPAID)</span>
            </span>
          )}
        </div>
      </div>

      {/* Bộ nút bấm thử nghiệm các trạng thái két (Interactive state selector) */}
      {onSelectState && (
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          <button
            type="button"
            onClick={() => onSelectState("RECORDED")}
            className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-all ${
              state === "RECORDED"
                ? "border-primary bg-primary text-paper"
                : "border-line bg-paper text-ink/80 hover:border-primary"
            }`}
            data-cursor-hover="true"
          >
            Đã nạp cọc (Khóa)
          </button>
          <button
            type="button"
            onClick={() => onSelectState("REFUNDED")}
            className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-all ${
              state === "REFUNDED"
                ? "border-primary bg-primary text-paper"
                : "border-line bg-paper text-ink/80 hover:border-primary"
            }`}
            data-cursor-hover="true"
          >
            Hai bên đồng thuận (Mở két)
          </button>
          <button
            type="button"
            onClick={() => onSelectState("DISPUTE")}
            className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-all ${
              state === "DISPUTE"
                ? "border-brick bg-brick text-paper"
                : "border-line bg-paper text-ink/80 hover:border-brick"
            }`}
            data-cursor-hover="true"
          >
            Bất đồng (Khóa đỏ)
          </button>
        </div>
      )}
    </div>
  );
}
