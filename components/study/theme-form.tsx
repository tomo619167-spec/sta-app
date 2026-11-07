"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { studyRepository } from "@/lib/storage";
import { validateTheme, type Theme } from "@/lib/model";
import { useStudy } from "./provider";
import { EditorDialog } from "./editor-dialog";
import { SubjectChoices } from "./subject-fields";
export function ThemeForm({
  open,
  onOpenChange,
  theme,
  initialSubjectId = "",
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  theme?: Theme;
  initialSubjectId?: string;
}) {
  const router = useRouter();
  const { subjects, refresh } = useStudy();
  const [name, setName] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [description, setDescription] = useState("");
  const [step, setStep] = useState<"theme" | "subjects" | "subject">("theme");
  const [subjectName, setSubjectName] = useState("");
  const [renameId, setRenameId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const wasOpen = useRef(false);
  // Refreshing the subject list must never reset the in-progress theme draft.
  useEffect(() => {
    if (open && !wasOpen.current) {
      setName(theme?.name ?? "");
      setSubjectId(theme?.subjectId ?? initialSubjectId);
      setDescription(theme?.description ?? "");
      setStep("theme");
      setError("");
    }
    wasOpen.current = open;
  }, [open, theme, initialSubjectId]);
  function changeStep(value: typeof step) {
    setError("");
    setStep(value);
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving || step === "subjects") return;
    setError("");
    if (step === "theme") {
      try {
        validateTheme({ name, subjectId, description });
      } catch (error) {
        setError((error as Error).message);
        return;
      }
    }
    setSaving(true);
    try {
      if (step === "subject") {
        const subject = renameId
          ? await studyRepository.renameSubject(renameId, subjectName)
          : await studyRepository.createSubject(subjectName);
        if (!renameId) setSubjectId(subject.id);
        await refresh();
        setStep(renameId ? "subjects" : "theme");
      } else {
        const input = { name, subjectId, description };
        const saved = theme
          ? await studyRepository.updateTheme(theme.id, input)
          : await studyRepository.createTheme(input);
        await refresh();
        onOpenChange(false);
        if (!theme) router.push(`/themes/${saved.id}`);
      }
    } catch (error) {
      setError(
        error instanceof Error && /科目|文字|テーマが/.test(error.message)
          ? error.message
          : "保存できませんでした。入力を残しています。再試行してください。",
      );
    } finally {
      setSaving(false);
    }
  }
  const title =
    step === "subjects"
      ? "科目を選択"
      : step === "subject"
        ? renameId
          ? "科目名を変更"
          : "科目を追加"
        : theme
          ? "テーマを編集"
          : "テーマを追加";
  return (
    <EditorDialog
      open={open}
      onClose={() => onOpenChange(false)}
      title={title}
      onSubmit={submit}
      busy={saving}
      error={error}
      saveLabel={
        step === "theme"
          ? theme
            ? "変更を保存"
            : "テーマを作成"
          : renameId
            ? "名称を保存"
            : "追加して選択"
      }
      onBack={
        step === "theme"
          ? undefined
          : () => changeStep(step === "subject" ? "subjects" : "theme")
      }
      footer={
        step === "subjects" ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => changeStep("theme")}
          >
            テーマに戻る
          </Button>
        ) : undefined
      }
    >
      {step === "theme" ? (
        <>
          <div>
            <label htmlFor="theme-name">テーマ名</label>
            <input
              id="theme-name"
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="フランス革命"
              disabled={saving}
              autoComplete="off"
            />
          </div>
          <div>
            <label id="theme-subject-label">科目</label>
            <button
              type="button"
              className="select-subject"
              aria-labelledby="theme-subject-label theme-subject-value"
              onClick={() => changeStep("subjects")}
              disabled={saving}
            >
              <span id="theme-subject-value">
                {subjects.find((subject) => subject.id === subjectId)?.name ??
                  "選択する"}
              </span>
              <ChevronRight size={17} />
            </button>
          </div>
          <div>
            <label htmlFor="theme-description">
              説明 <span className="optional-label">任意</span>
            </label>
            <textarea
              id="theme-description"
              value={description}
              maxLength={1000}
              rows={4}
              onChange={(e) => setDescription(e.target.value)}
              disabled={saving}
            />
          </div>
        </>
      ) : step === "subjects" ? (
        <SubjectChoices
          selectedId={subjectId}
          onSelect={(id) => {
            setSubjectId(id);
            changeStep("theme");
          }}
          onAdd={() => {
            setRenameId("");
            setSubjectName("");
            changeStep("subject");
          }}
          onRename={(id) => {
            setRenameId(id);
            setSubjectName(subjects.find((subject) => subject.id === id)!.name);
            changeStep("subject");
          }}
        />
      ) : (
        <div>
          <label htmlFor="subject-name">科目名</label>
          <input
            id="subject-name"
            value={subjectName}
            onChange={(e) => setSubjectName(e.target.value)}
            required
            maxLength={40}
            autoComplete="off"
            disabled={saving}
            placeholder="世界史"
          />
        </div>
      )}
    </EditorDialog>
  );
}
