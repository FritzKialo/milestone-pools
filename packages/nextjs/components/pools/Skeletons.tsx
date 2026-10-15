export const CardSkeleton = () => (
  <div className="surface overflow-hidden" aria-hidden="true">
    <div className="skeleton h-28 w-full rounded-none" />
    <div className="space-y-3 p-5">
      <div className="flex justify-between">
        <div className="skeleton h-4 w-20" />
        <div className="skeleton h-5 w-16" />
      </div>
      <div className="skeleton h-5 w-4/5" />
      <div className="space-y-2">
        <div className="skeleton h-3.5 w-full" />
        <div className="skeleton h-3.5 w-3/4" />
      </div>
      <div className="skeleton h-2.5 w-full" />
      <div className="flex justify-between">
        <div className="skeleton h-4 w-28" />
        <div className="skeleton h-4 w-16" />
      </div>
    </div>
  </div>
);

export const CardGridSkeleton = ({ count = 6 }: { count?: number }) => (
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Loading initiatives">
    {Array.from({ length: count }, (_, i) => (
      <CardSkeleton key={i} />
    ))}
  </div>
);
