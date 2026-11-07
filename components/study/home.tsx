"use client";
import Link from "next/link";
import { useState } from "react";
import { Plus, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudy } from "./provider";
import { ThemeForm } from "./theme-form";
import { EmptyThemes } from "./shared";
import { ActionMenu } from "./action-menu";
import { SubjectManager } from "./subject-manager";
import { progress } from "@/lib/model";
export function HomeScreen() {
  const { themes, subjects, items } = useStudy();
  const [open, setOpen] = useState(false);
  const [manager, setManager] = useState(false);
  const [filter, setFilter] = useState("");
  const recent = themes
    .filter((theme) => theme.lastStudiedAt)
    .sort((a, b) => b.lastStudiedAt!.localeCompare(a.lastStudiedAt!))
    .slice(0, 2);
  const shown = subjects.filter((subject) => !filter || subject.id === filter);
  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">MY NOTEBOOK</span>
          <h1>学びのノート</h1>
        </div>
        <Button onClick={() => setOpen(true)} size="sm">
          <Plus />
          テーマ
        </Button>
      </header>
      {recent.length > 0 && (
        <section className="recent-section">
          <h2>最近の学び</h2>
          <div className="recent-links">
            {recent.map((theme) => (
              <Link key={theme.id} href={`/themes/${theme.id}`}>
                {theme.name}
                <ChevronRight size={16} />
              </Link>
            ))}
          </div>
        </section>
      )}
      <section className="collection">
        <div className="collection-heading">
          <h2>科目</h2>
          <ActionMenu
            label="科目の管理"
            editLabel="科目を管理"
            onEdit={() => setManager(true)}
          />
        </div>
        {subjects.length > 0 && (
          <div className="subject-tabs" aria-label="科目で絞り込み">
            <button onClick={() => setFilter("")} aria-pressed={!filter}>
              すべて
            </button>
            {subjects.map((subject) => (
              <button
                key={subject.id}
                onClick={() => setFilter(subject.id)}
                aria-pressed={filter === subject.id}
              >
                {subject.name}
              </button>
            ))}
          </div>
        )}
        {shown.map((subject) => (
          <section className="subject-group" key={subject.id}>
            <div className="subject-heading">
              <h3>{subject.name}</h3>
              <span>
                {
                  themes.filter((theme) => theme.subjectId === subject.id)
                    .length
                }{" "}
                テーマ
              </span>
            </div>
            <div className="theme-list">
              {themes
                .filter((theme) => theme.subjectId === subject.id)
                .map((theme) => {
                  const value = progress(
                    items.filter((item) => item.themeId === theme.id),
                  );
                  return (
                    <Link
                      className="theme-row"
                      href={`/themes/${theme.id}`}
                      key={theme.id}
                    >
                      <span>{theme.name}</span>
                      <small>{value.percent}%</small>
                      <ChevronRight size={17} />
                    </Link>
                  );
                })}
            </div>
            {!themes.some((theme) => theme.subjectId === subject.id) && (
              <button
                className="empty-subject"
                onClick={() => {
                  setFilter(subject.id);
                  setOpen(true);
                }}
              >
                ＋ テーマを追加
              </button>
            )}
          </section>
        ))}
        {!themes.length && !subjects.length && (
          <EmptyThemes onCreate={() => setOpen(true)} />
        )}
      </section>
      <ThemeForm open={open} onOpenChange={setOpen} initialSubjectId={filter} />
      <SubjectManager open={manager} onClose={() => setManager(false)} />
    </>
  );
}
