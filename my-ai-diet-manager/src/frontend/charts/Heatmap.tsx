import { StatePanel } from "../components/StatePanel";
import { formatDateLabel } from "../lib/dates";

export interface HeatmapDay {
  date: string;
  logged: boolean;
}

const CELL = 14;
const GAP = 3;

export function Heatmap({ days, emptyMessage = "No history yet." }: { days: HeatmapDay[]; emptyMessage?: string }) {
  if (days.length === 0) {
    return <StatePanel icon="history" title="Not enough data yet" description={emptyMessage} />;
  }

  const firstDow = new Date(`${days[0].date}T00:00:00Z`).getUTCDay();
  const columns = Math.ceil((days.length + firstDow) / 7);
  const width = columns * (CELL + GAP) - GAP;
  const height = 7 * (CELL + GAP) - GAP + 4;

  return (
    <div className="heatmap-wrap">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Logging consistency over the last ${days.length} days`}
        style={{ width: "100%", maxWidth: width, height: "auto" }}
      >
        {days.map((day, i) => {
          const gridIndex = i + firstDow;
          const col = Math.floor(gridIndex / 7);
          const row = gridIndex % 7;
          return (
            <rect
              key={day.date}
              x={col * (CELL + GAP)}
              y={row * (CELL + GAP)}
              width={CELL}
              height={CELL}
              rx={3}
              fill={day.logged ? "var(--color-accent)" : "var(--color-border)"}
              opacity={day.logged ? 1 : 0.6}
            >
              <title>
                {formatDateLabel(day.date, { weekday: true })}: {day.logged ? "logged" : "no entries"}
              </title>
            </rect>
          );
        })}
      </svg>
    </div>
  );
}
