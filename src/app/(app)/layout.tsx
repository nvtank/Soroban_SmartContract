import React, { Suspense } from "react";
import { SessionProvider } from "@/components/app/session-context";
import { MockBadge } from "@/components/shared";
import { appI18n } from "@/i18n/sections/app";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    // usePathname() trong SessionProvider cần Suspense để Next.js 16 prerender được trang.
    <Suspense fallback={null}>
      <SessionProvider>
        {process.env.NEXT_PUBLIC_UI_MOCK === "true" && (
          <div
            role="status"
            className="flex flex-wrap items-center justify-center gap-2 border-b border-amber/40 bg-amber/15 px-4 py-2 text-center text-base font-medium text-amber-ink"
          >
            <MockBadge />
            <span>{appI18n.mockPreview}</span>
          </div>
        )}
        {children}
      </SessionProvider>
    </Suspense>
  );
}
