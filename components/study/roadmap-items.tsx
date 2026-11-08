"use client";
import { useState } from "react";
import { Accordion } from "radix-ui";
import { Plus, ChevronDown } from "lucide-react";
import type { StudyItem } from "@/lib/model";
import { getLearningState, learningStateLabels } from "@/lib/study-summary";
import { studyRepository } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useStudy } from "./provider";
import { ItemForm } from "./item-form";
import { ActionMenu } from "./action-menu";
import { DailyActions } from "./daily-actions";
export function RoadmapItems({
  themeId,
  initialItemId,
}: {
  themeId: string;
  initialItemId?: string;
}) {
  const { items, records, refresh } = useStudy();
  const recordedItemIds = new Set(
    records
      .filter((record) => record.targetType === "item")
      .map((record) => record.targetId),
  );
  const themeItems = items.filter((item) => item.themeId === themeId);
  const [expanded, setExpanded] = useState<string[]>(
    initialItemId ? [initialItemId] : [],
  );
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StudyItem>();
  const [deleting, setDeleting] = useState<StudyItem>();
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{
    id: string;
    completed: boolean;
  } | null>(null);
  const [error, setError] = useState("");
  async function toggle(item: StudyItem) {
    if (busy) return;
    setBusy(true);
    setError("");
    setPending({ id: item.id, completed: !item.completed });
    try {
      await studyRepository.updateItem(item.id, {
        title: item.title,
        completed: !item.completed,
      });
      await refresh();
    } catch {
      setError("保存できませんでした。再試行してください。");
    } finally {
      setPending(null);
      setBusy(false);
    }
  }
  async function remove() {
    if (busy || !deleting) return;
    setBusy(true);
    setError("");
    try {
      await studyRepository.deleteItem(deleting.id);
      await refresh();
      setDeleting(undefined);
    } catch {
      setError("削除できませんでした。再試行してください。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="items-section">
      <div className="section-heading">
        <h2>
          学習項目 <span className="count">{themeItems.length}</span>
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setEditing(undefined);
            setFormOpen(true);
          }}
        >
          <Plus />
          項目を追加
        </Button>
      </div>
      {themeItems.length ? (
        <Accordion.Root
          type="multiple"
          value={expanded}
          onValueChange={setExpanded}
          className="roadmap-items"
        >
          {themeItems.map((item) => {
            const completed =
              pending?.id === item.id ? pending.completed : item.completed;
            const state = getLearningState(
              { ...item, completed },
              recordedItemIds,
            );
            return (
              <Accordion.Item
                value={item.id}
                key={item.id}
                className="roadmap-item"
                data-learning-state={state}
              >
                <div className="roadmap-item-header">
                  <Accordion.Header>
                    <Accordion.Trigger
                      className="roadmap-item-trigger"
                      aria-describedby={`learning-state-${item.id}`}
                    >
                      <span
                        className={`mastery-dot ${state}`}
                        aria-hidden="true"
                      />
                      <span>{item.title}</span>
                      <ChevronDown size={17} />
                    </Accordion.Trigger>
                    <span className="sr-only" id={`learning-state-${item.id}`}>
                      {learningStateLabels[state]}
                    </span>
                  </Accordion.Header>
                  <ActionMenu
                    label={`${item.title}のメニュー`}
                    onEdit={() => {
                      setEditing(item);
                      setFormOpen(true);
                    }}
                    onDelete={() => {
                      setError("");
                      setDeleting(item);
                    }}
                  />
                </div>
                <Accordion.Content className="roadmap-item-content">
                  <div className="roadmap-item-body">
                    <dl className="item-goal">
                      <dt>到達目標</dt>
                      <dd>{item.goal || "未設定"}</dd>
                    </dl>
                    <label className="item-check">
                      <input
                        type="checkbox"
                        checked={completed}
                        onChange={() => void toggle(item)}
                        disabled={busy}
                      />
                      <span>{completed ? "習得済み" : "習得済みにする"}</span>
                      <span className="sr-only">{item.title}</span>
                    </label>
                    <DailyActions themeId={themeId} itemId={item.id} />
                  </div>
                </Accordion.Content>
              </Accordion.Item>
            );
          })}
        </Accordion.Root>
      ) : (
        <p className="quiet-empty">項目を追加して、学びを小さく。</p>
      )}
      {error && !deleting && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <ItemForm
        themeId={themeId}
        item={editing}
        open={formOpen}
        onClose={() => setFormOpen(false)}
      />
      <Dialog
        open={!!deleting}
        onOpenChange={(value) => {
          if (!value && !busy) setDeleting(undefined);
        }}
      >
        <DialogContent>
          <DialogTitle className="dialog-title">
            学習項目を削除しますか？
          </DialogTitle>
          <DialogDescription className="dialog-description">
            「{deleting?.title}
            」と、この項目の学習記録を削除します。元に戻せません。
          </DialogDescription>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setDeleting(undefined)}
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
    </section>
  );
}
