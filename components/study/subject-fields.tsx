"use client";
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
  const { subjects } = useStudy();
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
            <span>{subject.name}</span>
            {subject.id === selectedId && <Check size={18} />}
          </button>
          <ActionMenu
            label={`${subject.name}のメニュー`}
            editLabel="名称変更"
            onEdit={() => onRename(subject.id)}
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
