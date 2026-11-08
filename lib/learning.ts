import type { FourLevel, StudyRecord, StudyTarget } from "./model";
import { validateFourLevel } from "./ratings";
export const questionKinds = {
  why: "なぜ？",
  how: "どうやって？",
  compare: "何が違う？",
  connect: "何とつながる？",
  whatif: "もし〜だったら？",
} as const;
export type QuestionKind = keyof typeof questionKinds;
export type LearningKind = "output" | "deepen";
export interface LearningInput {
  activity: LearningKind;
  note: string;
  outputRating?: FourLevel;
  questionKind?: QuestionKind;
  question?: string;
  hypothesis?: string;
  insight?: string;
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
  hypothesis: string;
  insight: string;
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
    questionKind: record?.questionKind ?? "why",
    question: record?.question ?? "",
    hypothesis:
      record?.hypothesis ?? (activity === "deepen" ? (record?.note ?? "") : ""),
    insight: record?.insight ?? "",
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
  return {
    activity: "deepen",
    note: limited(input.note, "学習内容", 40000),
    questionKind: input.questionKind,
    question: limited(input.question, "問い", 2000, !draft),
    hypothesis: limited(input.hypothesis, "仮説", 15000, !draft),
    insight: limited(input.insight, "気づき", 15000),
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
  return { ...draft, ...validateLearningInput(draft, true) };
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
