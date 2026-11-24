import Link from "next/link";
import { vi } from "@/i18n/vi";

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface/70 text-ink/80 py-10">
      <div className="mx-auto max-w-6xl px-6 lg:px-10 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Logo brand */}
          <Link
            href="/"
            className="font-sans text-xl font-extrabold text-ink hover:opacity-90 transition-opacity"
            data-cursor-hover="true"
          >
            <span>Rent</span>
            <span className="text-primary font-black">Flow</span>
          </Link>

          {/* 3 - 4 links tối giản */}
          <nav aria-label="Liên kết chân trang" className="flex flex-wrap items-center gap-5 sm:gap-7 text-xs sm:text-sm font-medium">
            <Link
              href="/minh-bach"
              className="text-ink/75 hover:text-primary transition-colors"
              data-cursor-hover="true"
            >
              Minh bạch
            </Link>
            <Link
              href="/bang-chung"
              className="text-ink/75 hover:text-primary transition-colors"
              data-cursor-hover="true"
            >
              Bằng chứng on-chain
            </Link>
            <Link
              href="/dang-nhap"
              className="text-ink/75 hover:text-primary transition-colors"
              data-cursor-hover="true"
            >
              Dùng thử
            </Link>
            <a
              href="https://github.com/stellar/soroban-examples"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink/75 hover:text-primary transition-colors"
              data-cursor-hover="true"
            >
              Mã nguồn
            </a>
          </nav>
        </div>

        <div className="border-t border-line/60 pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-ink/60">
          <p>
            Bản demo trên Stellar Testnet. Ngân hàng, VietQR, payOS và giải ngân là mô phỏng.
          </p>
          <p>© 2026 {vi.brand.name}</p>
        </div>
      </div>
    </footer>
  );
}
