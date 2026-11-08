"use client";
import { useRef } from "react";
import { learningLevels } from "@/lib/roadmap-json";
import type { RoadmapDraft } from "@/lib/roadmap-draft";
import { Button } from "@/components/ui/button";
export function RoadmapPrompt({
  draft,
  subject,
  theme,
  onChange,
  onCopy,
  busy,
}: {
  draft: RoadmapDraft;
  subject: string;
  theme: string;
  onChange: (patch: Partial<RoadmapDraft>) => void;
  onCopy: () => void;
  busy: boolean;
}) {
  const promptRef = useRef<HTMLTextAreaElement>(null);
  return (
    <fieldset className="workflow-fields" disabled={busy}>
      {draft.step !== "conditions" ? (
        <>
          <p className="roadmap-hint">
            外部AIへ貼り付け、返ってきたJSONを取り込みます。
          </p>
          {draft.copied && (
            <p role="status" aria-label="コピー状況" className="copy-status">
              コピーしました
            </p>
          )}
          <label htmlFor="roadmap-prompt-result">生成したプロンプト</label>
          <textarea
            ref={promptRef}
            id="roadmap-prompt-result"
            className="json-source"
            rows={14}
            readOnly
            value={draft.prompt}
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
          {draft.copied && (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onCopy}
            >
              もう一度コピー
            </Button>
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
            <input id="prompt-theme" value={theme} readOnly />
          </div>
          <div>
            <label htmlFor="prompt-goal">生成用の到達目標</label>
            <textarea
              id="prompt-goal"
              rows={4}
              required
              maxLength={1000}
              value={draft.goal}
              onChange={(event) =>
                onChange({
                  goal: event.target.value,
                  prompt: "",
                  copied: false,
                })
              }
            />
            <p className="roadmap-hint">テーマの到達目標は変更されません。</p>
          </div>
          <div>
            <label htmlFor="prompt-level">学習レベル</label>
            <select
              id="prompt-level"
              value={draft.level}
              onChange={(event) =>
                onChange({
                  level: event.target.value as RoadmapDraft["level"],
                  prompt: "",
                  copied: false,
                })
              }
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
              value={draft.notes}
              onChange={(event) =>
                onChange({
                  notes: event.target.value,
                  prompt: "",
                  copied: false,
                })
              }
            />
          </div>
        </>
      )}
    </fieldset>
  );
}
