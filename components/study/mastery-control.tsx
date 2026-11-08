"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ChevronRight, PenLine } from "lucide-react";
import { dateLabel, type FourLevel, type StudyTarget } from "@/lib/model";
import { latestMastery, masteryLabel } from "@/lib/ratings";
import { studyRepository } from "@/lib/storage";
import { useStudy } from "./provider";
import { EditorDialog } from "./editor-dialog";
import { FourLevelPicker } from "./four-level-picker";
export function MasteryControl({
  themeId,
  target,
  name,
  compact = false,
}: {
  themeId: string;
  target: StudyTarget;
  name: string;
  compact?: boolean;
}) {
  const { masteryHistory } = useStudy();
  const current = latestMastery(masteryHistory, target);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className={`mastery-control${compact ? " compact-control" : ""}`}
        type="button"
        aria-label={`${target.type === "theme" ? "テーマ全体" : "項目"}の習得度を変更`}
        onClick={() => setOpen(true)}
      >
        {compact ? (
          <>
            <PenLine size={14} />
            <span>習得度を変更</span>
          </>
        ) : (
          <>
            <span>習得度</span>
            <strong data-level={current ?? "unrated"}>
              {masteryLabel(current)}
            </strong>
            <ChevronRight size={16} />
          </>
        )}
      </button>
      <MasteryEditor
        themeId={themeId}
        target={target}
        name={name}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
export function MasteryEditor({
  themeId,
  target,
  name,
  open,
  onClose,
}: {
  themeId: string;
  target: StudyTarget;
  name: string;
  open: boolean;
  onClose: () => void;
}) {
  const { masteryHistory, refresh } = useStudy();
  const history = masteryHistory.filter(
    (entry) => entry.targetType === target.type && entry.targetId === target.id,
  );
  const current = latestMastery(history, target);
  const [level, setLevel] = useState<FourLevel>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      setLevel(current);
      setError("");
    }
    wasOpen.current = open;
  }, [open, current]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!level) {
      setError("習得度を選択してください。");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await studyRepository.setMastery(themeId, target, level);
      await refresh();
      onClose();
    } catch {
      setError("保存できませんでした。選択を残しています。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <EditorDialog
      open={open}
      onClose={onClose}
      title="習得度を記録"
      onSubmit={submit}
      busy={busy}
      error={error}
      saveLabel="習得度を保存"
    >
      <div className="target-summary">
        <span>{target.type === "theme" ? "テーマ全体" : "学習項目"}</span>
        <strong>{name}</strong>
      </div>
      <FourLevelPicker
        kind="mastery"
        value={level}
        onChange={setLevel}
        disabled={busy}
      />
      <section className="mastery-history" aria-label="習得度の履歴">
        <h3>変更の履歴</h3>
        {history.length ? (
          <ol>
            {history.map((entry) => (
              <li key={entry.id}>
                <time dateTime={entry.changedAt}>
                  {dateLabel(entry.changedAt, true)}
                </time>
                <strong data-level={entry.level}>
                  {masteryLabel(entry.level)}
                </strong>
              </li>
            ))}
          </ol>
        ) : (
          <p className="quiet-empty">まだ評価していません。</p>
        )}
      </section>
    </EditorDialog>
  );
}
