const WIDTH = 120;
const HEIGHT = 32;

export function Sparkline({ values, color = "var(--color-accent)" }: { values: number[]; color?: string }) {
  if (values.length < 2 || values.every((v) => v === 0)) {
    return (
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: "100%", maxWidth: WIDTH, height: "auto" }} aria-hidden="true">
        <line x1={0} y1={HEIGHT / 2} x2={WIDTH} y2={HEIGHT / 2} stroke="var(--color-border)" strokeWidth={2} strokeDasharray="3 3" />
      </svg>
    );
  }

  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const points = values.map((v, i) => {
    const x = (WIDTH * i) / (values.length - 1);
    const y = HEIGHT - ((v - min) / range) * (HEIGHT - 4) - 2;
    return [x, y] as const;
  });
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Trend sparkline" style={{ width: "100%", maxWidth: WIDTH, height: "auto" }}>
      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r={2.5} fill={color} />
    </svg>
  );
}
