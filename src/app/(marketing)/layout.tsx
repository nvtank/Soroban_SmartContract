import type { ReactNode } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import "@/styles/marketing.css";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="paper-grain relative flex min-h-screen flex-col bg-paper text-ink selection:bg-primary/20 selection:text-primary-strong">
      <Navbar />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}
