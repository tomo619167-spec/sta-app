"use client";
import Link from "next/link";
import { useState } from "react";
import {
  Plus,
  ChevronRight,
  Globe2,
  Triangle,
  BookOpen,
  ChartNoAxesCombined,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudy } from "./provider";
import { ThemeForm } from "./theme-form";
import { EmptyThemes } from "./shared";
import { ActionMenu } from "./action-menu";
import { SubjectManager } from "./subject-manager";
import { progress } from "@/lib/model";
import { subjectProgress } from "@/lib/study-summary";
import { BookSketch } from "@/components/trace/pencil-art";
import { StudySummary } from "@/components/trace/study-summary";
function SubjectIcon({ name }: { name: string }) {
  const Icon = /数学|算数|数理/.test(name)
    ? Triangle
    : /歴史|世界|地理|史/.test(name)
      ? Globe2
      : /経済|統計/.test(name)
        ? ChartNoAxesCombined
        : BookOpen;
  return <Icon className="subject-icon" aria-hidden="true" />;
}
export function HomeScreen() {
  const { themes, subjects, items } = useStudy();
  const [open, setOpen] = useState(false);
  const [manager, setManager] = useState(false);
  const [managerAction, setManagerAction] = useState<"list" | "create">("list");
  const [filter, setFilter] = useState("");
  const recent = themes
    .filter((theme) => theme.lastStudiedAt)
    .sort((a, b) => b.lastStudiedAt!.localeCompare(a.lastStudiedAt!))
    .slice(0, 2);
  const shown = subjects.filter((subject) => !filter || subject.id === filter);
  const now = new Date();
  const date = new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .replace("/", ".");
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(
    now,
  );
  return (
    <>
      <header className="home-heading">
        <div>
          <h1>学びのノート</h1>
          <time
            className="home-date"
            dateTime={`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`}
          >
            {date}
            <span>{weekday}</span>
          </time>
        </div>
        <BookSketch />
      </header>
      <p className="brand-concept">学びの軌跡を、ノートに残す。</p>
      <StudySummary />
      <section className="collection">
        <div className="collection-heading">
          <h2>科目</h2>
          <div className="collection-actions">
            <Button onClick={() => setOpen(true)} size="sm" variant="ghost">
              <Plus />
              テーマ
            </Button>
            <ActionMenu
              label="科目の管理"
              editLabel="科目を管理"
              onEdit={() => {
                setManagerAction("list");
                setManager(true);
              }}
            />
          </div>
        </div>
        {subjects.length > 1 && (
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
        {shown.map((subject) => {
          const value = subjectProgress(subject.id, themes, items);
          return (
            <section className="subject-group" key={subject.id}>
              <div className="subject-heading">
                <SubjectIcon name={subject.name} />
                <div className="subject-heading-title">
                  <h3>{subject.name}</h3>
                  <span>{value.themeCount} テーマ</span>
                </div>
                <div className="subject-progress">
                  <strong>
                    {value.percent}
                    <small>%</small>
                  </strong>
                  <div
                    className="progress-track"
                    role="progressbar"
                    aria-label={`${subject.name}の習得進捗`}
                    aria-valuenow={value.percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <span style={{ width: `${value.percent}%` }} />
                  </div>
                </div>
              </div>
              <div className="theme-list">
                {themes
                  .filter((theme) => theme.subjectId === subject.id)
                  .map((theme) => {
                    const themeValue = progress(
                      items.filter((item) => item.themeId === theme.id),
                    );
                    return (
                      <Link
                        className="theme-row"
                        href={`/themes/${theme.id}`}
                        key={theme.id}
                      >
                        <span>{theme.name}</span>
                        <small>{themeValue.percent}%</small>
                        <ChevronRight size={16} />
                      </Link>
                    );
                  })}
              </div>
              {!value.themeCount && (
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
          );
        })}
        {!themes.length && !subjects.length && (
          <EmptyThemes onCreate={() => setOpen(true)} />
        )}
        <Button
          className="home-add-subject"
          variant="outline"
          onClick={() => {
            setFilter("");
            setManagerAction("create");
            setManager(true);
          }}
        >
          <Plus />
          科目を追加
        </Button>
      </section>
      {recent.length > 0 && (
        <section className="recent-section home-recent">
          <div className="section-heading">
            <h2>学びのつづき</h2>
            <Link href="/history" className="text-link">
              記録を見る
              <ChevronRight size={14} />
            </Link>
          </div>
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
      <footer className="notebook-colophon">
        TRACE Note <span>—</span> YOUR LEARNING, TRACED.
      </footer>
      <ThemeForm open={open} onOpenChange={setOpen} initialSubjectId={filter} />
      <SubjectManager
        open={manager}
        onClose={() => setManager(false)}
        initialAction={managerAction}
      />
    </>
  );
}
