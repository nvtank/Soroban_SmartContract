import { HeroSection } from "@/components/marketing/HeroSection";
import { ProblemSection } from "@/components/marketing/ProblemSection";
import { SolutionSection } from "@/components/marketing/SolutionSection";
import { HowItWorksSection } from "@/components/marketing/HowItWorksSection";
import { BlockchainSection } from "@/components/marketing/BlockchainSection";
import { ComparisonSection } from "@/components/marketing/ComparisonSection";
import { CtaSection } from "@/components/marketing/CtaSection";
import { ContinuousThread } from "@/components/motion/ContinuousThread";

export default function MarketingPage() {
  return (
    <main id="marketing-container" className="relative flex flex-col w-full">
      {/* Sợi chỉ DrawSVG scrub chạy xuyên suốt từ Hero đến mục Dùng thử */}
      <ContinuousThread />

      {/* Hero Section */}
      <HeroSection />

      {/* Chương 01: Vấn đề (Nỗi đau thực tế & Số liệu FACTS) */}
      <ProblemSection />

      {/* Chương 02: Giải pháp (Chuyển cảnh cuộn ngang lật Vấn đề ⇄ Giải pháp) */}
      <SolutionSection />

      {/* Chương 03: Cách hoạt động (5 bước, Két cọc 2 chìa khóa, JourneyStepper) */}
      <HowItWorksSection />

      {/* Chương 04: Vai trò của Blockchain (Kéo thả dữ liệu, Marquee Testnet thật, OnchainStamp) */}
      <BlockchainSection />

      {/* Chương 05: So sánh (Bảng so sánh 4 mô hình, cột RentFlow nổi bật) */}
      <ComparisonSection />

      {/* Chương 06: Dùng thử ngay (Thẻ Chủ nhà / Người thuê, Kịch bản demo) */}
      <CtaSection />
    </main>
  );
}
