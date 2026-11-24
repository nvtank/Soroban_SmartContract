import { Hero } from "@/components/landing/Hero";
import { Problem } from "@/components/landing/Problem";
import { Solution } from "@/components/landing/Solution";
import { Journey } from "@/components/landing/Journey";
import { Proof } from "@/components/landing/Proof";
import { Truth } from "@/components/landing/Truth";
import { Cta } from "@/components/landing/Cta";

/**
 * Trang chủ kể chuyện 7 chương. Chiếc chìa khóa nối các chương:
 * hero xoay chìa rồi rơi xuống, chương 3 hai chìa cùng mở két, chương 5 hóa thành con dấu,
 * chương 7 mỗi vai cầm một chìa.
 */
export default function MarketingPage() {
  return (
    <main id="marketing-container" className="relative w-full overflow-x-clip">
      <Hero />
      <Problem />
      <Solution />
      <Journey />
      <Proof />
      <Truth />
      <Cta />
    </main>
  );
}
