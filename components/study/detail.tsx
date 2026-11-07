"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Pencil,
  Trash2,
  Plus,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { features } from "@/lib/features";
import { dateLabel } from "@/lib/model";
import { studyRepository } from "@/lib/storage";
import { useStudy } from "./provider";
import { BackLink, Progress, RecordList } from "./shared";
import { ThemeForm } from "./theme-form";
import { RecordForm } from "./record-form";
export function MissingTheme() {
  return (
    <>
      <BackLink />
      <div className="empty-state">
        <BookOpen strokeWidth={1} size={30} />
        <h1>テーマが見つかりません</h1>
        <p>この端末に保存されていないか、削除されたテーマです。</p>
        <Button asChild>
          <Link href="/">ホームに戻る</Link>
        </Button>
      </div>
    </>
  );
}
export function DetailScreen({ id }: { id: string }) {
  const { themes, records, refresh } = useStudy();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const theme = themes.find((theme) => theme.id === id);
  if (!theme) return <MissingTheme />;
  const recent = records.filter((record) => record.themeId === id).slice(0, 5);
  async function remove() {
    if (deleting) return;
    setDeleting(true);
    setError("");
    try {
      await studyRepository.deleteTheme(id);
      await refresh();
      router.replace("/");
    } catch {
      setError("削除できませんでした。時間をおいて再試行してください。");
      setDeleting(false);
    }
  }
  return (
    <>
      <BackLink />
      <section className="detail-intro">
        <div className="detail-topline">
          <span className="subject">{theme.subject}</span>
          <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil />
            編集
          </Button>
        </div>
        <h1>{theme.name}</h1>
        <p className="detail-description">
          {theme.description ||
            "まだ説明がありません。学びたいことを書き添えてみましょう。"}
        </p>
        <span className="muted-text">{dateLabel(theme.createdAt)}に作成</span>
      </section>
      <section className="detail-progress">
        <div className="section-heading">
          <div>
            <span className="eyebrow">STEP BY STEP</span>
            <h2>理解の進捗</h2>
          </div>
          <span className="phase-badge">ロードマップは準備中</span>
        </div>
        <Progress theme={theme} />
        <p className="input-hint">
          Phase 2でロードマップを作成すると、ここに進捗が表示されます。
        </p>
      </section>
      <section>
        <div className="section-heading">
          <div>
            <span className="eyebrow">FIVE WAYS TO LEARN</span>
            <h2>学びを育てる</h2>
          </div>
        </div>
        <p className="section-description">
          5つの学習機能は今後追加予定です。各項目から予定内容を確認できます。
        </p>
        <div className="feature-list">
          {features.map((feature, index) => (
            <Link
              key={feature.slug}
              href={`/themes/${id}/${feature.slug}`}
              className="feature-item"
            >
              <span className="feature-index">0{index + 1}</span>
              <feature.icon size={21} strokeWidth={1.3} />
              <div>
                <h3>{feature.name}</h3>
                <p>{feature.label}</p>
              </div>
              <span className="feature-end">
                <span>準備中</span>
                <ArrowUpRight size={15} />
              </span>
            </Link>
          ))}
        </div>
      </section>
      <section className="recent-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">YOUR LEARNING NOTES</span>
            <h2>最近の学習記録</h2>
          </div>
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
            <Link href={`/history?theme=${id}`} className="text-link">
              このテーマの記録をすべて見る
              <ArrowRight size={14} />
            </Link>
          </>
        ) : (
          <div className="quiet-record-empty">
            <Pencil size={20} strokeWidth={1.2} />
            <p>
              学んだことを、ひとこと。
              <br />
              <span>小さな記録が、理解の足あとになります。</span>
            </p>
          </div>
        )}
      </section>
      <div className="detail-footer">
        <span className="muted-text">
          このテーマと記録は端末内に保存されます
        </span>
        <Button
          variant="ghost"
          onClick={() => {
            setError("");
            setDeleteOpen(true);
          }}
          className="delete-link"
        >
          <Trash2 />
          テーマを削除
        </Button>
      </div>
      <ThemeForm theme={theme} open={editOpen} onOpenChange={setEditOpen} />
      <RecordForm themeId={id} open={recordOpen} onOpenChange={setRecordOpen} />
      <Dialog
        open={deleteOpen}
        onOpenChange={(value) => {
          if (!deleting) setDeleteOpen(value);
        }}
      >
        <DialogContent>
          <DialogTitle className="dialog-title">
            テーマを削除しますか？
          </DialogTitle>
          <DialogDescription className="dialog-description">
            「{theme.name}
            」と、このテーマの学習記録を削除します。この操作は元に戻せません。
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
              disabled={deleting}
              autoFocus
            >
              キャンセル
            </Button>
            <Button
              variant="destructive"
              onClick={() => void remove()}
              disabled={deleting}
            >
              {deleting ? "削除中…" : "削除する"}
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
  if (!feature)
    return (
      <>
        <BackLink href={`/themes/${id}`}>テーマに戻る</BackLink>
        <div className="empty-state">
          <h1>ページが見つかりません</h1>
        </div>
      </>
    );
  return (
    <>
      <BackLink href={`/themes/${id}`}>テーマに戻る</BackLink>
      <section className="feature-placeholder">
        <span className="eyebrow">COMING IN PHASE {feature.phase}</span>
        <feature.icon size={42} strokeWidth={1} />
        <h1>{feature.name}</h1>
        <span className="phase-badge">準備中 · 現在は利用できません</span>
        <h2>{feature.label}</h2>
        <p>{feature.description}</p>
        <div className="placeholder-note">
          現在のPhase
          1では、テーマの管理と学習メモの記録が使えます。AI機能はアプリ内に搭載せず、今後も外部AIとのコピー・取り込みで連携する方針です。
        </div>
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
