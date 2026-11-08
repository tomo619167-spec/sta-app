"use client";
import { useState } from "react";
import { PenLine, Lightbulb, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { latestOutput, outputLabel } from "@/lib/ratings";
import { MasteryControl } from "./mastery-control";
import {
  resolveTarget,
  roadmapHref,
  themeHref,
  type DailyFeature,
} from "@/lib/learning-context";
import { useStudy } from "./provider";
import { BackLink, RecordList } from "./shared";
import { LearningEditor } from "./learning-editor";
import { useRouter } from "next/navigation";
export function LearningScreen({
  themeId,
  feature,
  itemId,
  fromTheme = false,
}: {
  themeId: string;
  feature: DailyFeature;
  itemId?: string;
  fromTheme?: boolean;
}) {
  const router = useRouter();
  const { themes, items, records } = useStudy();
  const [open, setOpen] = useState(false);
  const theme = themes.find((theme) => theme.id === themeId);
  const resolved = theme ? resolveTarget(theme, items, itemId) : undefined;
  const back =
    itemId === undefined || fromTheme
      ? themeHref(themeId, itemId)
      : roadmapHref(themeId, itemId);
  if (!theme || !resolved)
    return (
      <>
        <BackLink href={theme ? roadmapHref(themeId) : "/"}>
          {theme ? "ロードマップへ" : "ホーム"}
        </BackLink>
        <div className="empty-state">
          <h1>学習対象が見つかりません</h1>
        </div>
      </>
    );
  const scoped = records.filter(
    (record) =>
      record.targetType === resolved.target.type &&
      record.targetId === resolved.target.id,
  );
  const output = latestOutput(scoped, resolved.target);
  const displayed =
    feature === "output"
      ? scoped.filter((record) => record.activity === "output")
      : scoped;
  const title = feature === "output" ? "アウトプット" : "理解を深める";
  const Icon = feature === "output" ? PenLine : Lightbulb;
  return (
    <>
      <BackLink href={back}>
        {itemId === undefined || fromTheme
          ? "テーマに戻る"
          : "ロードマップに戻る"}
      </BackLink>
      <header className="learning-heading">
        <Icon size={25} strokeWidth={1.4} />
        <h1>{title}</h1>
      </header>
      <section className="learning-target" aria-label="現在の学習対象">
        <span>
          {resolved.target.type === "theme" ? "テーマ全体" : "学習項目"}
        </span>
        <h2>{resolved.name}</h2>
        {(resolved.item?.goal ?? theme.description) && (
          <details className="learning-goal">
            <summary>到達目標を確認</summary>
            <p>{resolved.item?.goal ?? theme.description}</p>
          </details>
        )}
        {feature === "output" && (
          <div className="completion-summary">
            <span>直近のアウトプット</span>
            <strong>{outputLabel(output?.outputRating)}</strong>
          </div>
        )}
      </section>
      <MasteryControl
        themeId={themeId}
        target={resolved.target}
        name={resolved.name}
      />

      <Button onClick={() => setOpen(true)}>
        <Plus />
        学習を記録
      </Button>
      <section className="recent-section">
        <h2>
          {feature === "output" ? "アウトプットの履歴" : "この対象の記録"}
        </h2>
        {displayed.length ? (
          <RecordList records={displayed} themes={themes} items={items} />
        ) : (
          <p className="quiet-empty">まだ記録はありません。</p>
        )}
      </section>
      {open && (
        <LearningEditor
          key={`${resolved.target.type}:${resolved.target.id}:${feature}`}
          themeId={themeId}
          target={resolved.target}
          name={resolved.name}
          goal={resolved.item?.goal ?? theme.description}
          activity={feature}
          open={open}
          onClose={() => setOpen(false)}
          onSaved={(record, ai) => {
            if (ai) router.push(`/records/${record.id}?ai=1`);
          }}
        />
      )}
    </>
  );
}
