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
  const visible = filterRecords(records, filter).slice(0, 3);
  return (
    <section className="recent-section" aria-label="最近の学習記録">
      <div className="section-heading">
        <h2>{itemId ? "この項目の記録" : "学習記録"}</h2>
        <Link
          className="text-link"
          href={`/history?theme=${encodeURIComponent(themeId)}${itemId ? `&item=${encodeURIComponent(itemId)}` : ""}`}
        >
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
        <RecordList
          records={visible}
          feedbacks={feedbacks}
          themes={themes}
          items={items}
        />
      ) : (
        <p className="quiet-empty">該当する記録はありません。</p>
      )}
    </section>
  );
}
