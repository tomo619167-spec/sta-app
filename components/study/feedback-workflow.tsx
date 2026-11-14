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
  promptStyles,
  type PromptStyle,
} from "@/lib/learning-feedback";
import { studyRepository } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { EditorDialog } from "./editor-dialog";
import { DraftStatus } from "./draft-status";
import { usePersistentDraft } from "./use-persistent-draft";
import { JSONSource } from "./json-source";
import { FeedbackBody } from "./feedback-body";
import { useStudy } from "./provider";
import { SavedActions } from "./saved-actions";
import type { FeedbackDraft } from "@/lib/learning-feedback";
import { themeHref } from "@/lib/learning-context";
import { SegmentedControl } from "./segmented-control";
export interface DraftFeedbackSession {
  key: string;
  load: () => Promise<FeedbackDraft | undefined>;
  save: (value: FeedbackDraft) => Promise<void>;
  import: (source: string) => Promise<StudyRecord>;
  onClose: () => void;
  onSaved: (record: StudyRecord) => void;
}
export function FeedbackWorkflow({
  record,
  theme,
  subject,
  item,
  autoOpen = false,
  draftSession,
  onSaved,
  stayOnPage = false,
  resumeOnMount = true,
}: {
  record: StudyRecord;
  theme: Theme;
  subject: string;
  item?: StudyItem;
  autoOpen?: boolean;
  draftSession?: DraftFeedbackSession;
  onSaved?: () => void;
  stayOnPage?: boolean;
  resumeOnMount?: boolean;
}) {
  const router = useRouter();
  const { refresh } = useStudy();
  const prompt = buildFeedbackPrompt(record, theme, subject, item);
  const state = usePersistentDraft(draftSession?.key ?? record.id, {
    load: async () => {
      const saved = draftSession
        ? await draftSession.load()
        : await studyRepository.getFeedbackDraft(record.id);
      return saved && !resumeOnMount ? { ...saved, active: false } : saved;
    },
    save: (value) =>
      draftSession
        ? draftSession.save(value)
        : studyRepository.saveFeedbackDraft(value),
    initial: () => initialFeedbackDraft(record, prompt),
  });
  const { data, update } = state;
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(false);
  const lock = useRef(false);
  const [promptOpen, setPromptOpen] = useState(false);
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
      setPromptOpen(true);
      setError(
        "コピーできませんでした。プロンプト全文を開き、端末のコピー操作を使ってください。",
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
      await copy();
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
      const saved = draftSession
        ? await draftSession.import(data.source)
        : undefined;
      if (!draftSession)
        await studyRepository.importFeedback(record.id, data.source);
      state.clear();
      await refresh();
      if (draftSession && saved) draftSession.onSaved(saved);
      else {
        if (onSaved) onSaved();
        else setCompleted(true);
        if (!stayOnPage) router.replace(`/records/${record.id}`);
      }
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
  async function close() {
    setBusy(true);
    setError("");
    try {
      if (!draftSession) update({ active: false });
      await state.flush();
      if (draftSession) draftSession.onClose();
      else router.replace(themeHref(theme.id), { scroll: false });
    } catch {
      setError("下書きを保存できませんでした。再試行してから閉じてください。");
    } finally {
      setBusy(false);
    }
  }
  function changeStyle(style: PromptStyle) {
    update({
      style,
      formatVersion: record.activity === "deepen" ? 3 : 1,
      prompt: buildFeedbackPrompt(record, theme, subject, item, style),
      copied: false,
    });
    setError("");
  }
  return (
    <>
      {completed && (
        <SavedActions
          themeId={theme.id}
          target={{ type: record.targetType, id: record.targetId }}
        />
      )}
      {!draftSession && (
        <Button
          variant="outline"
          disabled={state.loading || !data}
          onClick={() => update({ active: true })}
        >
          {record.activity === "output"
            ? "外部AIでフィードバック"
            : "外部AIに相談"}
        </Button>
      )}
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
        onClose={() => void close()}
        title={
          record.activity === "output"
            ? "外部AIでフィードバック"
            : "AIで理解を深める"
        }
        onSubmit={submit}
        busy={busy || state.loading}
        onBack={
          data?.step !== "prompt"
            ? () => {
                setError("");
                update({ step: data?.step === "preview" ? "json" : "prompt" });
              }
            : draftSession
              ? () => update({ active: false })
              : undefined
        }
        error={error || previewError}
        saveLabel={
          data?.step === "preview"
            ? "フィードバックを保存"
            : data?.step === "json"
              ? "プレビュー"
              : "プロンプトをコピー"
        }
        footer={
          stale ? (
            <Button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                state.update({
                  ...initialFeedbackDraft(
                    record,
                    buildFeedbackPrompt(
                      record,
                      theme,
                      subject,
                      item,
                      data?.style ?? "simple",
                    ),
                  ),
                  style: data?.style ?? "simple",
                  active: true,
                });
                setError("");
              }}
            >
              プロンプトを作り直す
            </Button>
          ) : data?.step === "prompt" ? (
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
                AIの回答を貼り付ける
              </Button>
            </div>
          ) : undefined
        }
      >
        <fieldset className="workflow-fields" disabled={busy || state.loading}>
          {data?.step !== "prompt" && (
            <>
              <ol
                className="workflow-steps"
                aria-label="フィードバックの進行状況"
              >
                {["プロンプト", "外部AIで生成", "結果を保存"].map(
                  (label, index) => (
                    <li
                      key={label}
                      aria-current={
                        (data?.step === "prompt"
                          ? data.copied
                            ? 2
                            : 1
                          : 3) ===
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
            </>
          )}
          {stale ? (
            <p role="alert">
              記録が変更されています。最新の本文でプロンプトを作り直してください。
            </p>
          ) : data?.step === "prompt" ? (
            <>
              {record.activity === "deepen" && (
                <SegmentedControl
                  label="説明モード"
                  value={data.style ?? "simple"}
                  options={promptStyles}
                  onChange={changeStyle}
                  disabled={busy}
                />
              )}
              {record.activity === "deepen" && (
                <section className="feedback-question" aria-label="自分の問い">
                  <span>自分の問い</span>
                  <p>{record.question ?? record.note}</p>
                </section>
              )}
              {data.copied && (
                <p role="status" aria-label="コピー状況">
                  コピーしました
                </p>
              )}
              <details
                className="feedback-prompt-disclosure"
                open={promptOpen}
                onToggle={(event) => setPromptOpen(event.currentTarget.open)}
              >
                <summary>プロンプト全文を確認</summary>
                <textarea
                  aria-label="プロンプト全文"
                  value={data.prompt}
                  readOnly
                  rows={12}
                  className="json-source"
                />
              </details>
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
                example={feedbackExample(record, data.formatVersion ?? 1)}
                version={data.formatVersion ?? 1}
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
