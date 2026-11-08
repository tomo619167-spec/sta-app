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
export function DetailScreen({ id }: { id: string }) {
  const { themes, subjects, items, records, refresh } = useStudy();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const theme = themes.find((theme) => theme.id === id);
  if (!theme) return <MissingTheme />;
  const subject = subjects.find((subject) => subject.id === theme.subjectId);
  const themeItems = items.filter((item) => item.themeId === id);
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
    <>
      <BackLink />
      <header className="detail-intro">
        <div className="detail-topline">
          <span className="subject-label">
            {subject?.name ?? theme.subject}
          </span>
          <ActionMenu
            label="テーマのメニュー"
            onEdit={() => setEditOpen(true)}
            onDelete={() => {
              setError("");
              setDeleteOpen(true);
            }}
          />
        </div>
        <h1>{theme.name}</h1>
        {theme.description && (
          <p className="detail-description">{theme.description}</p>
        )}
      </header>
      <Link
        href={roadmapHref(id)}
        className="roadmap-entry"
        aria-label="ロードマップを見る"
      >
        <div className="section-heading">
          <h2>ロードマップ</h2>
          <ChevronRight size={18} />
        </div>
        <Progress items={themeItems} label={theme.name} />
      </Link>
      <section className="daily-section">
        <div className="section-heading">
          <h2>日常学習</h2>
          <span className="section-scope">テーマ全体</span>
        </div>
        <DailyActions themeId={id} />
      </section>
      <section className="exam-section">
        <h2>過去問</h2>
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
    </>
  );
}
function RoadmapScreen({
  themeId,
  itemId,
}: {
  themeId: string;
  itemId?: string;
}) {
  const { themes, items } = useStudy();
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
}: {
  id: string;
  slug: string;
  itemId?: string;
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
