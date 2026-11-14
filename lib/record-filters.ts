import type { StudyRecord } from "./model";
export type RecordFilter = "all" | "output" | "deepen";
export const recordFilters: { value: RecordFilter; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "output", label: "説明" },
  { value: "deepen", label: "理解" },
];
export function filterRecords(records: StudyRecord[], filter: RecordFilter) {
  return records.filter(
    (record) => filter === "all" || record.activity === filter,
  );
}
export function recordKindLabel(record: Pick<StudyRecord, "activity">) {
  return record.activity === "output"
    ? "自分の言葉で説明"
    : record.activity === "deepen"
      ? "理解を深める"
      : "学習メモ（旧記録）";
}
