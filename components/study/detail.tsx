"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  ArrowRight,
  BookOpen,
  Timer,
  Map,
  PenLine,
  Lightbulb,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { features } from "@/lib/features";
import type { StudyItem } from "@/lib/model";
import { studyRepository } from "@/lib/storage";
import { useStudy } from "./provider";
import { BackLink, Progress, RecordList } from "./shared";
import { ThemeForm } from "./theme-form";
import { RecordForm } from "./record-form";
import { ItemForm } from "./item-form";
import { ActionMenu } from "./action-menu";
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
  const [itemOpen, setItemOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StudyItem>();
  const [removeTarget, setRemoveTarget] = useState<{
    kind: "theme" | "item";
    id: string;
    name: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingItem, setPendingItem] = useState<{
    id: string;
    completed: boolean;
  } | null>(null);
  const [error, setError] = useState("");
  const theme = themes.find((theme) => theme.id === id);
  if (!theme) return <MissingTheme />;
  const subject = subjects.find((subject) => subject.id === theme.subjectId);
  const themeItems = items.filter((item) => item.themeId === id);
  const recent = records.filter((record) => record.themeId === id).slice(0, 3);
  async function remove() {
    if (busy || !removeTarget) return;
    setBusy(true);
    setError("");
    try {
      if (removeTarget.kind === "theme") {
        await studyRepository.deleteTheme(id);
        setRemoveTarget(null);
        router.replace("/");
      } else {
        await studyRepository.deleteItem(removeTarget.id);
        setRemoveTarget(null);
      }
      await refresh();
    } catch {
      setError("削除できませんでした。再試行してください。");
    } finally {
      setBusy(false);
    }
  }
  async function toggle(item: StudyItem) {
    if (busy) return;
    setPendingItem({ id: item.id, completed: !item.completed });
    setBusy(true);
    setError("");
    try {
      await studyRepository.updateItem(item.id, {
        title: item.title,
        completed: !item.completed,
      });
      await refresh();
    } catch {
      setError("保存できませんでした。再試行してください。");
    } finally {
      setPendingItem(null);
      setBusy(false);
    }
  }
  const shortcuts = [
    { slug: "roadmap", label: "ロードマップ", icon: Map },
    { slug: "output", label: "アウトプット", icon: PenLine },
    { slug: "deepen", label: "理解を深める", icon: Lightbulb },
    { slug: "past-exams", label: "過去問", icon: BookOpen },
  ];
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
              setRemoveTarget({ kind: "theme", id, name: theme.name });
            }}
          />
        </div>
        <h1>{theme.name}</h1>
        {theme.description && (
          <p className="detail-description">{theme.description}</p>
        )}
        <Progress items={themeItems} label={theme.name} />
      </header>
      <nav className="learning-actions" aria-label="学習機能">
        <div className="feature-grid">
          {shortcuts.map(({ slug, label, icon: Icon }) => (
            <Button asChild variant="outline" key={slug}>
              <Link href={`/themes/${id}/${slug}`}>
                <Icon />
                <span>{label}</span>
                <small>準備中</small>
              </Link>
            </Button>
          ))}
        </div>
        <Button asChild className="focus-button">
          <Link href={`/themes/${id}/pomodoro`}>
            <Timer />
            集中する<small>準備中</small>
          </Link>
        </Button>
      </nav>
      <section className="items-section">
        <div className="section-heading">
          <h2>
            学習項目 <span className="count">{themeItems.length}</span>
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditingItem(undefined);
              setItemOpen(true);
            }}
          >
            <Plus />
            項目を追加
          </Button>
        </div>
        {themeItems.length ? (
          <ul className="item-list">
            {themeItems.map((item) => (
              <li key={item.id}>
                <label className="item-check">
                  <input
                    type="checkbox"
                    checked={
                      pendingItem?.id === item.id
                        ? pendingItem.completed
                        : item.completed
                    }
                    onChange={() => void toggle(item)}
                    disabled={busy}
                  />
                  <span>{item.title}</span>
                </label>
                <ActionMenu
                  label={`${item.title}のメニュー`}
                  onEdit={() => {
                    setEditingItem(item);
                    setItemOpen(true);
                  }}
                  onDelete={() => {
                    setError("");
                    setRemoveTarget({
                      kind: "item",
                      id: item.id,
                      name: item.title,
                    });
                  }}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="quiet-empty">項目を追加して、学びを小さく。</p>
        )}
      </section>
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
            <RecordList records={recent} themes={themes} />
            <Link className="text-link" href={`/history?theme=${id}`}>
              すべて見る
              <ArrowRight size={14} />
            </Link>
          </>
        ) : (
          <p className="quiet-empty">まだ記録はありません。</p>
        )}
      </section>
      {error && !removeTarget && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <ThemeForm theme={theme} open={editOpen} onOpenChange={setEditOpen} />
      <RecordForm themeId={id} open={recordOpen} onOpenChange={setRecordOpen} />
      <ItemForm
        themeId={id}
        item={editingItem}
        open={itemOpen}
        onClose={() => setItemOpen(false)}
      />
      <Dialog
        open={!!removeTarget}
        onOpenChange={(value) => {
          if (!value && !busy) setRemoveTarget(null);
        }}
      >
        <DialogContent>
          <DialogTitle className="dialog-title">
            {removeTarget?.kind === "theme" ? "テーマ" : "学習項目"}
            を削除しますか？
          </DialogTitle>
          <DialogDescription className="dialog-description">
            「{removeTarget?.name}」
            {removeTarget?.kind === "theme" ? "と学習項目・記録" : ""}
            を削除します。元に戻せません。
          </DialogDescription>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="form-actions">
            <Button
              variant="outline"
              onClick={() => setRemoveTarget(null)}
              disabled={busy}
              autoFocus
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
export function FeatureScreen({ id, slug }: { id: string; slug: string }) {
  const { themes } = useStudy();
  const theme = themes.find((theme) => theme.id === id);
  const feature = features.find((feature) => feature.slug === slug);
  if (!theme) return <MissingTheme />;
  return (
    <>
      <BackLink href={`/themes/${id}`}>テーマに戻る</BackLink>
      <section className="feature-placeholder">
        {feature ? (
          <>
            <feature.icon size={36} strokeWidth={1} />
            <h1>{feature.name}</h1>
            <span className="phase-badge">準備中 · 現在は利用できません</span>
            <p>
              {feature.slug === "roadmap"
                ? "ロードマップの整理・JSON取り込みはPhase 2で追加します。"
                : `Phase ${feature.phase}で追加予定です。`}
            </p>
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
