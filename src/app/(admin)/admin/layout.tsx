import { Suspense, type ReactNode } from "react";
import { AdminShell } from "@/components/admin/shell/AdminShell";
import "@/components/admin/shell/admin-shell.css";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div data-admin-area className="flex min-w-0 flex-1 flex-col">
      <Suspense>
        <AdminShell>{children}</AdminShell>
      </Suspense>
    </div>
  );
}
