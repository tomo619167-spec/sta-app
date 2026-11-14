"use client";
import { useId, useState } from "react";
import { dateLabel, type StudyRecord } from "@/lib/model";
import { outputLabel } from "@/lib/ratings";
export function OutputComparison({
  current,
  records,
}: {
  current: StudyRecord;
  records: StudyRecord[];
}) {
  const [selectedId, setSelectedId] = useState("");
  const selectId = useId();
  const scoped = records
    .filter(
      (record) =>
        record.activity === "output" &&
        record.themeId === current.themeId &&
        record.targetType === current.targetType &&
        record.targetId === current.targetId,
    )
    .sort((a, b) => b.studiedAt.localeCompare(a.studiedAt));
  const others = scoped.filter((record) => record.id !== current.id);
  if (!others.length) return null;
  const selected =
    others.find((record) => record.id === selectedId) ?? others[0];
  return (
    <details className="output-comparison">
      <summary>過去のアウトプットと比べる</summary>
      <ol className="output-rating-timeline" aria-label="完成度の履歴">
        {[...scoped].reverse().map((record) => (
          <li key={record.id}>
            <time dateTime={record.studiedAt}>
              {dateLabel(record.studiedAt, true)}
            </time>
            <span>
              {outputLabel(record.outputRating)}
              {record.id === current.id && " · 今回"}
            </span>
          </li>
        ))}
      </ol>
      <label htmlFor={selectId}>比較する記録</label>
      <select
        id={selectId}
        value={selected.id}
        onChange={(event) => setSelectedId(event.target.value)}
      >
        {others.map((record) => (
          <option key={record.id} value={record.id}>
            {dateLabel(record.studiedAt, true)} ·{" "}
            {record.title ?? "アウトプット"} ·{" "}
            {outputLabel(record.outputRating)}
          </option>
        ))}
      </select>
      <div className="comparison-texts">
        <section aria-label="今回の本文">
          <h3>今回の本文</h3>
          <p>{current.note}</p>
        </section>
        <section aria-label="比較する本文">
          <h3>比較する本文</h3>
          <p>{selected.note}</p>
        </section>
      </div>
    </details>
  );
}
