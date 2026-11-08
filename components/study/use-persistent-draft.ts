"use client";
import { useEffect, useRef, useState } from "react";
export function usePersistentDraft<T extends object>(
  scope: string,
  options: {
    load: () => Promise<T | undefined>;
    save: (value: T) => Promise<void>;
    initial: () => T;
  },
) {
  const latest = useRef(options);
  latest.current = options;
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const current = useRef<T | undefined>(undefined);
  const pending = useRef<Promise<void>>(Promise.resolve());
  const alive = useRef(false);
  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    setLoading(true);
    void latest.current
      .load()
      .then(
        (value) => {
          if (!cancelled) {
            current.current = value ?? latest.current.initial();
            setData(current.current);
            setError("");
          }
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
      alive.current = false;
    };
  }, [scope, attempt]);
  function update(patch: Partial<T>) {
    if (!current.current) return;
    const next = { ...current.current, ...patch };
    current.current = next;
    setData(next);
    setSaving(true);
    setError("");
    const save = latest.current.save;
    const operation = pending.current.catch(() => {}).then(() => save(next));
    pending.current = operation;
    void operation.then(
      () => {
        if (alive.current && pending.current === operation) {
          setSaving(false);
          setError("");
        }
      },
      () => {
        if (alive.current && pending.current === operation) {
          setSaving(false);
          setError(
            "下書きを保存できませんでした。入力を残しています。再試行してください。",
          );
        }
      },
    );
  }
  function clear() {
    const value = latest.current.initial();
    current.current = value;
    setData(value);
    setError("");
    setSaving(false);
  }
  return {
    data,
    loading,
    error,
    saving,
    update,
    clear,
    flush: () => pending.current,
    retry: () => (data ? update({}) : setAttempt((value) => value + 1)),
  };
}
