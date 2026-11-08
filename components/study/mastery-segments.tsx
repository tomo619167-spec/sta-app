import { masteryOptions, type masteryCounts } from "@/lib/ratings";
type Counts = ReturnType<typeof masteryCounts>;
export function MasterySegments({
  counts,
  label,
  compact = false,
}: {
  counts: Counts;
  label: string;
  compact?: boolean;
}) {
  const description = [
    ...masteryOptions.map(
      (option) => `${option.label} ${counts[option.level]}項目`,
    ),
    `未評価 ${counts.unrated}項目`,
  ].join("、");
  return (
    <div className={`mastery-progress${compact ? " compact" : ""}`}>
      <div
        className="mastery-segments"
        role="img"
        aria-label={`${label}の習得状況：${description}`}
      >
        {[4, 3, 2, 1, "unrated"].map((key) => {
          const count = counts[key as 1 | 2 | 3 | 4 | "unrated"];
          return count > 0 ? (
            <span key={key} data-level={key} style={{ flex: count }} />
          ) : null;
        })}
      </div>
      {!compact && (
        <dl className="stage-counts">
          {[...masteryOptions].reverse().map((option) => (
            <div key={option.level}>
              <dt>
                <i data-level={option.level} />
                {option.label}
              </dt>
              <dd>
                {counts[option.level]}
                <small>項目</small>
              </dd>
            </div>
          ))}
          {counts.unrated > 0 && (
            <div>
              <dt>
                <i data-level="unrated" />
                未評価
              </dt>
              <dd>
                {counts.unrated}
                <small>項目</small>
              </dd>
            </div>
          )}
        </dl>
      )}
      {!counts.total && !compact && <p className="quiet-empty">学習項目なし</p>}
    </div>
  );
}
