import { StatePanel } from "../components/StatePanel";

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  color: string;
}

const SIZE = 200;
const CENTER = SIZE / 2;
const RADIUS = 78;
const STROKE = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function Donut({
  slices,
  centerLabel,
  centerValue,
  emptyMessage = "No data yet for this period."
}: {
  slices: DonutSlice[];
  centerLabel: string;
  centerValue: string;
  emptyMessage?: string;
}) {
  const total = slices.reduce((sum, s) => sum + Math.max(s.value, 0), 0);

  if (total <= 0) {
    return <StatePanel icon="progress" title="Not enough data yet" description={emptyMessage} />;
  }

  let offset = 0;
  const segments = slices
    .filter((s) => s.value > 0)
    .map((s) => {
      const fraction = s.value / total;
      const dash = fraction * CIRCUMFERENCE;
      const segment = { ...s, fraction, dashArray: `${dash} ${CIRCUMFERENCE - dash}`, dashOffset: -offset };
      offset += dash;
      return segment;
    });

  return (
    <div className="stack" style={{ alignItems: "center", gap: "var(--space-4)" }}>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={`${centerLabel}: ${centerValue}`}
        style={{ width: "100%", maxWidth: 220, height: "auto" }}
      >
        <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke="var(--color-border)" strokeWidth={STROKE} />
        {segments.map((s) => (
          <circle
            key={s.key}
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke={s.color}
            strokeWidth={STROKE}
            strokeDasharray={s.dashArray}
            strokeDashoffset={s.dashOffset}
            transform={`rotate(-90 ${CENTER} ${CENTER})`}
            strokeLinecap="butt"
          />
        ))}
        <text x={CENTER} y={CENTER - 4} textAnchor="middle" fontSize={20} fontWeight={700} fill="var(--color-text)" className="tabular">
          {centerValue}
        </text>
        <text x={CENTER} y={CENTER + 16} textAnchor="middle" fontSize={10} fill="var(--color-text-faint)">
          {centerLabel}
        </text>
      </svg>
      <div className="macro-strip-legend" role="list">
        {slices.map((s) => (
          <span key={s.key} className="macro-legend-dot tabular" style={{ ["--dot-color" as string]: s.color }} role="listitem">
            {s.label} {total > 0 ? Math.round((Math.max(s.value, 0) / total) * 100) : 0}%
          </span>
        ))}
      </div>
    </div>
  );
}
