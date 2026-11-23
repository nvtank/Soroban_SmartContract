import React from "react";
import { SessionProvider } from "@/components/app/session-context";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
