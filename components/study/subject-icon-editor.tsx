"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  inferSubjectIcon,
  subjectIconKeys,
  subjectIconLabels,
  type SubjectIconKey,
} from "@/lib/subject-icons";
import { studyRepository } from "@/lib/storage";
import { useStudy } from "./provider";
import { SubjectIcon } from "./subject-icon";
export function SubjectIconEditor({
  subjectId,
  onDone,
}: {
  subjectId: string;
  onDone: () => void;
}) {
  const { subjects, subjectIcons, refresh } = useStudy();
  const subject = subjects.find((value) => value.id === subjectId)!;
  const setting = subjectIcons.find((value) => value.subjectId === subjectId);
  const [value, setValue] = useState<SubjectIconKey | "auto">(
    setting?.source === "manual" ? setting.icon : "auto",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await studyRepository.setSubjectIcon(subjectId, value);
      await refresh();
      onDone();
    } catch {
      setError("保存できませんでした。再試行してください。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="icon-editor">
      <h3>{subject.name}のアイコン</h3>
      <fieldset disabled={busy} className="icon-options">
        <legend className="sr-only">科目アイコン</legend>
        {["auto", ...subjectIconKeys].map((key) => (
          <label key={key} className={value === key ? "selected" : ""}>
            <input
              type="radio"
              name={`icon-${subjectId}`}
              value={key}
              checked={value === key}
              onChange={() => setValue(key as typeof value)}
              aria-label={
                key === "auto"
                  ? "自動"
                  : subjectIconLabels[key as SubjectIconKey]
              }
            />
            <SubjectIcon
              icon={
                key === "auto"
                  ? inferSubjectIcon(subject.name)
                  : (key as SubjectIconKey)
              }
            />
            <span>
              {key === "auto"
                ? "自動"
                : subjectIconLabels[key as SubjectIconKey]}
            </span>
          </label>
        ))}
      </fieldset>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="form-actions">
        <Button
          type="button"
          variant="outline"
          onClick={onDone}
          disabled={busy}
        >
          戻る
        </Button>
        <Button type="button" onClick={() => void save()} disabled={busy}>
          アイコンを保存
        </Button>
      </div>
    </section>
  );
}
