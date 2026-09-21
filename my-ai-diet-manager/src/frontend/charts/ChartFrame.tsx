import type { ReactNode } from "react";
import { StatePanel } from "../components/StatePanel";

const MAX_RENDER_WIDTH = 640;

export function ChartFrame({
  viewBoxWidth,
  viewBoxHeight,
  isEmpty,
  emptyMessage,
  children,
  ariaLabel
}: {
  viewBoxWidth: number;
  viewBoxHeight: number;
  isEmpty: boolean;
  emptyMessage: string;
  children: ReactNode;
  ariaLabel: string;
}) {
  if (isEmpty) {
    return <StatePanel icon="progress" title="Not enough data yet" description={emptyMessage} />;
  }

  return (
    <svg
      viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
      role="img"
      aria-label={ariaLabel}
      style={{ width: "100%", maxWidth: MAX_RENDER_WIDTH, height: "auto", display: "block", margin: "0 auto" }}
    >
      {children}
    </svg>
  );
}
