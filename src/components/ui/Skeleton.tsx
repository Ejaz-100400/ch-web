export function Skeleton({
  width = "100%",
  height = 14,
  radius = "var(--radius-sm)",
}: {
  width?: number | string;
  height?: number;
  radius?: number | string;
}) {
  return <span className="skeleton" style={{ display: "inline-block", width, height, borderRadius: radius }} />;
}

export function SkeletonRows({ rows = 5, height = 52 }: { rows?: number; height?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ padding: "12px 18px", display: "flex", alignItems: "center", gap: 14, height }}>
          <Skeleton width={30} height={30} radius={999} />
          <Skeleton width="30%" />
          <Skeleton width="15%" />
          <Skeleton width="20%" />
        </div>
      ))}
    </div>
  );
}
