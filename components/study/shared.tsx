import Link from "next/link";
import { ArrowUpRight, BookOpen, ArrowLeft } from "lucide-react";
import {
  dateLabel,
  progress,
  type StudyItem,
  type StudyRecord,
} from "@/lib/model";
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
}: {
  items: StudyItem[];
  label: string;
}) {
  const value = progress(items);
  return (
    <div className="theme-progress">
      <div className="progress-label">
        <span>
          {value.total
            ? `${value.completed} / ${value.total} 項目`
            : "学習項目なし"}
        </span>
        <span className="progress-number">
          {value.percent}
          <small>%</small>
        </span>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-label={`${label}の学習進捗`}
        aria-valuenow={value.percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span style={{ width: `${value.percent}%` }} />
      </div>
    </div>
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
}: {
  records: StudyRecord[];
  themes: { id: string; name: string }[];
  showTheme?: boolean;
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
              <p>{record.note}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
