import { Suspense } from "react";
import { ContractDetailView } from "@/components/admin/data/ContractDetailView";
import { DetailSkeleton } from "@/components/admin/data/DetailSkeleton";

export default function AdminContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <DetailSkeleton />
        </div>
      }
    >
      <ContractDetailView params={params} />
    </Suspense>
  );
}
