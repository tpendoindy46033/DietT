import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export function StatePanel({
  icon,
  title,
  description,
  action,
  variant = "empty"
}: {
  icon: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
  variant?: "empty" | "error";
}) {
  return (
    <div className={`state-panel${variant === "error" ? " state-error" : ""}`}>
      <Icon name={icon} />
      <h3>{title}</h3>
      {description && <p className="text-sm">{description}</p>}
      {action}
    </div>
  );
}
