"use client";
import {
  BookOpen,
  CircleHelp,
  Route,
  GitCompareArrows,
  Network,
  Shuffle,
} from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import type { StudyRecord, StudyTarget } from "@/lib/model";
import {
  initialLearningDraft,
  recordRevision,
  learningDraftKey,
  questionKinds,
  questionTemplate,
  type QuestionKind,
  validateLearningInput,
  type LearningKind,
} from "@/lib/learning";
import { studyRepository } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { EditorDialog } from "./editor-dialog";
import { FourLevelPicker } from "./four-level-picker";
import { useStudy } from "./provider";
import { usePersistentDraft } from "./use-persistent-draft";
import { DraftStatus } from "./draft-status";
const questionIcons = {
  definition: BookOpen,
  why: CircleHelp,
  how: Route,
  compare: GitCompareArrows,
  connect: Network,
  whatif: Shuffle,
};
export function LearningEditor({
  themeId,
  target,
  name,
  goal,
  activity,
  record,
  open,
  onClose,
  onSaved,
}: {
  themeId: string;
  target: StudyTarget;
  name: string;
  goal: string;
  activity: LearningKind;
  record?: StudyRecord;
  open: boolean;
  onClose: () => void;
  onSaved: (record: StudyRecord, ai: boolean) => void;
}) {
  const state = usePersistentDraft(
    learningDraftKey(activity, target, record?.id),
    {
      load: async () => {
        const saved = await studyRepository.getLearningDraft(
          learningDraftKey(activity, target, record?.id),
        );
        return saved
          ? {
              ...initialLearningDraft(themeId, target, activity, record),
              ...saved,
              ...(activity === "output" && {
                title: saved.title ?? record?.title ?? name,
              }),
            }
          : undefined;
      },
      save: (value) => studyRepository.saveLearningDraft(value),
      initial: () => {
        const draft = initialLearningDraft(themeId, target, activity, record);
        if (activity === "output") draft.title = record?.title ?? name;
        if (activity === "deepen" && !record)
          draft.question = questionTemplate("definition", name);
        return draft;
      },
    },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const [suggestedKind, setSuggestedKind] = useState<QuestionKind>();
  function applyKind(kind: QuestionKind, question: string) {
    state.update({ questionKind: kind, question });
    setSuggestedKind(undefined);
    setError("");
  }
  function chooseKind(kind: QuestionKind) {
    const question = state.data?.question ?? "";
    const currentKind = state.data?.questionKind;
    if (
      !question.trim() ||
      (currentKind && question === questionTemplate(currentKind, name))
    ) {
      applyKind(kind, questionTemplate(kind, name));
    } else {
      setSuggestedKind(kind);
    }
  }
  async function save(ai = false) {
    if (!state.data || lock.current) return;
    if (stale) {
      setError("記録が更新されています。最新の記録を確認してください。");
      return;
    }
    try {
      validateLearningInput(state.data);
    } catch (error) {
      setError((error as Error).message);
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await state.flush();
      const saved = await studyRepository.saveLearningRecord(state.data);
      state.clear();
      await refresh();
      onSaved(saved, ai);
      onClose();
    } catch (error) {
      setError(
        error instanceof Error &&
          /学習|記録|文字|問い|完成度/.test(error.message)
          ? error.message
          : "保存できませんでした。入力を残しています。",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const { refresh } = useStudy();
  const value = state.data;
  const stale =
    record && value && value.baseRevision !== recordRevision(record);
  return (
    <EditorDialog
      open={open}
      onClose={onClose}
      title={
        record
          ? "記録を編集"
          : activity === "output"
            ? "アウトプットを書く"
            : "問いを深める"
      }
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        void save();
      }}
      busy={busy || state.loading}
      saveLabel="学習を保存"
      error={error}
      footer={
        stale ? (
          <Button
            type="button"
            disabled={busy}
            onClick={(event) => {
              event.preventDefault();
              state.update(
                initialLearningDraft(themeId, target, activity, record),
              );
              setError("");
            }}
          >
            最新の記録から編集する
          </Button>
        ) : undefined
      }
    >
      {stale && (
        <p role="alert" className="form-error">
          別の画面で記録が更新されています。下書きの入力は残しています。最新の記録を読み込むと、この下書きを置き換えます。
        </p>
      )}
      <div className="target-summary">
        <span>{target.type === "theme" ? "テーマ全体" : "学習項目"}</span>
        <strong>{name}</strong>
      </div>
      {goal && (
        <details className="learning-goal">
          <summary>到達目標を確認</summary>
          <p>{goal}</p>
        </details>
      )}
      {value && (
        <fieldset className="workflow-fields" disabled={busy || state.loading}>
          {activity === "output" ? (
            <>
              <p className="roadmap-hint">何も見ずに、自分の言葉で説明する。</p>
              <div>
                <label htmlFor="output-title">タイトル</label>
                <input
                  id="output-title"
                  maxLength={160}
                  value={value.title ?? name}
                  onChange={(event) =>
                    state.update({ title: event.target.value })
                  }
                />
              </div>
              <div>
                <label htmlFor="output-body">アウトプット本文</label>
                <textarea
                  id="output-body"
                  rows={12}
                  maxLength={30000}
                  value={value.note}
                  onChange={(event) =>
                    state.update({ note: event.target.value })
                  }
                  placeholder="覚えていることを、自分の言葉で。"
                  autoCapitalize="sentences"
                  spellCheck
                />
              </div>
              <FourLevelPicker
                kind="output"
                value={value.outputRating}
                onChange={(outputRating) => state.update({ outputRating })}
              />
            </>
          ) : (
            <>
              <fieldset className="question-picker">
                <legend>問いの種類</legend>
                <div>
                  {Object.entries(questionKinds).map(([key, label]) => {
                    const Icon = questionIcons[key as QuestionKind];
                    return (
                      <label
                        key={key}
                        className={value.questionKind === key ? "selected" : ""}
                      >
                        <input
                          type="radio"
                          name="question-kind"
                          value={key}
                          checked={value.questionKind === key}
                          onChange={() => chooseKind(key as QuestionKind)}
                        />
                        <Icon size={16} aria-hidden="true" />
                        <span>{label}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              {suggestedKind && (
                <div
                  className="workflow-footer"
                  role="group"
                  aria-label="テンプレートの確認"
                >
                  <p>{questionTemplate(suggestedKind, name)}</p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      applyKind(
                        suggestedKind,
                        questionTemplate(suggestedKind, name),
                      )
                    }
                  >
                    テンプレートで置き換える
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      applyKind(suggestedKind, value.question ?? "")
                    }
                  >
                    文章を残して種類だけ変える
                  </Button>
                </div>
              )}
              <div>
                <label htmlFor="deep-question">自分で考えた問い</label>
                <textarea
                  id="deep-question"
                  rows={3}
                  maxLength={2000}
                  value={value.question}
                  onChange={(event) =>
                    state.update({ question: event.target.value })
                  }
                />
              </div>
              <details className="reflection-fields">
                <summary>
                  自分の考え・気づきを残す{" "}
                  <span className="optional-label">任意</span>
                </summary>
                <div className="form-stack">
                  <div>
                    <label htmlFor="deep-hypothesis">自分の仮説・考え</label>
                    <textarea
                      id="deep-hypothesis"
                      rows={5}
                      maxLength={15000}
                      value={value.hypothesis ?? ""}
                      onChange={(event) =>
                        state.update({ hypothesis: event.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label htmlFor="deep-unknowns">不明点</label>
                    <textarea
                      id="deep-unknowns"
                      rows={3}
                      maxLength={15000}
                      value={value.unknowns ?? ""}
                      onChange={(event) =>
                        state.update({ unknowns: event.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label htmlFor="deep-insight">新たな気づき</label>
                    <textarea
                      id="deep-insight"
                      rows={5}
                      maxLength={15000}
                      value={value.insight ?? ""}
                      onChange={(event) =>
                        state.update({ insight: event.target.value })
                      }
                    />
                  </div>
                </div>
              </details>
            </>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => void save(true)}
          >
            保存して外部AIへ
          </Button>
        </fieldset>
      )}
      <DraftStatus
        error={state.error}
        saving={state.saving}
        retry={state.retry}
        disabled={busy || state.loading}
      />
    </EditorDialog>
  );
}
