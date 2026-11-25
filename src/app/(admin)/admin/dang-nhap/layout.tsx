import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Đăng nhập quản trị · RentFlow" };

export default function AdminLoginLayout({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-[calc(100dvh-var(--demo-banner-h,0px))] flex-1 place-items-center bg-[radial-gradient(ellipse_at_top,var(--surface),transparent_75%)] px-4 py-10 sm:px-8 sm:py-16">
      {children}
    </main>
  );
}
