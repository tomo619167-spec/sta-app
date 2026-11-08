import type { MasteryChange, StudyItem, StudyRecord, Theme } from "./model";
import { masteryCounts } from "./ratings";
export function summarizeStudy(
  themes: Theme[],
  items: StudyItem[],
  records: StudyRecord[],
  history: MasteryChange[],
) {
  return {
    ...masteryCounts(items, history),
    themeCount: themes.length,
    recordCount: records.length,
  };
}
export function subjectProgress(
  subjectId: string,
  themes: Theme[],
  items: StudyItem[],
  history: MasteryChange[],
) {
  const ids = new Set(
    themes
      .filter((theme) => theme.subjectId === subjectId)
      .map((theme) => theme.id),
  );
  return {
    ...masteryCounts(
      items.filter((item) => ids.has(item.themeId)),
      history,
    ),
    themeCount: ids.size,
  };
}
