"use client";
import Link from "next/link";
import { useState } from "react";
import { Plus, ArrowRight, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudy } from "./provider";
import { ThemeForm } from "./theme-form";
import { EmptyThemes, ThemeCard } from "./shared";
import { dateLabel } from "@/lib/model";
export function HomeScreen() {
  const { themes, records } = useStudy();
  const [open, setOpen] = useState(false);
  const recent = themes
    .filter((theme) => theme.lastStudiedAt)
    .sort((a, b) => b.lastStudiedAt!.localeCompare(a.lastStudiedAt!))
    .slice(0, 3);
  const today = new Intl.DateTimeFormat("ja-JP", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date());
  return (
    <>
      <section className="home-intro">
        <div className="intro-topline">
          <span className="eyebrow">A LITTLE SPACE FOR LEARNING</span>
          <time className="today">{today}</time>
        </div>
        <h1>
          学びに、
          <br className="mobile-break" />
          余白を。
        </h1>
        <p>
          「わかる」を、自分の言葉に。
          <br />
          あなたの理解を、一冊ずつ育てよう。
        </p>
        <div className="intro-rule">
          <span>YOUR PERSONAL STUDY NOTEBOOK</span>
          <span>01 —</span>
        </div>
      </section>
      <section className="recent-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">PICK UP WHERE YOU LEFT OFF</span>
            <h2>最近の学び</h2>
          </div>
          {recent.length > 0 && (
            <Link href="/history" className="text-link">
              記録を見る
              <ArrowRight size={14} />
            </Link>
          )}
        </div>
        {recent.length ? (
          <div className="recent-list">
            {recent.map((theme) => (
              <Link
                href={`/themes/${theme.id}`}
                key={theme.id}
                className="recent-item"
              >
                <span className="recent-book" aria-hidden="true">
                  学
                </span>
                <div>
                  <span className="subject-text">{theme.subject}</span>
                  <h3>{theme.name}</h3>
                  <span className="muted-text">
                    {dateLabel(theme.lastStudiedAt!)}に学習
                  </span>
                </div>
                <ArrowUpRight size={18} />
              </Link>
            ))}
          </div>
        ) : (
          <p className="quiet-empty">
            {themes.length
              ? "テーマを開いて「学習を記録」すると、ここに表示されます。"
              : "ここに、あなたの学びの続きが並びます。"}
          </p>
        )}
      </section>
      <section className="themes-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">YOUR COLLECTION</span>
            <h2>
              学習テーマ <span className="count">{themes.length}</span>
            </h2>
          </div>
          <Button onClick={() => setOpen(true)} variant="outline" size="sm">
            <Plus />
            テーマを追加
          </Button>
        </div>
        {themes.length ? (
          <div className="theme-grid">
            {themes.map((theme, index) => (
              <ThemeCard key={theme.id} theme={theme} index={index} />
            ))}
          </div>
        ) : (
          <EmptyThemes onCreate={() => setOpen(true)} />
        )}
      </section>
      <footer className="page-colophon">
        <span>積み重ねた学びは、あなたのもの。</span>
        <span>{records.length} LEARNING NOTES</span>
      </footer>
      <ThemeForm open={open} onOpenChange={setOpen} />
    </>
  );
}
