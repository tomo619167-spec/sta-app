"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PenLine, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  resolveTarget,
  studyReturnHref,
  themeHref,
  type DailyFeature,
} from "@/lib/learning-context";
import type { StudyRecord } from "@/lib/model";
import { useStudy } from "./provider";
import { BackLink, RecordList } from "./shared";
import { LearningEditor } from "./learning-editor";
import { SavedActions } from "./saved-actions";
export function LearningScreen({
  themeId,
  feature,
  itemId,
}: {
  themeId: string;
  feature: DailyFeature;
  itemId?: string;
  fromTheme?: boolean;
}) {
  const router = useRouter();
  const { themes, items, records } = useStudy();
  const [open, setOpen] = useState(true);
  const [saved, setSaved] = useState<StudyRecord>();
  const theme = themes.find((entry) => entry.id === themeId);
  const resolved = theme ? resolveTarget(theme, items, itemId) : undefined;
  if (!theme || !resolved)
    return (
      <>
        <BackLink href={theme ? themeHref(themeId) : "/"}>
          {theme ? "テーマに戻る" : "ホーム"}
        </BackLink>
        <div className="empty-state">
          <h1>学習対象が見つかりません</h1>
        </div>
      </>
    );
  const displayed = records.filter(
    (entry) =>
      entry.themeId === themeId &&
      entry.targetType === resolved.target.type &&
      entry.targetId === resolved.target.id &&
      entry.activity === feature,
  );
  const title = feature === "output" ? "自分の言葉で説明する" : "理解を深める";
  const Icon = feature === "output" ? PenLine : Lightbulb;
  return (
    <>
      <BackLink href={studyReturnHref(themeId, resolved.target)}>
        {itemId === undefined ? "テーマに戻る" : "学習項目に戻る"}
      </BackLink>
      <header className="learning-heading">
        <Icon size={24} strokeWidth={1.4} />
        <h1>{title}</h1>
      </header>
      <section className="learning-target" aria-label="現在の学習対象">
        <span>{itemId === undefined ? "テーマ全体" : "学習項目"}</span>
        <h2>{resolved.name}</h2>
      </section>
      {saved ? (
        <SavedActions themeId={themeId} target={resolved.target}>
          <Link className="text-link" href={`/records/${saved.id}`}>
            保存した記録・外部AI
          </Link>
        </SavedActions>
      ) : (
        <Button onClick={() => setOpen(true)}>
          {feature === "output" ? "説明を始める" : "問いを作る"}
        </Button>
      )}
      {displayed.length > 0 && (
        <section className="recent-section">
          <h2>{feature === "output" ? "アウトプットの履歴" : "問いの履歴"}</h2>
          <RecordList records={displayed} themes={themes} items={items} />
        </section>
      )}
      {open && (
        <LearningEditor
          themeId={themeId}
          target={resolved.target}
          name={resolved.name}
          goal={resolved.item?.goal ?? theme.description}
          activity={feature}
          open
          onClose={() => router.replace(themeHref(themeId), { scroll: false })}
          onSaved={(entry) => {
            setSaved(entry);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
