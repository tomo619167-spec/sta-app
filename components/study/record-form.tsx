"use client";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { studyRepository } from "@/lib/storage";
import { useStudy } from "./provider";
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
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!note.trim()) {
      setError("今日学んだことを入力してください。");
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
      setError(
        "記録を保存できませんでした。入力内容を残しています。保存設定や空き容量を確認して、再試行してください。",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!saving) {
          setError("");
          onOpenChange(value);
        }
      }}
    >
      <DialogContent>
        <span className="eyebrow">ONE SMALL STEP</span>
        <DialogTitle className="dialog-title">今日の学びを残す</DialogTitle>
        <DialogDescription className="dialog-description">
          わかったこと、次に考えたいこと。一言でも大丈夫。
        </DialogDescription>
        <form className="form-stack" onSubmit={submit}>
          <div>
            <label htmlFor="study-note">
              学習内容 <span className="required-label">必須</span>
            </label>
            <textarea
              id="study-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              required
              maxLength={1000}
              rows={5}
              placeholder="例：革命前のフランス社会を整理した。"
              disabled={saving}
            />
            <p className="input-hint">
              {note.length} / 1,000文字 · 現在の日時で記録します
            </p>
          </div>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="form-actions">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              キャンセル
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "保存中…" : "学習を保存"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
