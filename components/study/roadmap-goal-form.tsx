"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { studyRepository } from "@/lib/storage";
import type { Theme } from "@/lib/model";
import { EditorDialog } from "./editor-dialog";
import { useStudy } from "./provider";
export function RoadmapGoalForm({
  theme,
  open,
  onClose,
}: {
  theme: Theme;
  open: boolean;
  onClose: () => void;
}) {
  const { refresh } = useStudy();
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      setGoal(theme.description);
      setError("");
    }
    wasOpen.current = open;
  }, [open, theme.description]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await studyRepository.updateThemeGoal(theme.id, goal);
      await refresh();
      onClose();
    } catch {
      setError("保存できませんでした。入力を残しています。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <EditorDialog
      open={open}
      onClose={onClose}
      title="到達目標を編集"
      onSubmit={submit}
      busy={busy}
      error={error}
    >
      <div className="target-summary">
        <span>テーマ全体</span>
        <strong>{theme.name}</strong>
      </div>
      <div>
        <label htmlFor="roadmap-goal">テーマ全体の到達目標</label>
        <textarea
          id="roadmap-goal"
          rows={7}
          maxLength={1000}
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
          disabled={busy}
          placeholder="何を自分の言葉で説明できるようになりたいですか"
        />
      </div>
    </EditorDialog>
  );
}
