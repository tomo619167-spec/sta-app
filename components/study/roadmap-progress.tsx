"use client";
import Link from "next/link";
import { useState } from "react";
import { PenLine, ChevronRight } from "lucide-react";
import type { Theme } from "@/lib/model";
import { itemHref } from "@/lib/learning-context";
import { latestMastery, masteryCounts } from "@/lib/ratings";
import { nextStudyItem } from "@/lib/roadmap";
import { Button } from "@/components/ui/button";
import { useStudy } from "./provider";
import { Progress } from "./shared";
import { MasteryBadge } from "./mastery-badge";
import { RoadmapGoalForm } from "./roadmap-goal-form";
export function RoadmapGoal({ theme }: { theme: Theme }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="roadmap-goal" aria-label="テーマ全体の到達目標">
      <div className="section-heading">
        <h2>到達目標</h2>
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          <PenLine />
          目標を編集
        </Button>
      </div>
      <p>{theme.description || "未設定"}</p>
      <RoadmapGoalForm
        theme={theme}
        open={open}
        onClose={() => setOpen(false)}
      />
    </section>
  );
}
export function RoadmapProgress({ theme }: { theme: Theme }) {
  const { items, masteryHistory } = useStudy();
  const own = items.filter((item) => item.themeId === theme.id);
  const counts = masteryCounts(own, masteryHistory);
  const next = nextStudyItem(own, masteryHistory);
  return (
    <div className="theme-progress-details">
      <RoadmapGoal theme={theme} />
      <section className="roadmap-overview" aria-label="ロードマップの進捗">
        <p className="roadmap-totals">
          全 <strong>{counts.total}</strong> 項目
        </p>
        <Progress items={own} label={theme.name} history={masteryHistory} />
      </section>
      {next && (
        <Link
          className="next-study-item"
          href={itemHref(theme.id, next.id)}
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
      )}
    </div>
  );
}
