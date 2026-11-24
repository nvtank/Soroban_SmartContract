import React, { Suspense } from "react";
import { TourProvider } from "@/components/app/tour";

export default function ProtectedAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <TourProvider>{children}</TourProvider>
    </Suspense>
  );
}
