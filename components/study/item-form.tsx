"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { StudyItem } from "@/lib/model";
import { studyRepository } from "@/lib/storage";
import { useStudy } from "./provider";
import { EditorDialog } from "./editor-dialog";
export function ItemForm({
  themeId,
  item,
  open,
  onClose,
}: {
  themeId: string;
  item?: StudyItem;
  open: boolean;
  onClose: () => void;
}) {
  const { refresh } = useStudy();
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      setTitle(item?.title ?? "");
      setGoal(item?.goal ?? "");
      setError("");
    }
    wasOpen.current = open;
  }, [open, item]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (item)
        await studyRepository.updateItem(item.id, {
          title,
          goal,
          completed: item.completed,
        });
      else await studyRepository.createItem(themeId, title, goal);
      await refresh();
      onClose();
    } catch (error) {
      setError(
        error instanceof Error && /文字/.test(error.message)
          ? error.message
          : "保存できませんでした。入力を残しています。",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <EditorDialog
      open={open}
      onClose={onClose}
      title={item ? "学習項目を編集" : "学習項目を追加"}
      onSubmit={submit}
      busy={busy}
      error={error}
    >
      <div>
        <label htmlFor="item-title">学習項目</label>
        <textarea
          id="item-title"
          required
          maxLength={120}
          rows={3}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={busy}
          placeholder="革命が起きた原因"
        />
      </div>
      <div>
        <label htmlFor="item-goal">
          到達目標 <span className="optional-label">任意</span>
        </label>
        <textarea
          id="item-goal"
          maxLength={1000}
          rows={4}
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          disabled={busy}
          placeholder="自分の言葉で説明できる"
        />
      </div>
    </EditorDialog>
  );
}
