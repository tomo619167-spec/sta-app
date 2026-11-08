"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Theme } from "@/lib/model";
import {
  buildRoadmapPrompt,
  learningLevels,
  type RoadmapPromptInput,
} from "@/lib/roadmap-json";
import { Button } from "@/components/ui/button";
import { EditorDialog } from "./editor-dialog";
export function RoadmapPrompt({
  theme,
  subject,
  open,
  onClose,
}: {
  theme: Theme;
  subject: string;
  open: boolean;
  onClose: () => void;
}) {
  const [goal, setGoal] = useState("");
  const [level, setLevel] =
    useState<RoadmapPromptInput["level"]>("high-school");
  const [notes, setNotes] = useState("");
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      setGoal(theme.description);
      setPrompt("");
      setNotes("");
      setCopied(false);
      setError("");
    }
    wasOpen.current = open;
  }, [open, theme.description]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (!prompt) {
      try {
        setPrompt(
          buildRoadmapPrompt({
            subject,
            theme: theme.name,
            goal,
            level,
            notes,
          }),
        );
        setCopied(false);
      } catch (error) {
        setError((error as Error).message);
      }
      return;
    }
    setBusy(true);
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
    } catch {
      setCopied(false);
      setError(
        "コピーできませんでした。プロンプトを選択して、端末のコピー操作を使ってください。",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <EditorDialog
      open={open}
      onClose={onClose}
      title="外部AIでロードマップを作る"
      onSubmit={submit}
      busy={busy}
      error={error}
      saveLabel={prompt ? "プロンプトをコピー" : "プロンプトを確認"}
      onBack={
        prompt
          ? () => {
              setPrompt("");
              setError("");
              setCopied(false);
            }
          : undefined
      }
    >
      {prompt ? (
        <>
          <p className="roadmap-hint">
            外部AIへ貼り付け、返ってきたJSONを取り込みます。
          </p>
          <label htmlFor="roadmap-prompt-result">生成したプロンプト</label>
          <textarea
            ref={promptRef}
            id="roadmap-prompt-result"
            className="json-source"
            rows={14}
            readOnly
            value={prompt}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              promptRef.current?.focus();
              promptRef.current?.select();
            }}
          >
            プロンプトを選択
          </Button>
          {copied && (
            <p role="status" className="copy-status">
              コピーしました
            </p>
          )}
        </>
      ) : (
        <>
          <div>
            <label htmlFor="prompt-subject">科目</label>
            <input id="prompt-subject" value={subject} readOnly />
          </div>
          <div>
            <label htmlFor="prompt-theme">学習テーマ</label>
            <input id="prompt-theme" value={theme.name} readOnly />
          </div>
          <div>
            <label htmlFor="prompt-goal">生成用の到達目標</label>
            <textarea
              id="prompt-goal"
              rows={4}
              required
              maxLength={1000}
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
            />
            <p className="roadmap-hint">テーマの到達目標は変更されません。</p>
          </div>
          <div>
            <label htmlFor="prompt-level">学習レベル</label>
            <select
              id="prompt-level"
              value={level}
              onChange={(event) => setLevel(event.target.value as typeof level)}
            >
              {Object.entries(learningLevels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="prompt-notes">
              補足情報 <span className="optional-label">任意</span>
            </label>
            <textarea
              id="prompt-notes"
              rows={3}
              maxLength={2000}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
        </>
      )}
    </EditorDialog>
  );
}
