import { HeroSection } from "@/components/marketing/HeroSection";
import { ProblemSection } from "@/components/marketing/ProblemSection";
import { SolutionSection } from "@/components/marketing/SolutionSection";
import { HowItWorksSection } from "@/components/marketing/HowItWorksSection";
import { BlockchainSection } from "@/components/marketing/BlockchainSection";
import { TruthSection } from "@/components/marketing/TruthSection";
import { CtaSection } from "@/components/marketing/CtaSection";
import { KeyMotifConnector } from "@/components/motion/KeyMotifConnector";

export default function MarketingPage() {
  return (
    <main id="marketing-container" className="relative flex flex-col w-full overflow-x-hidden">
      {/* Chương 01: Mở đầu (#mo-dau) — Điểm tựa niềm tin */}
      <HeroSection />
      <KeyMotifConnector chapter={1} />

      {/* Chương 02: Vấn đề (#van-de) — Ba nỗi đau thực tế */}
      <ProblemSection />
      <KeyMotifConnector chapter={2} />

      {/* Chương 03: Giải pháp (#giai-phap) — Két cọc 2 chìa khóa */}
      <SolutionSection />
      <KeyMotifConnector chapter={3} />

      {/* Chương 04: Hành trình (#hanh-trinh) — 5 bước minh bạch */}
      <HowItWorksSection />
      <KeyMotifConnector chapter={4} />

      {/* Chương 05: Bằng chứng (#on-chain) — Dấu vết trên Stellar Testnet */}
      <BlockchainSection />
      <KeyMotifConnector chapter={5} />

      {/* Chương 06: Sự thật (#su-that) — Ranh giới Thật vs Mô phỏng */}
      <TruthSection />
      <KeyMotifConnector chapter={6} />

      {/* Chương 07: Dùng thử (#dung-thu) — Lời mời trải nghiệm */}
      <CtaSection />
    </main>
  );
}
