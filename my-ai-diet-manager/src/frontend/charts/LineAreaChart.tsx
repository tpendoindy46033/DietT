import { buildYScale, formatCompactNumber, hasNoData, CHART_COLORS } from "./chartUtils";
import { ChartFrame } from "./ChartFrame";

export interface LineSeries {
  key: string;
  label: string;
  color: string;
  values: number[];
  areaFill?: boolean;
}

const WIDTH = 480;
const HEIGHT = 220;
const PADDING = { top: 14, right: 8, bottom: 28, left: 34 };

export function LineAreaChart({
  labels,
  series,
  emptyMessage = "Log data over a few days to see a trend."
}: {
  labels: string[];
  series: LineSeries[];
  emptyMessage?: string;
}) {
  const allValues = series.flatMap((s) => s.values);
  const isEmpty = labels.length < 2 || hasNoData(allValues);
  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const scale = buildYScale(Math.max(...allValues, 1));

  const toX = (i: number) => (labels.length <= 1 ? 0 : (plotWidth * i) / (labels.length - 1));

  const labelStep = Math.max(1, Math.ceil(labels.length / 6));

  return (
    <ChartFrame viewBoxWidth={WIDTH} viewBoxHeight={HEIGHT} isEmpty={isEmpty} emptyMessage={emptyMessage} ariaLabel="Line chart">
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

        {series.map((s) => {
          const points = s.values.map((v, i) => [toX(i), scale.toY(v, plotHeight)] as const);
          const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
          const areaPath = `${linePath} L${points[points.length - 1][0].toFixed(1)},${plotHeight} L${points[0][0].toFixed(1)},${plotHeight} Z`;

          return (
            <g key={s.key}>
              {s.areaFill && <path d={areaPath} fill={s.color} opacity={0.16} />}
              <path d={linePath} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              {points.map((p, i) => (
                <circle key={i} cx={p[0]} cy={p[1]} r={2.5} fill={s.color} />
              ))}
            </g>
          );
        })}

        {labels.map((label, i) =>
          i % labelStep === 0 ? (
            <text key={label + i} x={toX(i)} y={plotHeight + 16} textAnchor="middle" fontSize={9} fill={CHART_COLORS.textFaint}>
              {label}
            </text>
          ) : null
        )}
      </g>
      {series.length > 1 && (
        <g transform={`translate(${PADDING.left}, ${HEIGHT - 4})`}>
          {series.map((s, i) => (
            <g key={s.key} transform={`translate(${i * 100}, 0)`}>
              <rect width={8} height={8} y={-8} rx={2} fill={s.color} />
              <text x={12} y={0} fontSize={9} fill={CHART_COLORS.text}>
                {s.label}
              </text>
            </g>
          ))}
        </g>
      )}
    </ChartFrame>
  );
}
