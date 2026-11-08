import type { StudyItem, StudyTarget, Theme } from "./model";
export type DailyFeature = "output" | "deepen";
export function learningHref(
  themeId: string,
  feature: DailyFeature,
  itemId?: string,
  fromTheme = false,
) {
  return `/themes/${encodeURIComponent(themeId)}/${feature}${itemId === undefined ? "" : `?item=${encodeURIComponent(itemId)}${fromTheme ? "&from=theme" : ""}`}`;
}
export function resolveTarget(
  theme: Theme,
  items: StudyItem[],
  itemId?: string,
) {
  if (itemId === undefined)
    return {
      target: { type: "theme", id: theme.id } as StudyTarget,
      name: theme.name,
      item: undefined,
    };
  const item = items.find(
    (item) => item.id === itemId && item.themeId === theme.id,
  );
  return item
    ? {
        target: { type: "item", id: item.id } as StudyTarget,
        name: item.title,
        item,
      }
    : undefined;
}
export function roadmapHref(themeId: string, itemId?: string) {
  return `/themes/${encodeURIComponent(themeId)}/roadmap${itemId === undefined ? "" : `?item=${encodeURIComponent(itemId)}`}`;
}
export function examHref(subjectId: string, themeId?: string) {
  return `/subjects/${encodeURIComponent(subjectId)}/past-exams${themeId === undefined ? "" : `?theme=${encodeURIComponent(themeId)}`}`;
}

export function themeHref(themeId: string, itemId?: string) {
  return `/themes/${encodeURIComponent(themeId)}${itemId === undefined ? "" : `?item=${encodeURIComponent(itemId)}`}`;
}
