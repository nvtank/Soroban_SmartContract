import Link from "next/link";
import { marketingVi } from "@/i18n/sections/marketing";
import { vi } from "@/i18n/vi";
import { ShieldCheck, ArrowUpRight } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface/80 text-ink/80 pt-16 pb-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4 lg:grid-cols-5">
          {/* Brand info */}
          <div className="flex flex-col gap-4 md:col-span-2">
            <Link href="/" className="flex items-center gap-2.5" data-cursor-hover="true">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-paper">
                <svg
                  className="h-6 w-6"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 2l-2 2m-1-1l-3 3m2 2l-3 3m-2-2l-3 3m2 2l-3 3" />
                  <circle cx="7.5" cy="16.5" r="4.5" />
                </svg>
              </div>
              <span className="font-sans text-2xl font-extrabold text-ink">{vi.brand.name}</span>
            </Link>
            <p className="max-w-md text-sm leading-relaxed text-ink/75">{marketingVi.footer.brandDesc}</p>
            <div className="flex items-center gap-2 rounded-xl border border-line bg-paper/60 px-3 py-2 text-xs text-primary-strong">
              <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
              <span>Stellar Ideathon — Track 4: Custody & Track 5: Soroban</span>
            </div>
          </div>

          {/* Navigation links */}
          <div className="flex flex-col gap-3">
            <span className="text-xs font-bold tracking-wider text-ink uppercase">
              {marketingVi.footer.navigation}
            </span>
            <ul className="flex flex-col gap-2 text-sm">
              <li>
                <Link href="/#van-de" className="hover:text-primary transition-colors" data-cursor-hover="true">
                  {marketingVi.nav.problem}
                </Link>
              </li>
              <li>
                <Link href="/#giai-phap" className="hover:text-primary transition-colors" data-cursor-hover="true">
                  {marketingVi.nav.solution}
                </Link>
              </li>
              <li>
                <Link href="/#cach-hoat-dong" className="hover:text-primary transition-colors" data-cursor-hover="true">
                  {marketingVi.nav.howItWorks}
                </Link>
              </li>
              <li>
                <Link href="/#blockchain" className="hover:text-primary transition-colors" data-cursor-hover="true">
                  {marketingVi.nav.blockchain}
                </Link>
              </li>
              <li>
                <Link href="/#so-sanh" className="hover:text-primary transition-colors" data-cursor-hover="true">
                  {marketingVi.nav.comparison}
                </Link>
              </li>
              <li>
                <Link href="/#dung-thu" className="hover:text-primary transition-colors" data-cursor-hover="true">
                  {marketingVi.nav.tryIt}
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal and Transparency */}
          <div className="flex flex-col gap-3">
            <span className="text-xs font-bold tracking-wider text-ink uppercase">{marketingVi.footer.legal}</span>
            <ul className="flex flex-col gap-2 text-sm">
              <li>
                <Link
                  href="/minh-bach"
                  className="font-bold text-primary-strong hover:underline flex items-center gap-1"
                  data-cursor-hover="true"
                >
                  <span>{marketingVi.footer.transparencyLink}</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </li>
              <li>
                <span className="text-xs text-ink/60">Không PII on-chain</span>
              </li>
              <li>
                <span className="text-xs text-ink/60">Két cọc 2 chìa khóa</span>
              </li>
              <li>
                <span className="text-xs text-ink/60">Không dùng AI phán xét</span>
              </li>
            </ul>
          </div>

          {/* Quick Demo Access */}
          <div className="flex flex-col gap-3">
            <span className="text-xs font-bold tracking-wider text-ink uppercase">Dùng thử nhanh</span>
            <ul className="flex flex-col gap-2 text-sm">
              <li>
                <Link
                  href="/dang-nhap?demo=landlord"
                  className="rounded-lg border border-line bg-paper px-3 py-2 text-xs font-semibold hover:border-primary transition-colors block"
                  data-cursor-hover="true"
                >
                  Đăng nhập vai Chủ nhà →
                </Link>
              </li>
              <li>
                <Link
                  href="/dang-nhap?demo=tenant"
                  className="rounded-lg border border-line bg-paper px-3 py-2 text-xs font-semibold hover:border-primary transition-colors block"
                  data-cursor-hover="true"
                >
                  Đăng nhập vai Người thuê →
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Disclaimer banner */}
        <div className="mt-12 rounded-2xl border border-dashed border-amber-ink/30 bg-amber/10 p-4 text-xs leading-relaxed text-amber-ink">
          <p className="font-semibold">{marketingVi.footer.demoNotice}:</p>
          <p className="mt-1 opacity-90">{marketingVi.footer.disclaimer}</p>
        </div>

        {/* Copyright */}
        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-line/60 pt-8 sm:flex-row text-xs text-ink/60">
          <p>{marketingVi.footer.copyright}</p>
          <p className="font-mono">Stellar Testnet • Soroban SDK • Next.js App Router</p>
        </div>
      </div>
    </footer>
  );
}
