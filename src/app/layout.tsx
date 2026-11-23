import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import { DemoBanner } from "@/components/layout/DemoBanner";
import { SiteProviders } from "@/components/layout/SiteProviders";
import { vi } from "@/i18n/vi";
import "./globals.css";

const beVietnam = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: vi.meta.title,
  description: vi.meta.description,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${beVietnam.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <DemoBanner />
        <SiteProviders>{children}</SiteProviders>
      </body>
    </html>
  );
}
