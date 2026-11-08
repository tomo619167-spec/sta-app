"use client";
import { useId, useState } from "react";
import { Accordion } from "radix-ui";
import { Plus, ChevronDown } from "lucide-react";
import type { StudyItem } from "@/lib/model";
import { latestMastery } from "@/lib/ratings";
import { MasteryBadge } from "./mastery-badge";
import { MasteryControl } from "./mastery-control";
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
  preview = false,
}: {
  themeId: string;
  initialItemId?: string;
  preview?: boolean;
}) {
  const { items, masteryHistory, refresh } = useStudy();
  const themeItems = items.filter((item) => item.themeId === themeId);
  const listId = useId();
  const previewLimit = 4;
  const [showAll, setShowAll] = useState(
    () =>
      !!initialItemId &&
      themeItems.findIndex((item) => item.id === initialItemId) >= previewLimit,
  );
  const visibleItems =
    preview && !showAll ? themeItems.slice(0, previewLimit) : themeItems;
  const [expanded, setExpanded] = useState<string[]>(
    initialItemId ? [initialItemId] : [],
  );
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StudyItem>();
  const [deleting, setDeleting] = useState<StudyItem>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
    <section
      className={`items-section${preview ? " items-preview" : ""}`}
      aria-label="学習項目"
    >
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
          id={listId}
        >
          {visibleItems.map((item) => {
            const level = latestMastery(masteryHistory, {
              type: "item",
              id: item.id,
            });
            const state = level === undefined ? "unrated" : String(level);
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
                      aria-label={item.title}
                      aria-describedby={`learning-state-${item.id}`}
                    >
                      <span
                        className="mastery-dot"
                        data-level={state}
                        aria-hidden="true"
                      />
                      <span className="item-title-state">
                        <span>{item.title}</span>
                        <MasteryBadge
                          level={level}
                          id={`learning-state-${item.id}`}
                        />
                      </span>
                      <ChevronDown size={17} />
                    </Accordion.Trigger>
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
                    {item.completed && (
                      <span className="legacy-rating">旧版：習得済み</span>
                    )}
                    <MasteryControl
                      themeId={themeId}
                      target={{ type: "item", id: item.id }}
                      name={item.title}
                      compact={preview}
                    />
                    <DailyActions
                      themeId={themeId}
                      itemId={item.id}
                      fromTheme={preview}
                    />
                  </div>
                </Accordion.Content>
              </Accordion.Item>
            );
          })}
        </Accordion.Root>
      ) : (
        <p className="quiet-empty">項目を追加して、学びを小さく。</p>
      )}
      {preview && themeItems.length > previewLimit && (
        <button
          className="show-all-items"
          type="button"
          aria-expanded={showAll}
          aria-controls={listId}
          onClick={() => setShowAll((value) => !value)}
        >
          {showAll
            ? "表示を少なくする"
            : `すべて表示（${themeItems.length}項目）`}
        </button>
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
