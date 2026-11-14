"use client";
import { useState, type FormEvent } from "react";
import { ClipboardCopy, FileJson } from "lucide-react";
import type { Theme } from "@/lib/model";
import { buildRoadmapPrompt } from "@/lib/roadmap-json";
import { Button } from "@/components/ui/button";
import { EditorDialog } from "./editor-dialog";
import { RoadmapPrompt } from "./roadmap-prompt";
import { RoadmapImport, useRoadmapImport } from "./roadmap-import";
import { useRoadmapDraft } from "./use-roadmap-draft";
export function RoadmapWorkflow({
  theme,
  subject,
  onImported,
  onClose,
}: {
  theme: Theme;
  subject: string;
  onImported: (count: number) => void;
  onClose?: () => void;
}) {
  const state = useRoadmapDraft(theme);
  const { draft, update } = state;
  const [copying, setCopying] = useState(false);
  const [error, setError] = useState("");
  const importing = draft?.step === "json" || draft?.step === "preview";
  const importer = useRoadmapImport({
    theme,
    subject,
    source: draft?.source ?? "",
    preview: draft?.step === "preview",
    onPreview: () => update({ step: "preview" }),
    beforeImport: state.flush,
    onImported: (count) => {
      state.clearAfterImport();
      onImported(count);
    },
  });
  const busy = copying || importer.busy;
  const stage = importing
    ? 3
    : draft?.copied && draft?.step === "prompt"
      ? 2
      : 1;
  function change(patch: Parameters<typeof update>[0]) {
    setError("");
    update(patch);
  }
  async function copy() {
    if (!draft || busy) return;
    setCopying(true);
    setError("");
    try {
      await navigator.clipboard.writeText(draft.prompt);
      update({ copied: true });
    } catch {
      setError(
        "コピーできませんでした。プロンプトを選択して、端末のコピー操作を使ってください。",
      );
    } finally {
      setCopying(false);
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft || busy) return;
    setError("");
    if (importing) {
      await importer.submit();
      return;
    }
    if (draft.step === "conditions") {
      try {
        const prompt = buildRoadmapPrompt({
          subject,
          theme: theme.name,
          goal: draft.goal,
          level: draft.level,
          notes: draft.notes,
        });
        update({
          step: "prompt",
          prompt,
          copied: prompt === draft.prompt && draft.copied,
        });
      } catch (error) {
        setError((error as Error).message);
      }
    } else if (draft.copied) change({ step: "json" });
    else await copy();
  }
  function back() {
    if (!draft) return;
    change({
      step:
        draft.step === "preview"
          ? "json"
          : draft.step === "json" && draft.prompt
            ? "prompt"
            : "conditions",
    });
  }
  async function close() {
    setError("");
    try {
      update({ active: false });
      await state.flush();
      onClose?.();
    } catch {
      setError("下書きを保存できませんでした。再試行してから閉じてください。");
    }
  }
  return (
    <>
      <div
        className="roadmap-tools"
        role="group"
        aria-label="ロードマップ作成ツール"
      >
        <Button
          disabled={state.loading || !draft}
          onClick={() => change({ active: true })}
        >
          <ClipboardCopy />
          AIでロードマップを作成
        </Button>
        <Button
          variant="ghost"
          disabled={state.loading || !draft}
          onClick={() => change({ active: true, step: "json" })}
        >
          <FileJson />
          JSONを直接取り込む
        </Button>
      </div>
      {state.error && !draft?.active && (
        <p role="alert" className="form-error">
          {state.error}
          <Button variant="ghost" onClick={state.retry}>
            下書きを再試行
          </Button>
        </p>
      )}
      <EditorDialog
        open={draft?.active ?? false}
        onClose={() => void close()}
        title="AIでロードマップを作成"
        onSubmit={submit}
        busy={busy}
        onBack={draft && draft.step !== "conditions" ? back : undefined}
        saveLabel={
          importing
            ? draft?.step === "preview"
              ? "項目を追加する"
              : "プレビュー"
            : draft?.step === "conditions"
              ? "プロンプトを確認"
              : draft?.copied
                ? "JSONの貼り付けへ進む"
                : "プロンプトをコピー"
        }
        error={importing ? importer.error : error}
        footer={
          draft?.step === "prompt" && !draft.copied ? (
            <div className="workflow-footer">
              <Button type="submit" disabled={busy}>
                {copying ? "コピー中…" : "プロンプトをコピー"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => change({ step: "json" })}
              >
                JSONの貼り付けへ進む
              </Button>
            </div>
          ) : undefined
        }
      >
        <ol className="workflow-steps" aria-label="ロードマップ作成の進行状況">
          {["プロンプト", "外部AIで生成", "JSON登録"].map((label, index) => (
            <li
              key={label}
              aria-current={stage === index + 1 ? "step" : undefined}
              data-complete={stage > index + 1}
            >
              <span>{index + 1}</span>
              {label}
            </li>
          ))}
        </ol>
        {draft && (
          <>
            {importing ? (
              <RoadmapImport
                theme={theme}
                subject={subject}
                source={draft.source}
                importer={importer}
                onSourceChange={(source) => change({ source })}
              />
            ) : (
              <RoadmapPrompt
                draft={draft}
                theme={theme.name}
                subject={subject}
                onChange={change}
                onCopy={() => void copy()}
                busy={busy}
              />
            )}
            {state.error ? (
              <p role="alert" className="form-error">
                {state.error}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={state.retry}
                  disabled={busy}
                >
                  下書きを再試行
                </Button>
              </p>
            ) : (
              <p role="status" aria-label="下書き状況" className="draft-status">
                {state.saving ? "下書きを保存中…" : "下書き保存済み"}
              </p>
            )}
          </>
        )}
      </EditorDialog>
    </>
  );
}
