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
}: {
  records: StudyRecord[];
  themes: { id: string; name: string }[];
  showTheme?: boolean;
  items?: { id: string; title: string }[];
}) {
  return (
    <ol className="record-list">
      {records.map((record) => {
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
              <p>{record.note}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
