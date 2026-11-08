"use client";
import Link from "next/link";
import { useState } from "react";
import { History, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudy } from "./provider";
import { RecordList } from "./shared";
export function HistoryScreen({
  initialTheme = "",
}: {
  initialTheme?: string;
}) {
  const { records, themes, items } = useStudy();
  const [filter, setFilter] = useState(initialTheme);
  const [targetFilter, setTargetFilter] = useState("");
  const [activityFilter, setActivityFilter] = useState("");
  const selected = themes.some((theme) => theme.id === filter) ? filter : "";
  const themeRecords = selected
    ? records.filter((record) => record.themeId === selected)
    : records;
  const filtered = themeRecords.filter(
    (record) =>
      (!targetFilter || record.targetType === targetFilter) &&
      (!activityFilter || record.activity === activityFilter),
  );
  return (
    <>
      <section className="page-intro">
        <h1>学習記録</h1>
      </section>
      <div className="history-filter">
        <label htmlFor="history-theme">学習テーマ</label>
        <select
          id="history-theme"
          value={selected}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">すべてのテーマ</option>
          {themes.map((theme) => (
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
        </select>
      </div>
      <div className="section-heading">
        <h2>
          学習記録 <span className="count">{filtered.length}</span>
        </h2>
      </div>
      {filtered.length ? (
        <RecordList
          records={filtered}
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
