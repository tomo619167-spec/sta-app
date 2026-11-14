"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { studyRepository } from "@/lib/storage";
import { themeHref, roadmapHref } from "@/lib/learning-context";
import { useStudy } from "./provider";
import { BackLink, RecordList } from "./shared";
import { ActionMenu } from "./action-menu";
import { ItemForm } from "./item-form";
import { MasteryControl } from "./mastery-control";
import { DailyActions } from "./daily-actions";
export function ItemDetail({
  themeId,
  itemId,
}: {
  themeId: string;
  itemId: string;
}) {
  const { themes, items, subjects, records, feedbacks, refresh } = useStudy();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const theme = themes.find((entry) => entry.id === themeId);
  const item = items.find(
    (entry) => entry.id === itemId && entry.themeId === themeId,
  );
  if (!theme || !item)
    return (
      <>
        <BackLink href={theme ? themeHref(themeId) : "/"}>
          {theme ? "学習項目一覧へ戻る" : "ホーム"}
        </BackLink>
        <div className="empty-state">
          <h1>学習項目が見つかりません</h1>
        </div>
      </>
    );
  const own = records.filter(
    (entry) =>
      entry.themeId === themeId &&
      entry.targetType === "item" &&
      entry.targetId === itemId,
  );
  const ai = feedbacks.filter(
    (entry) =>
      entry.themeId === themeId &&
      entry.targetType === "item" &&
      entry.targetId === itemId,
  );
  async function remove() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await studyRepository.deleteItem(itemId);
      await refresh();
      router.replace(themeHref(themeId));
    } catch {
      setError("削除できませんでした。記録を残しています。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="item-detail-page">
      <BackLink href={themeHref(themeId)}>学習項目一覧へ戻る</BackLink>
      <header className="item-detail-heading">
        <div>
          <p className="subject-label">
            {subjects.find((entry) => entry.id === theme.subjectId)?.name ??
              theme.subject}{" "}
            · {theme.name}
          </p>
          <h1>{item.title}</h1>
        </div>
        <ActionMenu
          label="学習項目のメニュー"
          onEdit={() => setEditing(true)}
          onDelete={() => {
            setError("");
            setDeleting(true);
          }}
        />
      </header>
      {item.goal && (
        <section className="item-detail-goal">
          <h2>到達目標</h2>
          <p>{item.goal}</p>
        </section>
      )}
      <MasteryControl
        themeId={themeId}
        target={{ type: "item", id: itemId }}
        name={item.title}
      />
      <DailyActions themeId={themeId} itemId={itemId} />
      {(own.length > 0 || ai.length > 0) && (
        <section className="recent-section">
          <div className="section-heading">
            <h2>この項目の記録</h2>
            <Link
              className="text-link"
              href={`/history?theme=${encodeURIComponent(themeId)}&item=${encodeURIComponent(itemId)}`}
            >
              すべて見る
            </Link>
          </div>
          <RecordList
            records={own.slice(0, 3)}
            feedbacks={ai.slice(0, 2)}
            themes={themes}
            items={items}
          />
        </section>
      )}
      <Link
        className="text-link item-management-link"
        href={roadmapHref(themeId)}
      >
        ロードマップを管理
      </Link>
      <ItemForm
        themeId={themeId}
        item={item}
        open={editing}
        onClose={() => setEditing(false)}
      />
      <Dialog
        open={deleting}
        onOpenChange={(value) => {
          if (!busy) setDeleting(value);
        }}
      >
        <DialogContent>
          <DialogTitle>学習項目を削除しますか？</DialogTitle>
          <DialogDescription>
            「{item.title}
            」と、この項目の記録・AIフィードバックを削除します。元に戻せません。
          </DialogDescription>
          {error && <p role="alert">{error}</p>}
          <div className="dialog-actions">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setDeleting(false)}
            >
              キャンセル
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => void remove()}
            >
              削除する
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
