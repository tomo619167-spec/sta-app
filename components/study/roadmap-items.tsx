"use client";
import Link from "next/link";
import { useId, useState } from "react";
import { Plus, ChevronRight, ArrowUpDown } from "lucide-react";
import { latestMastery } from "@/lib/ratings";
import { MasteryBadge } from "./mastery-badge";
import { Button } from "@/components/ui/button";
import { useStudy } from "./provider";
import { ReorderItems } from "./reorder-items";
import { ItemForm } from "./item-form";
import { itemHref, roadmapHref } from "@/lib/learning-context";
export function RoadmapItems({
  themeId,
  initialItemId,
  preview = false,
}: {
  themeId: string;
  initialItemId?: string;
  preview?: boolean;
}) {
  const { items, masteryHistory } = useStudy();
  const themeItems = items.filter((item) => item.themeId === themeId);
  const listId = useId();
  const previewLimit = 4;
  const [showAll, setShowAll] = useState(() => {
    if (
      initialItemId &&
      themeItems.findIndex((item) => item.id === initialItemId) >= previewLimit
    )
      return true;
    try {
      return (
        preview &&
        sessionStorage.getItem(`trace-theme-all:${themeId}`) === "true"
      );
    } catch {
      return false;
    }
  });
  const visibleItems =
    preview && !showAll ? themeItems.slice(0, previewLimit) : themeItems;
  const [reordering, setReordering] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <section
      className={`items-section${preview ? " items-preview" : ""}`}
      aria-label="学習項目"
    >
      <div className="section-heading">
        <h2>
          学習項目 <span className="count">{themeItems.length}</span>
        </h2>
        <div className="item-management-actions">
          {!preview && themeItems.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => {
                setReordering((value) => !value);
                setError("");
              }}
              aria-pressed={reordering}
            >
              <ArrowUpDown />
              {reordering ? "並び替え完了" : "並び替え"}
            </Button>
          )}
          {!preview && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFormOpen(true);
              }}
            >
              <Plus />
              項目を追加
            </Button>
          )}
          {preview && themeItems.length > 0 && (
            <Link className="text-link" href={roadmapHref(themeId)}>
              ロードマップを編集
            </Link>
          )}
        </div>
      </div>
      {themeItems.length ? (
        reordering ? (
          <ReorderItems
            themeId={themeId}
            items={themeItems}
            busy={busy}
            onBusyChange={setBusy}
            onError={setError}
          />
        ) : (
          <ol className="roadmap-items item-links" id={listId}>
            {visibleItems.map((item) => {
              const level = latestMastery(masteryHistory, {
                type: "item",
                id: item.id,
              });
              return (
                <li
                  key={item.id}
                  className="roadmap-item"
                  data-learning-state={level ?? "unrated"}
                >
                  <Link
                    className="item-detail-link"
                    href={itemHref(themeId, item.id)}
                    aria-label={item.title}
                    aria-describedby={`learning-state-${item.id}`}
                  >
                    <span
                      className="mastery-dot"
                      data-level={level ?? "unrated"}
                      aria-hidden="true"
                    />
                    <span className="item-title-state">
                      <span>{item.title}</span>
                      <MasteryBadge
                        level={level}
                        id={`learning-state-${item.id}`}
                      />
                    </span>
                    <ChevronRight size={17} aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ol>
        )
      ) : (
        <Button asChild variant="outline">
          <Link href={roadmapHref(themeId)}>ロードマップを追加</Link>
        </Button>
      )}
      {preview && themeItems.length > previewLimit && (
        <button
          className="show-all-items"
          type="button"
          aria-expanded={showAll}
          aria-controls={listId}
          onClick={() =>
            setShowAll((value) => {
              try {
                sessionStorage.setItem(
                  `trace-theme-all:${themeId}`,
                  String(!value),
                );
              } catch {}
              return !value;
            })
          }
        >
          {showAll
            ? "表示を少なくする"
            : `すべて表示（${themeItems.length}項目）`}
        </button>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <ItemForm
        themeId={themeId}
        open={formOpen}
        onClose={() => setFormOpen(false)}
      />
    </section>
  );
}
