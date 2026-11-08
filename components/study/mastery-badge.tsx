import type { FourLevel } from "@/lib/model";
import { masteryLabel } from "@/lib/ratings";
export function MasteryBadge({
  level,
  id,
  label,
}: {
  level?: FourLevel;
  id?: string;
  label?: string;
}) {
  return (
    <span
      id={id}
      className="mastery-badge"
      data-level={level ?? "unrated"}
      aria-label={label ? `${label}：${masteryLabel(level)}` : undefined}
    >
      {masteryLabel(level)}
    </span>
  );
}
