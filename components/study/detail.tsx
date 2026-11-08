"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ArrowRight, BookOpen, Timer, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { PencilUnderline } from "@/components/trace/pencil-art";
import { features } from "@/lib/features";
import { examHref, roadmapHref } from "@/lib/learning-context";
import { useStudy } from "./provider";
import { studyRepository } from "@/lib/storage";
import { BackLink, Progress, RecordList } from "./shared";
import { ThemeForm } from "./theme-form";
import { RecordForm } from "./record-form";
import { ActionMenu } from "./action-menu";
import { DailyActions } from "./daily-actions";
import { LearningScreen } from "./learning-screen";
import { latestMastery, masteryCounts } from "@/lib/ratings";
import { MasteryBadge } from "./mastery-badge";
import { MasteryEditor } from "./mastery-control";
import { RoadmapItems } from "./roadmap-items";
import { SubjectExamsScreen } from "./subject-exams";
export function MissingTheme() {
  return (
    <>
      <BackLink />
      <div className="empty-state">
        <BookOpen strokeWidth={1} size={30} />
        <h1>テーマが見つかりません</h1>
        <Button asChild>
          <Link href="/">ホームに戻る</Link>
        </Button>
      </div>
    </>
  );
}
export function DetailScreen({
  id,
  initialItemId,
}: {
  id: string;
  initialItemId?: string;
}) {
  const { themes, subjects, items, records, masteryHistory, refresh } =
    useStudy();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [masteryOpen, setMasteryOpen] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const theme = themes.find((theme) => theme.id === id);
  if (!theme) return <MissingTheme />;
  const subject = subjects.find((subject) => subject.id === theme.subjectId);
  const themeItems = items.filter((item) => item.themeId === id);
  const counts = masteryCounts(themeItems, masteryHistory);
  const level = latestMastery(masteryHistory, { type: "theme", id });
  const recent = records.filter((record) => record.themeId === id).slice(0, 3);
  async function remove() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await studyRepository.deleteTheme(id);
      setDeleteOpen(false);
      router.replace("/");
      await refresh();
    } catch {
      setError("削除できませんでした。再試行してください。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="theme-learning-page">
      <header className="detail-intro">
        <div className="detail-topline">
          <span className="subject-label">
            {subject?.name ?? theme.subject}
          </span>
          <ActionMenu
            label="テーマのメニュー"
            onEdit={() => setEditOpen(true)}
            onMastery={() => setMasteryOpen(true)}
            onDelete={() => {
              setError("");
              setDeleteOpen(true);
            }}
          />
        </div>
        <h1 className="theme-title">{theme.name}</h1>
        <PencilUnderline />
        <MasteryBadge level={level} label="テーマ全体の習得度" />
        {theme.description && (
          <details className="theme-goal-disclosure">
            <summary>学習目標</summary>
            <p className="detail-description">{theme.description}</p>
          </details>
        )}
      </header>
      <Link
        href={roadmapHref(id)}
        className="compact-roadmap-entry"
        aria-label="ロードマップを見る"
        aria-describedby="theme-progress-count"
      >
        <span id="theme-progress-count">
          説明できる以上{" "}
          <strong>
            {counts[3] + counts[4]} / {counts.total}
          </strong>{" "}
          項目
        </span>
        <ChevronRight size={17} />
      </Link>
      <RoadmapItems
        key={`${id}:${initialItemId ?? ""}`}
        themeId={id}
        initialItemId={initialItemId}
        preview
      />
      <section className="daily-section">
        <div className="section-heading">
          <h2>テーマ全体を学ぶ</h2>
        </div>
        <DailyActions themeId={id} />
      </section>
      <section className="exam-section">
        <h2>過去問・演習</h2>
        <Button asChild variant="outline" className="exam-entry">
          <Link href={examHref(theme.subjectId, id)}>
            <BookOpen />
            <span>過去問</span>
            <small>準備中</small>
            <ChevronRight />
          </Link>
        </Button>
      </section>
      <div className="focus-section">
        <Button asChild className="focus-button">
          <Link href={`/themes/${id}/pomodoro`}>
            <Timer />
            集中する<small>準備中</small>
          </Link>
        </Button>
      </div>
      <section className="recent-section">
        <div className="section-heading">
          <h2>学習記録</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRecordOpen(true)}
          >
            <Plus />
            学習を記録
          </Button>
        </div>
        {recent.length ? (
          <>
            <RecordList records={recent} themes={themes} items={items} />
            <Link className="text-link" href={`/history?theme=${id}`}>
              すべて見る
              <ArrowRight size={14} />
            </Link>
          </>
        ) : (
          <p className="quiet-empty">まだ記録はありません。</p>
        )}
      </section>
      <MasteryEditor
        themeId={id}
        target={{ type: "theme", id }}
        name={theme.name}
        open={masteryOpen}
        onClose={() => setMasteryOpen(false)}
      />
      <ThemeForm theme={theme} open={editOpen} onOpenChange={setEditOpen} />
      <RecordForm themeId={id} open={recordOpen} onOpenChange={setRecordOpen} />
      <Dialog
        open={deleteOpen}
        onOpenChange={(value) => {
          if (!busy) setDeleteOpen(value);
        }}
      >
        <DialogContent>
          <DialogTitle className="dialog-title">
            テーマを削除しますか？
          </DialogTitle>
          <DialogDescription className="dialog-description">
            「{theme.name}」と学習項目・記録を削除します。元に戻せません。
          </DialogDescription>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="form-actions">
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={busy}
            >
              キャンセル
            </Button>
            <Button
              variant="destructive"
              onClick={() => void remove()}
              disabled={busy}
            >
              削除する
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
function RoadmapScreen({
  themeId,
  itemId,
}: {
  themeId: string;
  itemId?: string;
}) {
  const { themes, items, masteryHistory } = useStudy();
  const theme = themes.find((theme) => theme.id === themeId);
  if (!theme) return <MissingTheme />;
  return (
    <>
      <BackLink href={`/themes/${themeId}`}>テーマに戻る</BackLink>
      <header className="roadmap-heading">
        <h1>ロードマップ</h1>
        <p>{theme.name}</p>
        <Progress
          items={items.filter((item) => item.themeId === themeId)}
          label={theme.name}
          history={masteryHistory}
        />
      </header>
      <RoadmapItems
        key={`${themeId}:${itemId ?? ""}`}
        themeId={themeId}
        initialItemId={itemId}
      />
    </>
  );
}
export function FeatureScreen({
  id,
  slug,
  itemId,
  fromTheme = false,
}: {
  id: string;
  slug: string;
  itemId?: string;
  fromTheme?: boolean;
}) {
  const { themes } = useStudy();
  const theme = themes.find((theme) => theme.id === id);
  if (!theme) return <MissingTheme />;
  if (slug === "output" || slug === "deepen")
    return (
      <LearningScreen
        key={`${id}:${slug}:${itemId ?? "theme"}`}
        themeId={id}
        feature={slug}
        itemId={itemId}
        fromTheme={fromTheme}
      />
    );
  if (slug === "roadmap") return <RoadmapScreen themeId={id} itemId={itemId} />;
  if (slug === "past-exams")
    return <SubjectExamsScreen subjectId={theme.subjectId} themeId={id} />;
  const feature = features.find((feature) => feature.slug === slug);
  return (
    <>
      <BackLink href={`/themes/${id}`}>テーマに戻る</BackLink>
      <section className="feature-placeholder">
        {feature ? (
          <>
            <feature.icon size={36} strokeWidth={1} />
            <h1>{feature.name}</h1>
            <span className="phase-badge">準備中 · 現在は利用できません</span>
          </>
        ) : (
          <h1>ページが見つかりません</h1>
        )}
        <Button asChild variant="outline">
          <Link href={`/themes/${id}`}>
            テーマに戻る
            <ArrowRight />
          </Link>
        </Button>
      </section>
    </>
  );
}
