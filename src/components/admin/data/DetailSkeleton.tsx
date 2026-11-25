export function DetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Đang tải chi tiết" className="space-y-5">
      <div className="space-y-2">
        <div className="h-4 w-32 animate-pulse rounded bg-ink/10" />
        <div className="h-8 w-64 animate-pulse rounded bg-ink/10" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl border border-line bg-paper" />
        ))}
      </div>
      <div className="h-52 animate-pulse rounded-3xl border border-line bg-paper" />
      <div className="h-64 animate-pulse rounded-3xl border border-line bg-paper" />
    </div>
  );
}

export function TablePageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Đang tải danh sách" className="space-y-5">
      <div className="space-y-2">
        <div className="h-8 w-52 animate-pulse rounded bg-ink/10" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded bg-ink/10" />
      </div>
      <div className="h-16 animate-pulse rounded-2xl border border-line bg-paper" />
      <div className="h-80 animate-pulse rounded-2xl border border-line bg-paper" />
    </div>
  );
}
