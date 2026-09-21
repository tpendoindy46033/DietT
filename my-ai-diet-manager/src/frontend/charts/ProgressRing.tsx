const SIZE = 180;
const CENTER = SIZE / 2;
const RADIUS = 74;
const STROKE = 16;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ProgressRing({
  value,
  target,
  label,
  overLabel = "over target"
}: {
  value: number;
  target: number;
  label: string;
  overLabel?: string;
}) {
  const ratio = target > 0 ? value / target : 0;
  const clamped = Math.min(Math.max(ratio, 0), 1);
  const isOver = ratio > 1;
  const dash = clamped * CIRCUMFERENCE;
  const color = isOver ? "var(--color-carb)" : "var(--color-accent)";

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label={`${Math.round(value)} of ${Math.round(target)} ${label}`}
      style={{ width: "100%", maxWidth: 200, height: "auto" }}
    >
      <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke="var(--color-border)" strokeWidth={STROKE} />
      <circle
        cx={CENTER}
        cy={CENTER}
        r={RADIUS}
        fill="none"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
        transform={`rotate(-90 ${CENTER} ${CENTER})`}
      />
      <text x={CENTER} y={CENTER - 8} textAnchor="middle" fontSize={30} fontWeight={700} fill="var(--color-text)" className="tabular">
        {Math.round(value)}
      </text>
      <text x={CENTER} y={CENTER + 16} textAnchor="middle" fontSize={11} fill="var(--color-text-muted)">
        of {Math.round(target)} {label}
      </text>
      {isOver && (
        <text x={CENTER} y={CENTER + 34} textAnchor="middle" fontSize={10} fill="var(--color-carb)">
          {Math.round(value - target)} {overLabel}
        </text>
      )}
    </svg>
  );
}
