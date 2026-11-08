import type {
  FourLevel,
  MasteryChange,
  StudyItem,
  StudyRecord,
  StudyTarget,
} from "./model";
export const masteryOptions: {
  level: FourLevel;
  label: string;
  criterion: string;
}[] = [
  { level: 1, label: "未着手", criterion: "まだ学習していない" },
  { level: 2, label: "学習中", criterion: "知識を取り入れている" },
  { level: 3, label: "説明できる", criterion: "自分の言葉で説明できる" },
  { level: 4, label: "定着した", criterion: "時間を空けても思い出せる" },
];
export const outputOptions: typeof masteryOptions = [
  { level: 1, label: "まだ難しい", criterion: "ほとんど説明できなかった" },
  { level: 2, label: "一部できた", criterion: "断片的には説明できた" },
  { level: 3, label: "概ねできた", criterion: "重要な内容を説明できた" },
  {
    level: 4,
    label: "十分できた",
    criterion: "根拠や知識同士のつながりまで説明できた",
  },
];
export function validateFourLevel(value: number): FourLevel {
  if (![1, 2, 3, 4].includes(value))
    throw new Error("評価は4段階から選択してください。");
  return value as FourLevel;
}
export function masteryLabel(level?: FourLevel) {
  return (
    masteryOptions.find((option) => option.level === level)?.label ?? "未評価"
  );
}
export function outputLabel(level?: FourLevel) {
  return (
    outputOptions.find((option) => option.level === level)?.label ?? "未評価"
  );
}
/** Monotonic event IDs resolve equal timestamps and clock changes without guessing. */
export function latestMastery(history: MasteryChange[], target: StudyTarget) {
  return history
    .filter(
      (entry) =>
        entry.targetType === target.type && entry.targetId === target.id,
    )
    .reduce<MasteryChange | undefined>(
      (latest, entry) => (!latest || entry.id > latest.id ? entry : latest),
      undefined,
    )?.level;
}
export function masteryCounts(items: StudyItem[], history: MasteryChange[]) {
  const latest = new Map<string, MasteryChange>();
  for (const entry of history) {
    if (entry.targetType !== "item") continue;
    if ((latest.get(entry.targetId)?.id ?? -1) < entry.id)
      latest.set(entry.targetId, entry);
  }
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, unrated: 0, total: items.length };
  for (const item of items) {
    const level = latest.get(item.id)?.level;
    if (level) counts[level]++;
    else counts.unrated++;
  }
  return counts;
}
export function latestOutput(records: StudyRecord[], target: StudyTarget) {
  return records
    .filter(
      (record) =>
        record.activity === "output" &&
        record.targetType === target.type &&
        record.targetId === target.id,
    )
    .sort((a, b) => b.studiedAt.localeCompare(a.studiedAt))[0];
}
