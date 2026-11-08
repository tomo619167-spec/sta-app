"use client";
import { useState } from "react";
import Link from "next/link";
import { ChevronRight, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { masteryCounts, latestMastery } from "@/lib/ratings";
import { nextStudyItem } from "@/lib/roadmap";
import { roadmapHref } from "@/lib/learning-context";
import { useStudy } from "./provider";
import { BackLink, Progress } from "./shared";
import { RoadmapItems } from "./roadmap-items";
import { MasteryBadge } from "./mastery-badge";
import { RoadmapGoalForm } from "./roadmap-goal-form";
import { RoadmapWorkflow } from "./roadmap-workflow";
export function RoadmapManager({
  themeId,
  itemId,
}: {
  themeId: string;
  itemId?: string;
}) {
  const { themes, subjects, items, masteryHistory } = useStudy();
  const [tool, setTool] = useState<"goal">();
  const [notice, setNotice] = useState("");
  const theme = themes.find((entry) => entry.id === themeId);
  if (!theme) return null;
  const subject =
    subjects.find((entry) => entry.id === theme.subjectId)?.name ??
    theme.subject;
  const themeItems = items.filter((entry) => entry.themeId === themeId);
  const counts = masteryCounts(themeItems, masteryHistory);
  const next = nextStudyItem(themeItems, masteryHistory);
  return (
    <div className="roadmap-manager">
      <BackLink href={`/themes/${themeId}`}>テーマに戻る</BackLink>
      <header className="roadmap-heading">
        <h1>ロードマップ</h1>
        <p>{theme.name}</p>
      </header>
      <section className="roadmap-goal" aria-label="テーマ全体の到達目標">
        <div className="section-heading">
          <h2>到達目標</h2>
          <Button variant="ghost" size="sm" onClick={() => setTool("goal")}>
            <PenLine />
            目標を編集
          </Button>
        </div>
        <p>{theme.description || "未設定"}</p>
      </section>
      <section className="roadmap-overview" aria-label="ロードマップの進捗">
        <p className="roadmap-totals">
          全 <strong>{counts.total}</strong> 項目{" "}
          <span>
            説明できる以上 <strong>{counts[3] + counts[4]}</strong> 項目
          </span>
        </p>
        <Progress
          items={themeItems}
          label={theme.name}
          history={masteryHistory}
        />
      </section>
      {next ? (
        <Link
          className="next-study-item"
          href={`${roadmapHref(themeId, next.id)}#roadmap-item-${encodeURIComponent(next.id)}`}
          aria-label={`次に取り組む：${next.title}`}
        >
          <span>
            <small>次に取り組む</small>
            <strong>{next.title}</strong>
          </span>
          <MasteryBadge
            level={latestMastery(masteryHistory, { type: "item", id: next.id })}
          />
          <ChevronRight size={17} />
        </Link>
      ) : (
        themeItems.length > 0 && (
          <p className="roadmap-hint">すべての項目が「説明できる」以上です。</p>
        )
      )}
      <RoadmapWorkflow
        key={themeId}
        theme={theme}
        subject={subject}
        onImported={(count) => setNotice(`${count}項目を追加しました`)}
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
      <RoadmapGoalForm
        theme={theme}
        open={tool === "goal"}
        onClose={() => setTool(undefined)}
      />
    </div>
  );
}
