"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { dateLabel } from "@/lib/model";
import { questionKinds, recordRevision } from "@/lib/learning";
import { outputLabel } from "@/lib/ratings";
import { studyRepository } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useStudy } from "./provider";
import { BackLink } from "./shared";
import { ActionMenu } from "./action-menu";
import { LearningEditor } from "./learning-editor";
import { FeedbackWorkflow } from "./feedback-workflow";
import { FeedbackBody } from "./feedback-body";
import { OutputComparison } from "./output-comparison";
import { SavedActions } from "./saved-actions";
import { studyReturnHref } from "@/lib/learning-context";
export function RecordDetail({
  id,
  autoAI = false,
  embedded = false,
}: {
  id: string;
  autoAI?: boolean;
  embedded?: boolean;
}) {
  const { records, feedbacks, themes, subjects, items, refresh } = useStudy();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const record = records.find((record) => record.id === id);
  const theme = themes.find((theme) => theme.id === record?.themeId);
  if (!record || !theme)
    if (embedded) return null;
    else
      return (
        <>
          <BackLink href="/history">記録へ</BackLink>
          <div className="empty-state">
            <h1>記録が見つかりません</h1>
          </div>
        </>
      );
  const target = { type: record.targetType, id: record.targetId };
  const item =
    record.targetType === "item"
      ? items.find(
          (item) => item.id === record.targetId && item.themeId === theme.id,
        )
      : undefined;
  const name = item?.title ?? theme.name;
  const own = feedbacks.filter((feedback) => feedback.recordId === id);
  const historyHref = `/history?theme=${encodeURIComponent(theme.id)}${item ? `&item=${encodeURIComponent(item.id)}` : ""}`;
  async function remove() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await studyRepository.deleteRecord(id);
      await refresh();
      if (!embedded) router.replace(historyHref);
    } catch {
      setError("削除できませんでした。記録を残しています。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {!embedded && (
        <>
          <BackLink href={studyReturnHref(theme.id, target)}>
            {target.type === "item" ? "学習項目に戻る" : "テーマに戻る"}
          </BackLink>
          <header className="record-detail-heading">
            <div>
              <p className="subject-label">
                {theme.name}
                {item ? " / 学習項目" : ""}
              </p>
              <h1>
                {record.activity === "output"
                  ? "自分の言葉で説明する"
                  : record.activity === "deepen"
                    ? "理解を深める"
                    : "学習メモ"}
              </h1>
            </div>
            <ActionMenu
              label="記録のメニュー"
              onEdit={
                record.activity === "memo" ? undefined : () => setEditing(true)
              }
              onDelete={() => setDeleting(true)}
            />
          </header>
          <section className="learning-target" aria-label="現在の学習対象">
            <span>{target.type === "theme" ? "テーマ全体" : "学習項目"}</span>
            <h2>{name}</h2>
            {record.activity === "output" && record.title && (
              <p className="record-output-title">{record.title}</p>
            )}
          </section>
          <div className="record-dates">
            <time dateTime={record.createdAt ?? record.studiedAt}>
              {dateLabel(record.createdAt ?? record.studiedAt, true)}
            </time>
            {record.updatedAt &&
              record.updatedAt !== (record.createdAt ?? record.studiedAt) && (
                <span>編集 · {dateLabel(record.updatedAt, true)}</span>
              )}
          </div>
        </>
      )}
      {saved &&
        (embedded ? (
          <p role="status">保存しました</p>
        ) : (
          <SavedActions themeId={theme.id} target={target} />
        ))}
      {record.activity === "deepen" && record.question ? (
        <dl className="deepening-content">
          <dt>{questionKinds[record.questionKind ?? "why"]}</dt>
          <dd>{record.question}</dd>
        </dl>
      ) : (
        <p className="record-full-text">{record.note}</p>
      )}
      {record.activity === "deepen" &&
        (record.hypothesis || record.unknowns || record.insight) && (
          <details className="learning-goal">
            <summary>自分の考え・気づき</summary>
            <dl className="deepening-content">
              {record.hypothesis && (
                <>
                  <dt>自分の仮説</dt>
                  <dd>{record.hypothesis}</dd>
                </>
              )}
              {record.unknowns && (
                <>
                  <dt>不明点</dt>
                  <dd>{record.unknowns}</dd>
                </>
              )}
              {record.insight && (
                <>
                  <dt>新たな気づき</dt>
                  <dd>{record.insight}</dd>
                </>
              )}
            </dl>
          </details>
        )}
      {record.activity === "output" && (
        <p className="record-evaluation">
          今回の完成度 · {outputLabel(record.outputRating)}
        </p>
      )}
      {record.activity === "output" && (
        <OutputComparison current={record} records={records} />
      )}
      {record.completion !== undefined && (
        <p className="legacy-rating">旧評価 {record.completion}%</p>
      )}
      {record.activity !== "memo" && (
        <div className="record-actions">
          <Button variant="outline" onClick={() => setEditing(true)}>
            記録を編集
          </Button>
          {(record.activity === "output" ||
            (record.question ?? record.note).trim()) && (
            <FeedbackWorkflow
              record={record}
              theme={theme}
              subject={
                subjects.find((subject) => subject.id === theme.subjectId)
                  ?.name ?? theme.subject
              }
              item={item}
              autoOpen={autoAI}
              onSaved={() => setSaved(true)}
              stayOnPage={embedded}
              resumeOnMount={!embedded}
            />
          )}
        </div>
      )}
      {embedded && (
        <ActionMenu label="記録のメニュー" onDelete={() => setDeleting(true)} />
      )}
      {own.length > 0 && (
        <section className="recent-section">
          <h2>AIフィードバック</h2>
          {own.map((feedback) => (
            <article className="feedback-entry" key={feedback.id}>
              <time dateTime={feedback.createdAt}>
                {dateLabel(feedback.createdAt, true)}
              </time>
              {feedback.snapshot.revision !== recordRevision(record) && (
                <details className="learning-goal">
                  <summary>編集前の記録へのフィードバック</summary>
                  <p className="record-full-text">{feedback.snapshot.note}</p>
                </details>
              )}
              <FeedbackBody document={feedback.document} />
            </article>
          ))}
        </section>
      )}
      {editing && record.activity !== "memo" && (
        <LearningEditor
          key={`${id}:${recordRevision(record)}`}
          themeId={theme.id}
          target={target}
          name={name}
          goal={item?.goal ?? theme.description}
          activity={record.activity}
          record={record}
          open
          onClose={() => setEditing(false)}
          onSaved={() => {
            setSaved(true);
            setEditing(false);
          }}
        />
      )}
      <Dialog
        open={deleting}
        onOpenChange={(value) => {
          if (!busy) setDeleting(value);
        }}
      >
        <DialogContent>
          <DialogTitle>記録を削除しますか？</DialogTitle>
          <DialogDescription>
            この記録と紐付くAIフィードバックを削除します。
          </DialogDescription>
          {error && <p role="alert">{error}</p>}
          <div className="dialog-actions">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setDeleting(false)}
            >
              キャンセル
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => void remove()}
            >
              削除する
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
