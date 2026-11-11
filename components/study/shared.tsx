import type { LearningFeedback } from "@/lib/learning-feedback";
import Link from "next/link";
import { ArrowUpRight, BookOpen, ArrowLeft } from "lucide-react";
import { dateLabel, type StudyItem, type StudyRecord } from "@/lib/model";
import { masteryCounts, outputLabel } from "@/lib/ratings";
import type { MasteryChange } from "@/lib/model";
import { MasterySegments } from "./mastery-segments";
import { Button } from "@/components/ui/button";
export function BackLink({
  href = "/",
  children = "ホーム",
}: {
  href?: string;
  children?: React.ReactNode;
}) {
  return (
    <Link href={href} className="back-link">
      <ArrowLeft size={16} />
      {children}
    </Link>
  );
}
export function Progress({
  items,
  label,
  history,
}: {
  items: StudyItem[];
  label: string;
  history: MasteryChange[];
}) {
  return (
    <MasterySegments counts={masteryCounts(items, history)} label={label} />
  );
}
export function EmptyThemes({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="empty-state">
      <BookOpen size={30} strokeWidth={1} />
      <h2>最初の学びを。</h2>
      <Button onClick={onCreate}>
        テーマを追加
        <ArrowUpRight />
      </Button>
    </div>
  );
}
export function RecordList({
  records,
  themes,
  showTheme = false,
  items = [],
  feedbacks = [],
}: {
  records: StudyRecord[];
  feedbacks?: LearningFeedback[];
  themes: { id: string; name: string }[];
  showTheme?: boolean;
  items?: { id: string; title: string }[];
}) {
  return (
    <ol className="record-list">
      {[
        ...records.map((record) => ({
          date: record.studiedAt,
          record,
          feedback: undefined as LearningFeedback | undefined,
        })),
        ...feedbacks.map((feedback) => ({
          date: feedback.createdAt,
          record: undefined as StudyRecord | undefined,
          feedback,
        })),
      ]
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((entry) => {
          if (entry.feedback) {
            const feedback = entry.feedback;
            return (
              <li key={`ai:${feedback.id}`}>
                <time dateTime={feedback.createdAt}>
                  {dateLabel(feedback.createdAt, true)}
                </time>
                <div>
                  {showTheme && (
                    <Link
                      className="record-theme"
                      href={`/themes/${feedback.themeId}`}
                    >
                      {
                        themes.find((theme) => theme.id === feedback.themeId)
                          ?.name
                      }
                    </Link>
                  )}
                  <div className="record-meta">
                    <span>AIフィードバック · 参考情報</span>
                    <span>
                      {feedback.targetType === "item"
                        ? `項目 · ${items.find((item) => item.id === feedback.targetId)?.title ?? "学習項目"}`
                        : "テーマ全体"}
                    </span>
                  </div>
                  <Link href={`/records/${feedback.recordId}`}>
                    {feedback.document.questions[0]}
                  </Link>
                </div>
              </li>
            );
          }
          const record = entry.record!;
          const theme = themes.find((theme) => theme.id === record.themeId);
          return (
            <li key={record.id}>
              <time dateTime={record.studiedAt}>
                {dateLabel(record.studiedAt, true)}
              </time>
              <div>
                {showTheme && theme && (
                  <Link href={`/themes/${theme.id}`} className="record-theme">
                    {theme.name}
                    <ArrowUpRight size={13} />
                  </Link>
                )}
                <div className="record-meta">
                  <span>
                    {record.targetType === "item"
                      ? `項目 · ${items.find((item) => item.id === record.targetId)?.title ?? "削除済みの項目"}`
                      : "テーマ全体"}
                  </span>
                  {record.activity === "output" && (
                    <span>
                      アウトプット完成度 · {outputLabel(record.outputRating)}
                    </span>
                  )}
                  {record.completion !== undefined && (
                    <span className="legacy-rating">
                      旧評価 {record.completion}%
                    </span>
                  )}
                </div>
                {record.activity === "output" && record.title && (
                  <strong className="record-output-title">
                    {record.title}
                  </strong>
                )}
                <p className="record-excerpt">
                  <Link href={`/records/${record.id}`}>{record.note}</Link>
                </p>
                <Link className="record-open" href={`/records/${record.id}`}>
                  記録を開く
                </Link>
              </div>
            </li>
          );
        })}
    </ol>
  );
}
