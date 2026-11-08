"use client";
import { useRef, useState } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import type { StudyItem } from "@/lib/model";
import { latestMastery } from "@/lib/ratings";
import { studyRepository } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { MasteryBadge } from "./mastery-badge";
import { useStudy } from "./provider";
export function ReorderItems({
  themeId,
  items,
  busy,
  onBusyChange,
  onError,
}: {
  themeId: string;
  items: StudyItem[];
  busy: boolean;
  onBusyChange: (value: boolean) => void;
  onError: (value: string) => void;
}) {
  const { masteryHistory, refresh } = useStudy();
  const [message, setMessage] = useState("");
  const lock = useRef(false);
  async function move(item: StudyItem, direction: "up" | "down") {
    if (lock.current) return;
    lock.current = true;
    onBusyChange(true);
    onError("");
    try {
      await studyRepository.moveItem(themeId, item.id, direction);
      await refresh();
      setMessage(
        `「${item.title}」を${direction === "up" ? "上" : "下"}へ移動しました。`,
      );
    } catch {
      onError("順序を保存できませんでした。再試行してください。");
    } finally {
      lock.current = false;
      onBusyChange(false);
    }
  }
  return (
    <>
      <ol className="reorder-list" aria-label="学習項目の表示順">
        {items.map((item, index) => (
          <li key={item.id}>
            <span className="reorder-number" aria-hidden="true">
              {index + 1}
            </span>
            <div>
              <strong>{item.title}</strong>
              <MasteryBadge
                level={latestMastery(masteryHistory, {
                  type: "item",
                  id: item.id,
                })}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`${item.title}を上へ`}
              disabled={busy || index === 0}
              onClick={() => void move(item, "up")}
            >
              <ArrowUp />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`${item.title}を下へ`}
              disabled={busy || index === items.length - 1}
              onClick={() => void move(item, "down")}
            >
              <ArrowDown />
            </Button>
          </li>
        ))}
      </ol>
      <p role="status" className="sr-only">
        {message}
      </p>
    </>
  );
}
