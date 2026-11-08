"use client";
import { useEffect, useState, type FormEvent } from "react";
import type { StudyTarget, LearningActivity } from "@/lib/model";
import { studyRepository } from "@/lib/storage";
import { useStudy } from "./provider";
import { EditorDialog } from "./editor-dialog";
export function RecordForm({
  themeId,
  target,
  targetName,
  activity = "memo",
  open,
  onOpenChange,
}: {
  themeId: string;
  target?: StudyTarget;
  targetName?: string;
  activity?: LearningActivity;
  open: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const { themes, refresh } = useStudy();
  const [note, setNote] = useState("");
  const [completion, setCompletion] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const scope = target ?? { type: "theme" as const, id: themeId };
  useEffect(() => {
    if (open) setError("");
  }, [open]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!note.trim()) {
      setError("学習内容を入力してください。");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await studyRepository.addRecord(themeId, note, {
        target: scope,
        activity,
        completion: completion === "" ? undefined : Number(completion),
      });
      await refresh();
      setNote("");
      setCompletion("");
      onOpenChange(false);
    } catch (error) {
      setError(
        error instanceof Error && /学習項目|学習対象|完成度/.test(error.message)
          ? error.message
          : "保存できませんでした。入力を残しています。",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <EditorDialog
      open={open}
      onClose={() => onOpenChange(false)}
      title="学習を記録"
      onSubmit={submit}
      saveLabel="学習を保存"
      busy={saving}
      error={error}
    >
      <div className="target-summary">
        <span>{scope.type === "theme" ? "テーマ全体" : "学習項目"}</span>
        <strong>
          {targetName ?? themes.find((theme) => theme.id === themeId)?.name}
        </strong>
      </div>
      <div>
        <label htmlFor="study-note">学習内容</label>
        <textarea
          id="study-note"
          required
          rows={5}
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={saving}
        />
      </div>
      <div>
        <label htmlFor="study-completion">
          完成度 <span className="optional-label">任意</span>
        </label>
        <div className="completion-input">
          <input
            id="study-completion"
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            step={1}
            value={completion}
            onChange={(e) => setCompletion(e.target.value)}
            disabled={saving}
          />
          <span>%</span>
        </div>
      </div>
    </EditorDialog>
  );
}
