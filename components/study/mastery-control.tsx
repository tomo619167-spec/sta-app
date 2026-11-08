"use client";
import { useState, type FormEvent } from "react";
import { ChevronRight } from "lucide-react";
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
}: {
  themeId: string;
  target: StudyTarget;
  name: string;
}) {
  const { masteryHistory, refresh } = useStudy();
  const history = masteryHistory.filter(
    (entry) => entry.targetType === target.type && entry.targetId === target.id,
  );
  const current = latestMastery(history, target);
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState<FourLevel>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
      setOpen(false);
    } catch {
      setError("保存できませんでした。選択を残しています。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        className="mastery-control"
        type="button"
        aria-label={`${target.type === "theme" ? "テーマ全体" : "項目"}の習得度を変更`}
        onClick={() => {
          setLevel(current);
          setError("");
          setOpen(true);
        }}
      >
        <span>習得度</span>
        <strong data-level={current ?? "unrated"}>
          {masteryLabel(current)}
        </strong>
        <ChevronRight size={16} />
      </button>
      <EditorDialog
        open={open}
        onClose={() => setOpen(false)}
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
    </>
  );
}
