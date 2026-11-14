"use client";
import Link from "next/link";
import { useState } from "react";
import type { StudyRecord, StudyItem, Theme } from "@/lib/model";
import type { LearningFeedback } from "@/lib/learning-feedback";
import {
  filterRecords,
  recordFilters,
  type RecordFilter,
} from "@/lib/record-filters";
import { SegmentedControl } from "./segmented-control";
import { RecordList } from "./shared";
import { useStudy } from "./provider";
import { focusDuration } from "@/lib/focus";
import { dateLabel } from "@/lib/model";
export function RecentRecords({
  records,
  feedbacks,
  themes,
  items,
  themeId,
  itemId,
}: {
  records: StudyRecord[];
  feedbacks: LearningFeedback[];
  themes: Theme[];
  items: StudyItem[];
  themeId: string;
  itemId?: string;
}) {
  const [filter, setFilter] = useState<RecordFilter>("all");
  const { focusSessions } = useStudy();
  const historyHref = `/history?theme=${encodeURIComponent(themeId)}${itemId ? `&item=${encodeURIComponent(itemId)}` : ""}`;
  const focused =
    filter === "all" || filter === "focus"
      ? focusSessions.filter(
          (session) =>
            session.target.themeId === themeId &&
            (!itemId ||
              (session.targetType === "item" && session.targetId === itemId)),
        )
      : [];
  const visible = [
    ...filterRecords(records, filter).map((record) => ({
      kind: "study" as const,
      record,
      date: record.studiedAt,
    })),
    ...focused.map((session) => ({
      kind: "focus" as const,
      session,
      date: session.endedAt,
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);
  return (
    <section className="recent-section" aria-label="最近の学習記録">
      <div className="section-heading">
        <h2>{itemId ? "この項目の記録" : "学習記録"}</h2>
        <Link className="text-link" href={historyHref}>
          すべて見る
        </Link>
      </div>
      <SegmentedControl
        label="最近の記録の絞り込み"
        value={filter}
        options={recordFilters}
        onChange={setFilter}
      />
      {visible.length ? (
        <ol className="record-list">
          {visible.map((entry) =>
            entry.kind === "study" ? (
              <RecordList
                unwrapped
                key={entry.record.id}
                records={[entry.record]}
                feedbacks={feedbacks}
                themes={themes}
                items={items}
              />
            ) : (
              <li key={entry.session.id}>
                <time dateTime={entry.session.endedAt}>
                  {dateLabel(entry.session.endedAt, true)}
                </time>
                <div>
                  <span className="record-kind" data-kind="focus">
                    集中時間
                  </span>
                  <p>
                    <Link href={historyHref}>
                      {entry.session.target.name} ·{" "}
                      {focusDuration(entry.session.actualFocusSeconds)}
                    </Link>
                  </p>
                </div>
              </li>
            ),
          )}
        </ol>
      ) : (
        <p className="quiet-empty">該当する記録はありません。</p>
      )}
    </section>
  );
}
