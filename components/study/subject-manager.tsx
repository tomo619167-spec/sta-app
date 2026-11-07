"use client";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { EditorDialog } from "./editor-dialog";
import { SubjectChoices } from "./subject-fields";
import { useStudy } from "./provider";
import { studyRepository } from "@/lib/storage";
export function SubjectManager({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { subjects, refresh } = useStudy();
  const [edit, setEdit] = useState(false);
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const close = () => {
    setEdit(false);
    setError("");
    onClose();
  };
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !edit) return;
    setBusy(true);
    setError("");
    try {
      if (id) await studyRepository.renameSubject(id, name);
      else await studyRepository.createSubject(name);
      await refresh();
      setEdit(false);
    } catch (error) {
      setError(
        error instanceof Error && /科目|文字/.test(error.message)
          ? error.message
          : "保存できませんでした。再試行してください。",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <EditorDialog
      open={open}
      onClose={close}
      title={edit ? (id ? "科目名を変更" : "科目を追加") : "科目"}
      onSubmit={submit}
      busy={busy}
      error={error}
      saveLabel="保存"
      onBack={
        edit
          ? () => {
              setEdit(false);
              setError("");
            }
          : undefined
      }
      footer={
        !edit ? (
          <Button type="button" variant="outline" onClick={close}>
            閉じる
          </Button>
        ) : undefined
      }
    >
      {edit ? (
        <div>
          <label htmlFor="manage-subject-name">科目名</label>
          <input
            id="manage-subject-name"
            required
            maxLength={40}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
          />
        </div>
      ) : (
        <SubjectChoices
          onAdd={() => {
            setId("");
            setName("");
            setError("");
            setEdit(true);
          }}
          onRename={(id) => {
            setId(id);
            setName(subjects.find((subject) => subject.id === id)!.name);
            setError("");
            setEdit(true);
          }}
        />
      )}
    </EditorDialog>
  );
}
