import { buildYScale, formatCompactNumber, hasNoData, CHART_COLORS } from "./chartUtils";
import { ChartFrame } from "./ChartFrame";

export interface BarChartDatum {
  label: string;
  value: number;
}

const WIDTH = 480;
const HEIGHT = 220;
const PADDING = { top: 14, right: 8, bottom: 26, left: 34 };

export function BarChart({
  data,
  target,
  color = CHART_COLORS.accent,
  unitLabel,
  emptyMessage = "Log a few meals to see this chart."
}: {
  data: BarChartDatum[];
  target?: number;
  color?: string;
  unitLabel?: string;
  emptyMessage?: string;
}) {
  const isEmpty = hasNoData(data.map((d) => d.value));
  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const dataMax = Math.max(...data.map((d) => d.value), target ?? 0, 1);
  const scale = buildYScale(dataMax);

  const barSlot = plotWidth / Math.max(data.length, 1);
  const barWidth = Math.min(36, barSlot * 0.55);

  return (
    <ChartFrame viewBoxWidth={WIDTH} viewBoxHeight={HEIGHT} isEmpty={isEmpty} emptyMessage={emptyMessage} ariaLabel="Bar chart">
      <g transform={`translate(${PADDING.left},${PADDING.top})`}>
        {scale.ticks.map((tick) => {
          const y = scale.toY(tick, plotHeight);
          return (
            <g key={tick}>
              <line x1={0} x2={plotWidth} y1={y} y2={y} stroke={CHART_COLORS.border} strokeWidth={1} />
              <text x={-8} y={y} textAnchor="end" dominantBaseline="middle" fontSize={9} fill={CHART_COLORS.textFaint}>
                {formatCompactNumber(tick)}
              </text>
            </g>
          );
        })}

        {target !== undefined && target > 0 && (
          <>
            <line
              x1={0}
              x2={plotWidth}
              y1={scale.toY(target, plotHeight)}
              y2={scale.toY(target, plotHeight)}
              stroke={color}
              strokeWidth={1.5}
              strokeDasharray="5 4"
            />
          </>
        )}

        {data.map((d, i) => {
          const x = barSlot * i + (barSlot - barWidth) / 2;
          const y = scale.toY(d.value, plotHeight);
          const h = plotHeight - y;
          return (
            <g key={d.label}>
              <rect x={x} y={y} width={barWidth} height={Math.max(h, 0)} rx={4} fill={color} />
              <text x={x + barWidth / 2} y={plotHeight + 16} textAnchor="middle" fontSize={9} fill={CHART_COLORS.textFaint}>
                {d.label}
              </text>
            </g>
          );
        })}
      </g>
      {unitLabel && (
        <text x={WIDTH - 4} y={12} textAnchor="end" fontSize={9} fill={CHART_COLORS.textFaint}>
          {unitLabel}
        </text>
      )}
    </ChartFrame>
  );
}
