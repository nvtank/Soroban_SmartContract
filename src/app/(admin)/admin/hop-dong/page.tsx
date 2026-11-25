import { Suspense } from "react";
import { ContractsListView } from "@/components/admin/data/ContractsListView";
import { TablePageSkeleton } from "@/components/admin/data/DetailSkeleton";

export default function AdminContractsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <TablePageSkeleton />
        </div>
      }
    >
      <ContractsListView />
    </Suspense>
  );
}
