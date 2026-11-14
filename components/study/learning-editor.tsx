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
import { FeedbackWorkflow } from "./feedback-workflow";
import {
  buildFeedbackPrompt,
  initialFeedbackDraft,
} from "@/lib/learning-feedback";
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
  onSaved: (record: StudyRecord) => void;
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
  const [resetAI, setResetAI] = useState(false);
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
  async function save() {
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
      onSaved(saved);
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
  async function dismiss() {
    try {
      await state.flush();
      onClose();
    } catch {
      setError("下書きを保存できませんでした。再試行してから閉じてください。");
    }
  }
  const { refresh, themes, subjects, items } = useStudy();
  const value = state.data;
  const theme = themes.find((entry) => entry.id === themeId);
  const item =
    target.type === "item"
      ? items.find(
          (entry) => entry.id === target.id && entry.themeId === themeId,
        )
      : undefined;
  const subject =
    subjects.find((entry) => entry.id === theme?.subjectId)?.name ??
    theme?.subject ??
    "";
  function startAI(replace = false) {
    if (!value || !theme) return;
    try {
      validateLearningInput(value);
    } catch (error) {
      setError((error as Error).message);
      return;
    }
    if (
      value.feedback &&
      value.feedback.record.question === value.question &&
      value.feedback.record.questionKind === value.questionKind
    ) {
      state.update({
        feedback: {
          ...value.feedback,
          workflow: { ...value.feedback.workflow, active: true },
        },
      });
      return;
    }
    if (value.feedback && !replace) {
      setResetAI(true);
      return;
    }
    const now = new Date().toISOString();
    const pending: StudyRecord = {
      id: crypto.randomUUID(),
      themeId,
      targetType: target.type,
      targetId: target.id,
      activity: "deepen",
      note: value.question ?? "",
      question: value.question,
      questionKind: value.questionKind,
      studiedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    state.update({
      feedback: {
        record: pending,
        workflow: {
          ...initialFeedbackDraft(
            pending,
            buildFeedbackPrompt(pending, theme, subject, item),
          ),
          active: true,
        },
      },
    });
    setResetAI(false);
    setError("");
  }
  const stale =
    record && value && value.baseRevision !== recordRevision(record);
  if (!record && value?.feedback?.workflow.active && theme) {
    const session = value.feedback;
    return (
      <FeedbackWorkflow
        key={session.record.id}
        record={session.record}
        theme={theme}
        subject={subject}
        item={item}
        autoOpen
        draftSession={{
          key: value.key,
          load: async () => session.workflow,
          save: async (workflow) => {
            state.update({ feedback: { record: session.record, workflow } });
            await state.flush();
          },
          import: async (source) => {
            await state.flush();
            return studyRepository.saveLearningRecord(value, source);
          },
          onClose: () => {
            void dismiss();
          },
          onSaved: (saved) => {
            state.clear();
            onSaved(saved);
          },
        }}
      />
    );
  }
  return (
    <EditorDialog
      open={open}
      onClose={() => void dismiss()}
      title={
        record
          ? "記録を編集"
          : activity === "output"
            ? "自分の言葉で説明する"
            : "問いを深める"
      }
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        void save();
      }}
      busy={busy || state.loading}
      saveLabel={activity === "deepen" ? "問いを保存" : "説明を保存"}
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
              <p className="roadmap-hint">
                覚えていることを、自分の言葉で説明してみましょう。
              </p>
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
                <label htmlFor="deep-question">自分の問い</label>
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
            </>
          )}
          {activity === "deepen" && !record && (
            <>
              {resetAI && (
                <div role="group" aria-label="AI作業の確認">
                  <p className="roadmap-hint">
                    問いが変わりました。以前のAI作業を置き換えますか？
                  </p>
                  <Button type="button" onClick={() => startAI(true)}>
                    新しい問いで作り直す
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setResetAI(false)}
                  >
                    キャンセル
                  </Button>
                </div>
              )}
              <Button type="button" variant="outline" onClick={() => startAI()}>
                プロンプトを確認
              </Button>
            </>
          )}
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
