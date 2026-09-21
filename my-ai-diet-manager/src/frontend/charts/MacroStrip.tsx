import { macroCalorieSplit } from "@shared/nutrition";
import { CHART_COLORS } from "./chartUtils";

export function MacroStrip({
  proteinGrams,
  carbohydrateGrams,
  fatGrams,
  showLegend = false
}: {
  proteinGrams: number;
  carbohydrateGrams: number;
  fatGrams: number;
  showLegend?: boolean;
}) {
  const split = macroCalorieSplit(proteinGrams, carbohydrateGrams, fatGrams);

  if (split.total <= 0) {
    return <div className="macro-strip" aria-hidden="true" />;
  }

  return (
    <div className="stack" style={{ gap: "var(--space-2)" }}>
      <div className="macro-strip" role="img" aria-label={`Protein ${Math.round(split.proteinPercent)}%, carbohydrate ${Math.round(split.carbohydratePercent)}%, fat ${Math.round(split.fatPercent)}%`}>
        <div style={{ width: `${split.proteinPercent}%`, background: CHART_COLORS.protein }} />
        <div style={{ width: `${split.carbohydratePercent}%`, background: CHART_COLORS.carb }} />
        <div style={{ width: `${split.fatPercent}%`, background: CHART_COLORS.fat }} />
      </div>
      {showLegend && (
        <div className="macro-strip-legend">
          <span className="macro-legend-dot" style={{ ["--dot-color" as string]: CHART_COLORS.protein }}>
            Protein {Math.round(split.proteinPercent)}%
          </span>
          <span className="macro-legend-dot" style={{ ["--dot-color" as string]: CHART_COLORS.carb }}>
            Carbs {Math.round(split.carbohydratePercent)}%
          </span>
          <span className="macro-legend-dot" style={{ ["--dot-color" as string]: CHART_COLORS.fat }}>
            Fat {Math.round(split.fatPercent)}%
          </span>
        </div>
      )}
    </div>
  );
}
