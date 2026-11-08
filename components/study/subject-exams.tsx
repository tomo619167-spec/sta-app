"use client";
import { BookOpen } from "lucide-react";
import { useStudy } from "./provider";
import { BackLink } from "./shared";
/** Entry context is subject-scoped; themeId is an optional future filter. */
export function SubjectExamsScreen({
  subjectId,
  themeId,
}: {
  subjectId: string;
  themeId?: string;
}) {
  const { subjects, themes } = useStudy();
  const subject = subjects.find((subject) => subject.id === subjectId);
  const theme =
    themeId === undefined
      ? undefined
      : themes.find(
          (theme) => theme.id === themeId && theme.subjectId === subjectId,
        );
  if (!subject || (themeId !== undefined && !theme))
    return (
      <>
        <BackLink />
        <div className="empty-state">
          <h1>学習対象が見つかりません</h1>
        </div>
      </>
    );
  return (
    <>
      <BackLink href={theme ? `/themes/${theme.id}` : "/"}>
        {theme ? "テーマに戻る" : "ホーム"}
      </BackLink>
      <section className="feature-placeholder">
        <BookOpen size={36} strokeWidth={1} />
        <h1>過去問</h1>
        <div className="target-summary">
          <span>科目</span>
          <strong>{subject.name}</strong>
          {theme && <p>関連テーマ：{theme.name}</p>}
        </div>
        <span className="phase-badge">準備中 · 現在は利用できません</span>
        <p>科目ごとの過去問管理を追加予定です。</p>
      </section>
    </>
  );
}
