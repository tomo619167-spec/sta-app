import type { FourLevel, StudyRecord, StudyTarget } from "./model";
import { validateFourLevel } from "./ratings";
export const questionKinds = {
  definition: "そもそも何？",
  why: "なぜ？",
  how: "どうやって？",
  compare: "何が違う？",
  connect: "何とつながる？",
  whatif: "もし〜だったら？",
} as const;
export type QuestionKind = keyof typeof questionKinds;
export function questionTemplate(kind: QuestionKind, title: string) {
  const templates: Record<QuestionKind, string> = {
    definition: `${title}とは？`,
    why: `なぜ「${title}」が重要なのか？`,
    how: `${title}はどのような仕組みなのか？`,
    compare: `${title}と△△は何が違う？`,
    connect: `${title}は△△とどう関係する？`,
    whatif: `もし△△だったら、${title}はどうなる？`,
  };
  return templates[kind];
}
export type LearningKind = "output" | "deepen";
export interface LearningInput {
  activity: LearningKind;
  note: string;
  outputRating?: FourLevel;
  questionKind?: QuestionKind;
  question?: string;
}
export interface OutputRecord extends StudyRecord {
  activity: "output";
  createdAt: string;
  updatedAt: string;
}
export interface DeepeningRecord extends StudyRecord {
  activity: "deepen";
  questionKind: QuestionKind;
  question: string;
  createdAt: string;
  updatedAt: string;
}
export interface LearningDraft extends LearningInput {
  version: 1;
  key: string;
  themeId: string;
  targetType: StudyTarget["type"];
  targetId: string;
  recordId?: string;
  baseRevision?: string;
  /** Read-only content carried over from older drafts. */
  hypothesis?: string;
  insight?: string;
}
export type OutputDraft = LearningDraft & { activity: "output" };
export type DeepeningDraft = LearningDraft & { activity: "deepen" };
export function learningDraftKey(
  activity: LearningKind,
  target: StudyTarget,
  recordId?: string,
) {
  return JSON.stringify([activity, target.type, target.id, recordId ?? "new"]);
}
export function initialLearningDraft(
  themeId: string,
  target: StudyTarget,
  activity: LearningKind,
  record?: StudyRecord,
): LearningDraft {
  return {
    version: 1,
    key: learningDraftKey(activity, target, record?.id),
    themeId,
    targetType: target.type,
    targetId: target.id,
    recordId: record?.id,
    baseRevision: record ? recordRevision(record) : undefined,
    activity,
    note: record?.note ?? "",
    outputRating: record?.outputRating,
    ...(activity === "deepen" && {
      questionKind: record?.questionKind ?? "definition",
      question: record?.question ?? record?.note ?? "",
    }),
  };
}
function limited(value: unknown, label: string, max: number, required = false) {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (required && !value.trim())
  )
    throw new Error(
      `${label}は${required ? "1〜" : ""}${max.toLocaleString("ja-JP")}文字で入力してください。`,
    );
  return value;
}
export function validateLearningInput(
  input: LearningInput,
  draft = false,
): LearningInput {
  if (!["output", "deepen"].includes(input.activity))
    throw new Error("学習の種類を確認してください。");
  if (input.activity === "output")
    return {
      activity: "output",
      note: limited(input.note, "アウトプット本文", 30000, !draft),
      outputRating:
        input.outputRating === undefined
          ? undefined
          : validateFourLevel(input.outputRating),
    };
  if (!Object.hasOwn(questionKinds, input.questionKind ?? ""))
    throw new Error("問いの種類を選んでください。");
  const question = limited(input.question, "問い", 2000, !draft);
  return {
    activity: "deepen",
    note: question,
    questionKind: input.questionKind,
    question,
  };
}
export function validateLearningDraft(draft: LearningDraft) {
  if (
    draft.version !== 1 ||
    (draft.recordId !== undefined &&
      (typeof draft.recordId !== "string" ||
        !draft.recordId ||
        draft.recordId.length > 200)) ||
    (draft.baseRevision !== undefined &&
      typeof draft.baseRevision !== "string") ||
    !draft.themeId ||
    !draft.targetId ||
    !["theme", "item"].includes(draft.targetType) ||
    draft.key !==
      learningDraftKey(
        draft.activity,
        { type: draft.targetType, id: draft.targetId },
        draft.recordId,
      )
  )
    throw new Error("下書きの対象を確認してください。");
  validateLearningInput(draft, true);
  if (draft.hypothesis !== undefined)
    limited(draft.hypothesis, "以前の仮説", 15000);
  if (draft.insight !== undefined)
    limited(draft.insight, "以前の気づき", 15000);
  return draft;
}
export function recordRevision(record: StudyRecord) {
  return record.updatedAt ?? record.studiedAt;
}
export function recordSnapshot(record: StudyRecord) {
  return {
    note: record.note,
    questionKind: record.questionKind,
    question: record.question,
    hypothesis: record.hypothesis,
    insight: record.insight,
    revision: recordRevision(record),
  };
}
