"use client";
import { useEffect, useState, type FormEvent } from "react";
import { studyRepository } from "@/lib/storage";
import { useStudy } from "./provider";
import { EditorDialog } from "./editor-dialog";
export function RecordForm({
  themeId,
  open,
  onOpenChange,
}: {
  themeId: string;
  open: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const { refresh } = useStudy();
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
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
      await studyRepository.addRecord(themeId, note);
      await refresh();
      setNote("");
      onOpenChange(false);
    } catch {
      setError("保存できませんでした。入力を残しています。");
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
      <div>
        <label htmlFor="study-note">学習内容</label>
        <textarea
          id="study-note"
          required
          rows={7}
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={saving}
        />
      </div>
    </EditorDialog>
  );
}
