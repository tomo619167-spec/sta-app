import {
  progress,
  type StudyItem,
  type StudyRecord,
  type Theme,
} from "./model";
export type LearningState = "not-started" | "in-progress" | "mastered";
export const learningStateLabels: Record<LearningState, string> = {
  "not-started": "未学習",
  "in-progress": "学習中",
  mastered: "習得済み",
};
export function getLearningState(
  item: StudyItem,
  recordedItemIds: ReadonlySet<string>,
): LearningState {
  return item.completed
    ? "mastered"
    : recordedItemIds.has(item.id)
      ? "in-progress"
      : "not-started";
}
export function summarizeStudy(
  themes: Theme[],
  items: StudyItem[],
  records: StudyRecord[],
) {
  return {
    ...progress(items),
    themeCount: themes.length,
    recordCount: records.length,
  };
}
export function subjectProgress(
  subjectId: string,
  themes: Theme[],
  items: StudyItem[],
) {
  const ids = new Set(
    themes
      .filter((theme) => theme.subjectId === subjectId)
      .map((theme) => theme.id),
  );
  return {
    ...progress(items.filter((item) => ids.has(item.themeId))),
    themeCount: ids.size,
  };
}
