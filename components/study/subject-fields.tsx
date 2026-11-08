"use client";
import { useState } from "react";
import { SubjectIcon } from "./subject-icon";
import { SubjectIconEditor } from "./subject-icon-editor";
import { Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionMenu } from "./action-menu";
import { useStudy } from "./provider";
export function SubjectChoices({
  selectedId,
  onSelect,
  onAdd,
  onRename,
}: {
  selectedId?: string;
  onSelect?: (id: string) => void;
  onAdd: () => void;
  onRename: (id: string) => void;
}) {
  const { subjects, subjectIcons } = useStudy();
  const [iconSubjectId, setIconSubjectId] = useState("");
  if (iconSubjectId)
    return (
      <SubjectIconEditor
        subjectId={iconSubjectId}
        onDone={() => setIconSubjectId("")}
      />
    );
  return (
    <div className="subject-choices">
      {subjects.map((subject) => (
        <div className="subject-choice" key={subject.id}>
          <button
            type="button"
            onClick={() => onSelect?.(subject.id)}
            disabled={!onSelect}
            aria-pressed={subject.id === selectedId}
          >
            <SubjectIcon
              name={subject.name}
              icon={
                subjectIcons.find((setting) => setting.subjectId === subject.id)
                  ?.icon
              }
            />
            <span>{subject.name}</span>
            {subject.id === selectedId && <Check size={18} />}
          </button>
          <ActionMenu
            label={`${subject.name}のメニュー`}
            editLabel="名称変更"
            onEdit={() => onRename(subject.id)}
            onIcon={() => setIconSubjectId(subject.id)}
          />
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={onAdd}
        className="add-subject"
      >
        <Plus />
        科目を追加
      </Button>
    </div>
  );
}
