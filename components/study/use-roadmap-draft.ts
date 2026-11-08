"use client";
import { useEffect, useRef, useState } from "react";
import type { Theme } from "@/lib/model";
import { newRoadmapDraft, type RoadmapDraft } from "@/lib/roadmap-draft";
import { studyRepository } from "@/lib/storage";
export function useRoadmapDraft(theme: Theme) {
  const [draft, setDraft] = useState<RoadmapDraft>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const current = useRef<RoadmapDraft | undefined>(undefined);
  const pending = useRef<Promise<void>>(Promise.resolve());
  const mounted = useRef(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    setLoading(true);
    void studyRepository
      .getRoadmapDraft(theme.id)
      .then(
        (value) => {
          if (cancelled) return;
          current.current = value ?? newRoadmapDraft(theme);
          setDraft(current.current);
          setError("");
        },
        () => {
          if (!cancelled)
            setError("下書きを復元できませんでした。再試行してください。");
        },
      )
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      mounted.current = false;
    };
    // Theme changes remount the workflow; current draft inputs must not reset on refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme.id, attempt]);
  function update(patch: Partial<RoadmapDraft>) {
    if (!current.current) return;
    const next = {
      ...current.current,
      ...patch,
      themeId: theme.id,
      version: 1 as const,
    };
    current.current = next;
    setDraft(next);
    setSaving(true);
    setError("");
    // Serialize full snapshots; later keystrokes can never be overwritten by older writes.
    const operation = pending.current
      .catch(() => {})
      .then(() => studyRepository.saveRoadmapDraft(next));
    pending.current = operation;
    void operation.then(
      () => {
        if (mounted.current && pending.current === operation) {
          setSaving(false);
          setError("");
        }
      },
      () => {
        if (mounted.current && pending.current === operation) {
          setSaving(false);
          setError(
            "下書きを保存できませんでした。入力を残しています。再試行してください。",
          );
        }
      },
    );
  }
  function clearAfterImport() {
    const empty = newRoadmapDraft(theme);
    current.current = empty;
    setDraft(empty);
    setSaving(false);
    setError("");
  }
  return {
    draft,
    loading,
    error,
    saving,
    update,
    flush: () => pending.current,
    clearAfterImport,
    retry: () => (draft ? update({}) : setAttempt((value) => value + 1)),
  };
}
