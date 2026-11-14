"use client";
import Link from "next/link";
import { useState } from "react";
import { useStudy } from "./provider";
import { BackLink } from "./shared";
import { RecordDetail } from "./record-detail";
import { SegmentedControl } from "./segmented-control";
import {
  filterRecords,
  recordFilters,
  recordKindLabel,
  type RecordFilter,
} from "@/lib/record-filters";
import { dateLabel } from "@/lib/model";
import { itemHref, themeHref } from "@/lib/learning-context";
export function HistoryScreen({
  initialTheme = "",
  initialItem = "",
}: {
  initialTheme?: string;
  initialItem?: string;
}) {
  const { records, themes, subjects, items } = useStudy();
  const [subjectFilter, setSubjectFilter] = useState("");
  const [itemFilter, setItemFilter] = useState(initialItem);
  const [filter, setFilter] = useState(initialTheme);
  const [targetFilter, setTargetFilter] = useState("");
  const [activityFilter, setActivityFilter] = useState<RecordFilter>("all");
  const [opened, setOpened] = useState<Set<string>>(() => new Set());
  const originalTheme = themes.find((entry) => entry.id === initialTheme);
  const originalItem = items.find(
    (entry) =>
      entry.id === initialItem &&
      (!initialTheme || entry.themeId === initialTheme),
  );
  const invalidScope =
    (!!initialTheme && !originalTheme) || (!!initialItem && !originalItem);
  const back = originalItem
    ? itemHref(originalItem.themeId, originalItem.id)
    : originalTheme
      ? themeHref(originalTheme.id)
      : "/";
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
  const filtered = filterRecords(themeRecords, activityFilter).filter(
    (record) =>
      matching(record) && (!targetFilter || record.targetType === targetFilter),
  );
  if (invalidScope)
    return (
      <>
        <BackLink href={originalTheme ? themeHref(originalTheme.id) : "/"}>
          学習対象へ戻る
        </BackLink>
        <p className="quiet-empty">学習対象が見つかりません。</p>
      </>
    );
  return (
    <div className="learning-notebook">
      <BackLink href={back}>
        {originalItem
          ? "学習項目に戻る"
          : originalTheme
            ? "テーマに戻る"
            : "ホーム"}
      </BackLink>
      <section className="page-intro">
        <h1>学習ノート</h1>
        <p className="notebook-context">
          {originalItem?.title ?? originalTheme?.name ?? "学びの記録"}
        </p>
      </section>
      <SegmentedControl
        label="ノートの絞り込み"
        value={activityFilter}
        options={recordFilters}
        onChange={setActivityFilter}
      />
      <details className="history-more-filters">
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
      </details>
      <div className="section-heading">
        <h2>
          学習記録 <span className="count">{filtered.length}</span>
        </h2>
      </div>
      {filtered.length ? (
        <div className="notebook-records">
          {filtered.map((record) => {
            const targetName =
              record.targetType === "item"
                ? (items.find((entry) => entry.id === record.targetId)?.title ??
                  "学習項目")
                : (themes.find((entry) => entry.id === record.themeId)?.name ??
                  "テーマ全体");
            return (
              <details
                className="notebook-record"
                key={record.id}
                open={opened.has(record.id)}
                onToggle={(event) => {
                  const isOpen = event.currentTarget.open;
                  setOpened((old) => {
                    if (old.has(record.id) === isOpen) return old;
                    const next = new Set(old);
                    if (isOpen) next.add(record.id);
                    else next.delete(record.id);
                    return next;
                  });
                }}
              >
                <summary>
                  <span className="notebook-record-meta">
                    <time dateTime={record.studiedAt}>
                      {dateLabel(record.studiedAt, true)}
                    </time>
                    <span className="record-kind" data-kind={record.activity}>
                      {recordKindLabel(record)}
                    </span>
                  </span>
                  <span className="notebook-target">{targetName}</span>
                  <span className="notebook-title">
                    {record.activity === "deepen"
                      ? (record.question ?? record.note)
                      : (record.title ??
                        (record.activity === "output"
                          ? targetName
                          : record.note.slice(0, 80)))}
                  </span>
                </summary>
                {opened.has(record.id) && (
                  <div className="notebook-record-body">
                    <RecordDetail id={record.id} embedded />
                  </div>
                )}
              </details>
            );
          })}
        </div>
      ) : (
        <p className="quiet-empty">該当する記録はありません。</p>
      )}
    </div>
  );
}
