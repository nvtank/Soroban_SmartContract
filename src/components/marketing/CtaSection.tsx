import Link from "next/link";
import { marketingVi } from "@/i18n/sections/marketing";
import { MockBadge } from "@/components/shared/MockBadge";
import { MagneticButton } from "@/components/motion/MagneticButton";
import { ArrowRight, Check, Key, UserCheck, ShieldCheck, FileText } from "lucide-react";

export function CtaSection() {
  const cta = marketingVi.chapter06;

  return (
    <section id="dung-thu" className="relative py-20 sm:py-28 overflow-hidden scroll-mt-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Tiêu đề chương 06 */}
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-primary-strong uppercase">
            <span className="font-mono text-base">{cta.number}</span>
            <span>•</span>
            <span>{cta.subtitle}</span>
          </div>
          <h2 className="mt-2 text-[length:var(--text-section)] font-extrabold leading-tight text-ink">
            {cta.title}
          </h2>
          <p className="mt-3 text-base sm:text-lg text-ink/75">
            {cta.description}
          </p>
        </div>

        {/* Hai thẻ lớn: Chủ nhà / Người thuê */}
        <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2">
          {/* Thẻ 1: Tôi là Chủ nhà */}
          <div className="flex flex-col justify-between rounded-3xl border-2 border-line bg-paper p-8 shadow-soft transition-all hover:border-primary/60">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-primary-strong uppercase tracking-wider">
                  <Key className="h-4 w-4" />
                  <span>{cta.landlordCard.role}</span>
                </div>
                <MockBadge label={cta.landlordCard.badge} />
              </div>

              <h3 className="mt-4 text-2xl sm:text-3xl font-extrabold text-ink">
                {cta.landlordCard.title}
              </h3>

              <ul className="mt-6 flex flex-col gap-3 text-sm text-ink/80">
                {cta.landlordCard.benefits.map((b, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary-strong mt-0.5">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8 pt-6 border-t border-line/60">
              <MagneticButton
                href={cta.landlordCard.link}
                className="w-full rounded-2xl bg-primary py-4 text-center text-base font-bold text-paper shadow-md transition-all hover:bg-primary-strong"
                ariaLabel={cta.landlordCard.cta}
              >
                <span>{cta.landlordCard.cta}</span>
                <ArrowRight className="ml-2 h-4 w-4" />
              </MagneticButton>
            </div>
          </div>

          {/* Thẻ 2: Tôi là Người thuê */}
          <div className="flex flex-col justify-between rounded-3xl border-2 border-line bg-paper p-8 shadow-soft transition-all hover:border-primary/60">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-primary-strong uppercase tracking-wider">
                  <UserCheck className="h-4 w-4" />
                  <span>{cta.tenantCard.role}</span>
                </div>
                <MockBadge label={cta.tenantCard.badge} />
              </div>

              <h3 className="mt-4 text-2xl sm:text-3xl font-extrabold text-ink">
                {cta.tenantCard.title}
              </h3>

              <ul className="mt-6 flex flex-col gap-3 text-sm text-ink/80">
                {cta.tenantCard.benefits.map((b, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary-strong mt-0.5">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8 pt-6 border-t border-line/60">
              <MagneticButton
                href={cta.tenantCard.link}
                className="w-full rounded-2xl bg-primary py-4 text-center text-base font-bold text-paper shadow-md transition-all hover:bg-primary-strong"
                ariaLabel={cta.tenantCard.cta}
              >
                <span>{cta.tenantCard.cta}</span>
                <ArrowRight className="ml-2 h-4 w-4" />
              </MagneticButton>
            </div>
          </div>
        </div>

        {/* Điểm kết thúc của sợi chỉ & Kịch bản demo */}
        <div className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-line bg-surface/40 p-5 text-xs text-ink/70">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span>Sợi chỉ hành trình xuyên suốt kết nối trực tiếp vào các tài khoản thử nghiệm của ứng dụng.</span>
          </div>

          <Link
            href="/dang-nhap?demo=landlord"
            className="flex items-center gap-1 font-bold text-primary-strong hover:underline"
            data-cursor-hover="true"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>{cta.demoScriptLink}</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
