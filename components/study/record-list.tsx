import Link from "next/link";
import type { StudyRecord } from "@/lib/model";
import type { LearningFeedback } from "@/lib/learning-feedback";
import { dateLabel } from "@/lib/model";
import { recordKindLabel } from "@/lib/record-filters";
import { outputLabel } from "@/lib/ratings";
export function RecordList({
  records,
  themes,
  items = [],
  feedbacks = [],
  showTheme = false,
  unwrapped = false,
}: {
  records: StudyRecord[];
  themes: { id: string; name: string }[];
  items?: { id: string; title: string }[];
  feedbacks?: LearningFeedback[];
  showTheme?: boolean;
  unwrapped?: boolean;
}) {
  const entries = [...records]
    .sort((a, b) => b.studiedAt.localeCompare(a.studiedAt))
    .map((record) => (
      <li key={record.id}>
        <time dateTime={record.studiedAt}>
          {dateLabel(record.studiedAt, true)}
        </time>
        <div>
          {showTheme && (
            <Link
              className="record-theme"
              href={`/themes/${encodeURIComponent(record.themeId)}`}
            >
              {themes.find((theme) => theme.id === record.themeId)?.name}
            </Link>
          )}
          <div className="record-meta">
            <span className="record-kind" data-kind={record.activity}>
              {recordKindLabel(record)}
            </span>
            <span>
              {record.targetType === "item"
                ? (items.find((item) => item.id === record.targetId)?.title ??
                  "学習項目")
                : "テーマ全体"}
            </span>
            {record.activity === "output" && (
              <span>完成度 · {outputLabel(record.outputRating)}</span>
            )}
            {record.completion !== undefined && (
              <span className="legacy-rating">旧評価 {record.completion}%</span>
            )}
            {feedbacks.some((entry) => entry.recordId === record.id) && (
              <span>AIフィードバック</span>
            )}
          </div>
          {record.activity === "output" && record.title && (
            <strong className="record-output-title">{record.title}</strong>
          )}
          <p className="record-excerpt">
            <Link href={`/records/${record.id}`}>
              {record.question ?? record.note}
            </Link>
          </p>
          <Link className="record-open" href={`/records/${record.id}`}>
            記録を開く
          </Link>
        </div>
      </li>
    ));
  return unwrapped ? (
    <>{entries}</>
  ) : (
    <ol className="record-list">{entries}</ol>
  );
}
