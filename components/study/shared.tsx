import Link from "next/link";
import { ArrowUpRight, BookOpen, ArrowLeft } from "lucide-react";
import { dateLabel, progress, type Theme, type StudyRecord } from "@/lib/model";
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
export function Progress({ theme }: { theme: Theme }) {
  const value = progress(theme);
  return (
    <div className="theme-progress">
      <div className="progress-label">
        <span>
          {value.total
            ? `${value.completed} / ${value.total} ステップ`
            : "ロードマップ未作成"}
        </span>
        <span className="progress-number">
          {value.percent}
          <small>%</small>
        </span>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-label={`${theme.name}の学習進捗`}
        aria-valuenow={value.percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span style={{ width: `${value.percent}%` }} />
      </div>
    </div>
  );
}
export function ThemeCard({
  theme,
  index = 0,
}: {
  theme: Theme;
  index?: number;
}) {
  return (
    <Link href={`/themes/${theme.id}`} className="theme-card">
      <div className="theme-card-top">
        <span className="subject">{theme.subject}</span>
        <span className="theme-number">
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>
      <div className="theme-card-name">
        <h3>{theme.name}</h3>
        <ArrowUpRight size={18} strokeWidth={1.4} />
      </div>
      {theme.description && (
        <p className="theme-description">{theme.description}</p>
      )}
      <Progress theme={theme} />
    </Link>
  );
}
export function EmptyThemes({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="empty-state notebook-empty">
      <span className="empty-icon">
        <BookOpen size={30} strokeWidth={1} />
      </span>
      <h3>まだ白紙の、あなただけのノート。</h3>
      <p>
        気になっていること、理解したいこと。
        <br />
        最初の学習テーマをつくってみましょう。
      </p>
      <Button onClick={onCreate}>
        最初のテーマをつくる
        <ArrowUpRight />
      </Button>
      <span className="empty-footnote">小さな一歩から、学びは深まる。</span>
    </div>
  );
}
export function RecordList({
  records,
  themes,
  showTheme = false,
}: {
  records: StudyRecord[];
  themes: Theme[];
  showTheme?: boolean;
}) {
  return (
    <ol className="record-list">
      {records.map((record) => {
        const theme = themes.find((theme) => theme.id === record.themeId);
        return (
          <li key={record.id}>
            <span className="record-dot" />
            <div>
              <time dateTime={record.studiedAt}>
                {dateLabel(record.studiedAt, true)}
              </time>
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
