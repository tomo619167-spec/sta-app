export interface RoadmapItem {
  id: string;
  title: string;
  completed: boolean;
}
export interface Theme {
  id: string;
  name: string;
  subject: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  lastStudiedAt: string | null;
  roadmap: RoadmapItem[];
}
export interface StudyRecord {
  id: string;
  themeId: string;
  note: string;
  studiedAt: string;
}
export interface ThemeInput {
  name: string;
  subject: string;
  description: string;
}
export function validateTheme(input: ThemeInput): ThemeInput {
  const value = {
    name: input.name.trim(),
    subject: input.subject.trim(),
    description: input.description.trim(),
  };
  if (!value.name || value.name.length > 80)
    throw new Error("テーマ名は1〜80文字で入力してください。");
  if (!value.subject || value.subject.length > 40)
    throw new Error("科目は1〜40文字で入力してください。");
  if (value.description.length > 1000)
    throw new Error("説明は1,000文字以内で入力してください。");
  return value;
}
export function progress(theme: Theme) {
  const total = theme.roadmap.length;
  const completed = theme.roadmap.filter((item) => item.completed).length;
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
