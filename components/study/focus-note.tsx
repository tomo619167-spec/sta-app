"use client";
import { useState } from "react";
import { focusDuration, type FocusSession } from "@/lib/focus";
import { dateLabel } from "@/lib/model";
import { studyRepository } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { useStudy } from "./provider";
export function FocusNote({ session }: { session: FocusSession }) {
  const { refresh } = useStudy();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    setBusy(true);
    setError("");
    try {
      await studyRepository.deleteFocusSession(session.id);
      await refresh();
    } catch {
      setError("削除できませんでした。再試行してください。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="notebook-record focus-note" id={`focus-${session.id}`}>
      <summary>
        <span className="notebook-record-meta">
          <time dateTime={session.endedAt}>
            {dateLabel(session.endedAt, true)}
          </time>
          <span className="record-kind" data-kind="focus">
            集中時間
          </span>
        </span>
        <span className="notebook-target">{session.target.name}</span>
        <span className="notebook-title">
          {focusDuration(session.actualFocusSeconds)} ·{" "}
          {session.mode === "simple" ? "シンプル" : "ポモドーロ"} ·{" "}
          {session.status === "completed" ? "完了" : "途中終了"}
        </span>
      </summary>
      <div className="notebook-record-body">
        <dl className="focus-note-facts">
          <dt>学習対象</dt>
          <dd>
            {session.target.name}
            {session.target.themeName &&
            session.target.themeName !== session.target.name
              ? ` · ${session.target.themeName}`
              : ""}
            {session.target.subjectName &&
            session.target.subjectName !== session.target.name
              ? ` · ${session.target.subjectName}`
              : ""}
          </dd>
          <dt>予定時間</dt>
          <dd>{focusDuration(session.plannedFocusSeconds)}</dd>
          <dt>実績時間</dt>
          <dd>{focusDuration(session.actualFocusSeconds)}</dd>
          <dt>開始</dt>
          <dd>{dateLabel(session.startedAt, true)}</dd>
          <dt>終了</dt>
          <dd>{dateLabel(session.endedAt, true)}</dd>
          {session.pomodoroSetIndex && (
            <>
              <dt>セット</dt>
              <dd>{session.pomodoroSetIndex}セット目</dd>
            </>
          )}
        </dl>
        {confirm ? (
          <div className="form-stack">
            <p>この集中記録を削除しますか？</p>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => void remove()}
            >
              削除する
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setConfirm(false)}
            >
              キャンセル
            </Button>
          </div>
        ) : (
          <Button variant="ghost" onClick={() => setConfirm(true)}>
            集中記録を削除
          </Button>
        )}
        {error && <p role="alert">{error}</p>}
      </div>
    </details>
  );
}
