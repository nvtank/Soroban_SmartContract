import { Suspense } from "react";
import { PaymentsListView } from "@/components/admin/data/PaymentsListView";
import { TablePageSkeleton } from "@/components/admin/data/DetailSkeleton";

export default function AdminPaymentsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <TablePageSkeleton />
        </div>
      }
    >
      <PaymentsListView />
    </Suspense>
  );
}
