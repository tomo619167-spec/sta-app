"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { StudyRecord, Theme, StudyItem } from "@/lib/model";
import { recordRevision } from "@/lib/learning";
import {
  buildFeedbackPrompt,
  feedbackExample,
  initialFeedbackDraft,
  parseFeedbackJSON,
  assertFeedbackContext,
  type FeedbackDocument,
} from "@/lib/learning-feedback";
import { studyRepository } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { EditorDialog } from "./editor-dialog";
import { DraftStatus } from "./draft-status";
import { usePersistentDraft } from "./use-persistent-draft";
import { JSONSource } from "./json-source";
import { FeedbackBody } from "./feedback-body";
import { useStudy } from "./provider";
export function FeedbackWorkflow({
  record,
  theme,
  subject,
  item,
  autoOpen = false,
}: {
  record: StudyRecord;
  theme: Theme;
  subject: string;
  item?: StudyItem;
  autoOpen?: boolean;
}) {
  const router = useRouter();
  const { refresh } = useStudy();
  const prompt = buildFeedbackPrompt(record, theme, subject, item);
  const state = usePersistentDraft(record.id, {
    load: () => studyRepository.getFeedbackDraft(record.id),
    save: (value) => studyRepository.saveFeedbackDraft(value),
    initial: () => initialFeedbackDraft(record, prompt),
  });
  const { data, update } = state;
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const started = useRef(false);
  useEffect(() => {
    if (autoOpen && data && !started.current) {
      started.current = true;
      update({ active: true });
    }
  }, [autoOpen, data, update]);
  const stale = data && data.revision !== recordRevision(record);
  let preview: FeedbackDocument | undefined;
  let previewError = "";
  if (data?.step === "preview")
    try {
      preview = parseFeedbackJSON(data.source);
      assertFeedbackContext(preview, record);
    } catch (error) {
      previewError = (error as Error).message;
    }
  async function copy() {
    if (!data || busy) return;
    setBusy(true);
    setError("");
    try {
      await navigator.clipboard.writeText(data.prompt);
      update({ copied: true });
    } catch {
      setError(
        "コピーできませんでした。プロンプトを選択して、端末のコピー操作を使ってください。",
      );
    } finally {
      setBusy(false);
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!data || lock.current || stale) return;
    setError("");
    if (data.step === "prompt") {
      if (data.copied) update({ step: "json" });
      else await copy();
      return;
    }
    if (data.step === "json") {
      try {
        const document = parseFeedbackJSON(data.source);
        assertFeedbackContext(document, record);
        update({ step: "preview" });
      } catch (error) {
        setError((error as Error).message);
      }
      return;
    }
    lock.current = true;
    setBusy(true);
    try {
      await state.flush();
      await studyRepository.importFeedback(record.id, data.source);
      state.clear();
      await refresh();
      router.replace(`/records/${record.id}`);
    } catch (error) {
      setError(
        error instanceof Error &&
          /JSON|version|kind|記録|学習|revision|questions/.test(error.message)
          ? error.message
          : "取り込めませんでした。既存の記録は変更していません。",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function close() {
    update({ active: false });
    setError("");
    if (autoOpen) router.replace(`/records/${record.id}`);
  }
  return (
    <>
      <Button
        variant="outline"
        disabled={state.loading || !data}
        onClick={() => update({ active: true })}
      >
        {record.activity === "output"
          ? "外部AIでフィードバック"
          : "外部AIに相談"}
      </Button>
      {state.error && !data?.active && (
        <DraftStatus
          error={state.error}
          saving={state.saving}
          retry={state.retry}
          disabled={busy || state.loading}
        />
      )}
      <EditorDialog
        open={data?.active ?? false}
        onClose={close}
        title={
          record.activity === "output"
            ? "外部AIでフィードバック"
            : "外部AIと考えを深める"
        }
        onSubmit={submit}
        busy={busy || state.loading}
        onBack={
          data?.step !== "prompt"
            ? () => {
                setError("");
                update({ step: data?.step === "preview" ? "json" : "prompt" });
              }
            : undefined
        }
        error={error || previewError}
        saveLabel={
          data?.step === "preview"
            ? "フィードバックを保存"
            : data?.step === "json"
              ? "プレビュー"
              : data?.copied
                ? "結果を貼り付ける"
                : "プロンプトをコピー"
        }
        footer={
          stale ? (
            <Button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                state.update({
                  ...initialFeedbackDraft(record, prompt),
                  active: true,
                });
                setError("");
              }}
            >
              プロンプトを作り直す
            </Button>
          ) : data?.step === "prompt" && !data.copied ? (
            <div className="workflow-footer">
              <Button type="submit" disabled={busy}>
                プロンプトをコピー
              </Button>
              <Button
                variant="outline"
                type="button"
                onClick={() => update({ step: "json" })}
                disabled={busy}
              >
                結果を貼り付ける
              </Button>
            </div>
          ) : undefined
        }
      >
        <fieldset className="workflow-fields" disabled={busy || state.loading}>
          <ol className="workflow-steps" aria-label="フィードバックの進行状況">
            {["プロンプト", "外部AIで生成", "結果を保存"].map(
              (label, index) => (
                <li
                  key={label}
                  aria-current={
                    (data?.step === "prompt" ? (data.copied ? 2 : 1) : 3) ===
                    index + 1
                      ? "step"
                      : undefined
                  }
                >
                  <span>{index + 1}</span>
                  {label}
                </li>
              ),
            )}
          </ol>
          <div className="target-summary">
            <span>
              {record.targetType === "theme" ? "テーマ全体" : "学習項目"}
            </span>
            <strong>{item?.title ?? theme.name}</strong>
          </div>
          {stale ? (
            <p role="alert">
              記録が変更されています。最新の本文でプロンプトを作り直してください。
            </p>
          ) : data?.step === "prompt" ? (
            <>
              <p className="roadmap-hint">
                外部AIへ貼り付け、返ってきたJSONを取り込みます。
              </p>
              {data.copied && (
                <p role="status" aria-label="コピー状況">
                  コピーしました
                </p>
              )}
              <label htmlFor="feedback-prompt">生成したプロンプト</label>
              <textarea
                id="feedback-prompt"
                ref={promptRef}
                value={data.prompt}
                readOnly
                rows={12}
                className="json-source"
              />
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  promptRef.current?.focus();
                  promptRef.current?.select();
                }}
              >
                プロンプトを選択
              </Button>
              {data.copied && (
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => void copy()}
                >
                  もう一度コピー
                </Button>
              )}
            </>
          ) : preview ? (
            <FeedbackBody document={preview} />
          ) : (
            data && (
              <JSONSource
                value={data.source}
                onChange={(source) => {
                  setError("");
                  update({ source });
                }}
                example={feedbackExample(record)}
              />
            )
          )}
          <DraftStatus
            error={state.error}
            saving={state.saving}
            retry={state.retry}
            disabled={busy || state.loading}
          />
        </fieldset>
      </EditorDialog>
    </>
  );
}
