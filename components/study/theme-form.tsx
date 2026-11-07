"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { studyRepository } from "@/lib/storage";
import { validateTheme, type Theme } from "@/lib/model";
import { useStudy } from "./provider";
export function ThemeForm({
  open,
  onOpenChange,
  theme,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  theme?: Theme;
}) {
  const router = useRouter();
  const { refresh } = useStudy();
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (open) {
      setName(theme?.name ?? "");
      setSubject(theme?.subject ?? "");
      setDescription(theme?.description ?? "");
      setError("");
    }
  }, [open, theme]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setError("");
    let input;
    try {
      input = validateTheme({ name, subject, description });
    } catch (error) {
      setError((error as Error).message);
      return;
    }
    setSaving(true);
    try {
      const saved = theme
        ? await studyRepository.updateTheme(theme.id, input)
        : await studyRepository.createTheme(input);
      await refresh();
      onOpenChange(false);
      if (!theme) router.push(`/themes/${saved.id}`);
    } catch {
      setError(
        "保存できませんでした。入力内容を残しています。データ保存の許可や端末の空き容量を確認し、再試行してください。",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!saving) onOpenChange(value);
      }}
    >
      <DialogContent>
        <span className="eyebrow">
          {theme ? "EDIT YOUR THEME" : "A NEW CHAPTER"}
        </span>
        <DialogTitle className="dialog-title">
          {theme ? "テーマを編集" : "新しい学びを、ここから。"}
        </DialogTitle>
        <DialogDescription className="dialog-description">
          {theme
            ? "今の学びに合わせて、ノートを整えましょう。"
            : "小さな興味も、ひとつのテーマに。"}
        </DialogDescription>
        <form onSubmit={submit} className="form-stack">
          <div>
            <label htmlFor="theme-name">
              テーマ名 <span className="required-label">必須</span>
            </label>
            <input
              id="theme-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={80}
              placeholder="例：フランス革命"
              autoComplete="off"
              disabled={saving}
            />
          </div>
          <div>
            <label htmlFor="theme-subject">
              科目 <span className="required-label">必須</span>
            </label>
            <input
              id="theme-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              maxLength={40}
              placeholder="例：世界史"
              autoComplete="off"
              disabled={saving}
            />
          </div>
          <div>
            <label htmlFor="theme-description">
              説明 <span className="optional-label">任意</span>
            </label>
            <textarea
              id="theme-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              placeholder="学びたいこと、目指したいこと。"
              rows={3}
              disabled={saving}
            />
          </div>
          {error && (
            <p className="form-error" role="alert">
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
              {saving && <LoaderCircle className="animate-spin" />}
              {saving ? "保存中…" : theme ? "変更を保存" : "テーマを作成"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
