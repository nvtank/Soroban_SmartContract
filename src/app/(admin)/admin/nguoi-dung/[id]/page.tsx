import { Suspense } from "react";
import { UserDetailView } from "@/components/admin/data/UserDetailView";
import { DetailSkeleton } from "@/components/admin/data/DetailSkeleton";

export default function AdminUserDetailPage({
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
      <UserDetailView params={params} />
    </Suspense>
  );
}
