"use client";
import Link from "next/link";
import { useState } from "react";
import { History, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudy } from "./provider";
import { RecordList } from "./shared";
export function HistoryScreen({
  initialTheme = "",
  initialItem = "",
}: {
  initialTheme?: string;
  initialItem?: string;
}) {
  const { records, feedbacks, themes, subjects, items } = useStudy();
  const [subjectFilter, setSubjectFilter] = useState("");
  const [itemFilter, setItemFilter] = useState(initialItem);
  const [filter, setFilter] = useState(initialTheme);
  const [targetFilter, setTargetFilter] = useState("");
  const [activityFilter, setActivityFilter] = useState("");
  const selected = themes.some((theme) => theme.id === filter) ? filter : "";
  const themeRecords = selected
    ? records.filter((record) => record.themeId === selected)
    : records;
  const matching = (record: {
    themeId: string;
    targetType: string;
    targetId: string;
  }) =>
    (!subjectFilter ||
      themes.find((theme) => theme.id === record.themeId)?.subjectId ===
        subjectFilter) &&
    (!itemFilter ||
      (record.targetType === "item" && record.targetId === itemFilter));
  const filtered = themeRecords.filter(
    (record) =>
      matching(record) &&
      (!targetFilter || record.targetType === targetFilter) &&
      (!activityFilter || record.activity === activityFilter),
  );
  const filteredFeedbacks = feedbacks.filter(
    (entry) =>
      (!selected || entry.themeId === selected) &&
      matching(entry) &&
      (!targetFilter || entry.targetType === targetFilter) &&
      (!activityFilter || activityFilter === "feedback"),
  );
  return (
    <>
      <section className="page-intro">
        <h1>学習記録</h1>
      </section>
      <details
        className="history-more-filters"
        open={!!initialItem || undefined}
      >
        <summary>科目・項目で絞り込む</summary>
        <div className="history-filter">
          <label htmlFor="history-subject">科目</label>
          <select
            id="history-subject"
            value={subjectFilter}
            onChange={(event) => {
              setSubjectFilter(event.target.value);
              setFilter("");
              setItemFilter("");
            }}
          >
            <option value="">すべての科目</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
        </div>
        <div className="history-filter">
          <label htmlFor="history-item">学習項目で絞り込む</label>
          <select
            id="history-item"
            value={itemFilter}
            onChange={(event) => setItemFilter(event.target.value)}
          >
            <option value="">すべての項目</option>
            {items
              .filter(
                (item) =>
                  (!selected || item.themeId === selected) &&
                  (!subjectFilter ||
                    themes.find((theme) => theme.id === item.themeId)
                      ?.subjectId === subjectFilter),
              )
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
          </select>
        </div>
      </details>
      <div className="history-filter">
        <label htmlFor="history-theme">学習テーマ</label>
        <select
          id="history-theme"
          value={selected}
          onChange={(e) => {
            setFilter(e.target.value);
            setItemFilter("");
          }}
        >
          <option value="">すべてのテーマ</option>
          {themes
            .filter(
              (theme) => !subjectFilter || theme.subjectId === subjectFilter,
            )
            .map((theme) => (
              <option value={theme.id} key={theme.id}>
                {theme.name}
              </option>
            ))}
        </select>
      </div>
      <div className="history-filter">
        <label htmlFor="history-target">学習対象</label>
        <select
          id="history-target"
          value={targetFilter}
          onChange={(e) => setTargetFilter(e.target.value)}
        >
          <option value="">すべての対象</option>
          <option value="theme">テーマ全体</option>
          <option value="item">学習項目</option>
        </select>
      </div>
      <div className="history-filter">
        <label htmlFor="history-activity">記録の種類</label>
        <select
          id="history-activity"
          value={activityFilter}
          onChange={(event) => setActivityFilter(event.target.value)}
        >
          <option value="">すべての記録</option>
          <option value="output">アウトプット</option>
          <option value="deepen">理解を深める</option>
          <option value="memo">学習メモ</option>
          <option value="feedback">AIフィードバック</option>
        </select>
      </div>
      <div className="section-heading">
        <h2>
          学習記録{" "}
          <span className="count">
            {filtered.length + filteredFeedbacks.length}
          </span>
        </h2>
      </div>
      {filtered.length + filteredFeedbacks.length ? (
        <RecordList
          records={filtered}
          feedbacks={filteredFeedbacks}
          themes={themes}
          items={items}
          showTheme
        />
      ) : (
        <div className="empty-state">
          <History size={30} strokeWidth={1} />
          <h2>まだ記録はありません。</h2>
          <Button asChild variant="outline">
            <Link href="/">
              学習テーマへ
              <ArrowRight />
            </Link>
          </Button>
        </div>
      )}
    </>
  );
}
