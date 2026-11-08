export interface RoadmapItem {
  id: string;
  title: string;
  completed: boolean;
}
export interface Subject {
  id: string;
  name: string;
  normalizedName: string;
  createdAt: string;
  updatedAt: string;
}
/** Phase 1 fields remain intact for migration and recovery. */
export interface LegacyTheme {
  id: string;
  name: string;
  subject: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  lastStudiedAt: string | null;
  roadmap: RoadmapItem[];
}
export interface Theme extends LegacyTheme {
  subjectId: string;
}
export interface StudyItem extends RoadmapItem {
  themeId: string;
  position: number;
  goal: string;
  createdAt: string;
  updatedAt: string;
}
export interface LegacyStudyRecord {
  id: string;
  themeId: string;
  note: string;
  studiedAt: string;
}
export type TargetType = "theme" | "item";
export interface StudyTarget {
  type: TargetType;
  id: string;
}
export type LearningActivity = "memo" | "output" | "deepen";
export interface StudyRecord extends LegacyStudyRecord {
  targetType: TargetType;
  targetId: string;
  activity: LearningActivity;
  completion?: number;
}
export interface RecordOptions {
  target?: StudyTarget;
  completion?: number;
  activity?: LearningActivity;
}
export function validateGoal(goal: string) {
  const value = goal.trim();
  if (value.length > 1000)
    throw new Error("到達目標は1,000文字以内で入力してください。");
  return value;
}
export function validateCompletion(completion?: number) {
  if (
    completion !== undefined &&
    (!Number.isInteger(completion) || completion < 0 || completion > 100)
  )
    throw new Error("完成度は0〜100の整数で入力してください。");
  return completion;
}
/** Self-assessment is scoped to one target, independently of roadmap mastery. */
export function latestCompletion(records: StudyRecord[], target: StudyTarget) {
  return records
    .filter(
      (record) =>
        record.targetType === target.type &&
        record.targetId === target.id &&
        record.completion !== undefined,
    )
    .sort((a, b) => b.studiedAt.localeCompare(a.studiedAt))[0]?.completion;
}
export interface ThemeInput {
  name: string;
  subjectId: string;
  description: string;
}
export function normalizeSubject(name: string) {
  return name
    .normalize("NFKC")
    .trim()
    .replace(/\s+/gu, " ")
    .toLocaleLowerCase("ja-JP");
}
export function validateSubject(name: string) {
  const value = name.normalize("NFKC").trim().replace(/\s+/gu, " ");
  if (!value || value.length > 40)
    throw new Error("科目名は1〜40文字で入力してください。");
  return { name: value, normalizedName: normalizeSubject(value) };
}
export function validateTheme(input: ThemeInput): ThemeInput {
  const value = {
    name: input.name.trim(),
    subjectId: input.subjectId,
    description: input.description.trim(),
  };
  if (!value.name || value.name.length > 80)
    throw new Error("テーマ名は1〜80文字で入力してください。");
  if (!value.subjectId) throw new Error("科目を選んでください。");
  if (value.description.length > 1000)
    throw new Error("説明は1,000文字以内で入力してください。");
  return value;
}
export function validateItem(title: string) {
  const value = title.trim();
  if (!value || value.length > 120)
    throw new Error("学習項目は1〜120文字で入力してください。");
  return value;
}
export function progress(items: Pick<StudyItem, "completed">[]) {
  const total = items.length;
  const completed = items.filter((item) => item.completed).length;
  return {
    total,
    completed,
    percent: total ? Math.round((completed / total) * 100) : 0,
  };
}
export function dateLabel(iso: string, includeTime = false) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "long",
    day: "numeric",
    ...(includeTime ? ({ hour: "2-digit", minute: "2-digit" } as const) : {}),
  }).format(new Date(iso));
}
