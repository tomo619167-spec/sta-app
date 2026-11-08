import type { MasteryChange, StudyItem } from "./model";
import { latestMastery } from "./ratings";
export function sortStudyItems<
  T extends Pick<StudyItem, "position" | "createdAt">,
>(items: T[]) {
  return [...items].sort(
    (a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt),
  );
}
export function nextStudyItem(items: StudyItem[], history: MasteryChange[]) {
  const ordered = sortStudyItems(items);
  const level = (item: StudyItem) =>
    latestMastery(history, { type: "item", id: item.id });
  return (
    ordered.find((item) => {
      const value = level(item);
      return value === 1 || value === 2;
    }) ?? ordered.find((item) => level(item) === undefined)
  );
}
