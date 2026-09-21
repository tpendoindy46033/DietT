import { buildYScale, formatCompactNumber, hasNoData, CHART_COLORS } from "./chartUtils";
import { ChartFrame } from "./ChartFrame";

export interface StackedSeries {
  key: string;
  label: string;
  color: string;
}

export interface StackedDatum {
  label: string;
  values: Record<string, number>;
}

const WIDTH = 480;
const HEIGHT = 240;
const PADDING = { top: 14, right: 8, bottom: 40, left: 34 };

export function StackedBarChart({
  data,
  series,
  emptyMessage = "Log a few meals to see this chart."
}: {
  data: StackedDatum[];
  series: StackedSeries[];
  emptyMessage?: string;
}) {
  const totals = data.map((d) => series.reduce((sum, s) => sum + (d.values[s.key] ?? 0), 0));
  const isEmpty = hasNoData(totals);
  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const scale = buildYScale(Math.max(...totals, 1));

  const barSlot = plotWidth / Math.max(data.length, 1);
  const barWidth = Math.min(28, barSlot * 0.6);

  return (
    <ChartFrame viewBoxWidth={WIDTH} viewBoxHeight={HEIGHT} isEmpty={isEmpty} emptyMessage={emptyMessage} ariaLabel="Stacked bar chart">
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

        {data.map((d, i) => {
          const x = barSlot * i + (barSlot - barWidth) / 2;
          let cumulative = 0;
          return (
            <g key={d.label}>
              {series.map((s) => {
                const value = d.values[s.key] ?? 0;
                const yTop = scale.toY(cumulative + value, plotHeight);
                const yBottom = scale.toY(cumulative, plotHeight);
                cumulative += value;
                if (value <= 0) return null;
                return <rect key={s.key} x={x} y={yTop} width={barWidth} height={Math.max(yBottom - yTop, 0)} fill={s.color} />;
              })}
              <text x={x + barWidth / 2} y={plotHeight + 16} textAnchor="middle" fontSize={9} fill={CHART_COLORS.textFaint}>
                {d.label}
              </text>
            </g>
          );
        })}
      </g>
      <g transform={`translate(${PADDING.left}, ${HEIGHT - 14})`}>
        {series.map((s, i) => (
          <g key={s.key} transform={`translate(${i * 110}, 0)`}>
            <rect width={8} height={8} y={-6} rx={2} fill={s.color} />
            <text x={12} y={0} fontSize={9} fill={CHART_COLORS.text}>
              {s.label}
            </text>
          </g>
        ))}
      </g>
    </ChartFrame>
  );
}
