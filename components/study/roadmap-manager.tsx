"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { themeHref } from "@/lib/learning-context";
import { useStudy } from "./provider";
import { BackLink } from "./shared";
import { MissingTheme } from "./detail";
import { RoadmapGoal } from "./roadmap-progress";
import { RoadmapItems } from "./roadmap-items";
import { RoadmapWorkflow } from "./roadmap-workflow";
export function RoadmapManager({
  themeId,
  itemId,
}: {
  themeId: string;
  itemId?: string;
}) {
  const { themes, subjects } = useStudy();
  const router = useRouter();
  const [notice, setNotice] = useState("");
  const theme = themes.find((entry) => entry.id === themeId);
  if (!theme) return <MissingTheme />;
  const subject =
    subjects.find((entry) => entry.id === theme.subjectId)?.name ??
    theme.subject;
  return (
    <div className="roadmap-manager">
      <BackLink href={`/themes/${themeId}`}>テーマに戻る</BackLink>
      <header className="roadmap-heading">
        <h1>ロードマップを編集</h1>
        <p>{theme.name}</p>
      </header>
      <RoadmapGoal theme={theme} />
      <RoadmapWorkflow
        key={themeId}
        theme={theme}
        subject={subject}
        onImported={(count) => setNotice(`${count}項目を追加しました`)}
        onClose={() => router.replace(themeHref(themeId), { scroll: false })}
      />
      {notice && (
        <p role="status" className="roadmap-status">
          {notice}
        </p>
      )}
      <RoadmapItems
        key={`${themeId}:${itemId ?? ""}`}
        themeId={themeId}
        initialItemId={itemId}
      />
    </div>
  );
}
