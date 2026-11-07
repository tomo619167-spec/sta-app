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
  const { records, themes } = useStudy();
  const [filter, setFilter] = useState(initialTheme);
  const selected = themes.some((theme) => theme.id === filter) ? filter : "";
  const filtered = selected
    ? records.filter((record) => record.themeId === selected)
    : records;
  return (
    <>
      <section className="page-intro">
        <span className="eyebrow">LITTLE STEPS, LASTING KNOWLEDGE</span>
        <h1>学びの足あと。</h1>
        <p>積み重ねた言葉が、理解の輪郭になる。</p>
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
      <div className="section-heading">
        <h2>
          学習記録 <span className="count">{filtered.length}</span>
        </h2>
      </div>
      {filtered.length ? (
        <RecordList records={filtered} themes={themes} showTheme />
      ) : (
        <div className="empty-state">
          <History size={30} strokeWidth={1} />
          <h2>最初の一歩を、残そう。</h2>
          <p>
            テーマの詳細画面から「学習を記録」で
            <br />
            今日の学びを書き留められます。
          </p>
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
