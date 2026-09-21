export function Skeleton({ width = "100%", height = 16, radius = 8 }: { width?: number | string; height?: number; radius?: number }) {
  return <div className="skeleton" style={{ width, height, borderRadius: radius }} aria-hidden="true" />;
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card stack" aria-hidden="true">
      <Skeleton width="40%" height={14} />
      <Skeleton width="70%" height={28} />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height={12} />
      ))}
    </div>
  );
}

export function SkeletonPage() {
  return (
    <div className="stack" role="status" aria-label="Loading">
      <SkeletonCard />
      <SkeletonCard lines={2} />
      <SkeletonCard lines={4} />
    </div>
  );
}
