"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { studyRepository } from "@/lib/storage";
import type { StudyRecord, Theme } from "@/lib/model";
interface StudyState {
  themes: Theme[];
  records: StudyRecord[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}
const Context = createContext<StudyState | null>(null);
export function StudyProvider({ children }: { children: ReactNode }) {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [records, setRecords] = useState<StudyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    try {
      const [themes, records] = await Promise.all([
        studyRepository.listThemes(),
        studyRepository.listRecords(),
      ]);
      if (request !== generation.current) return;
      setThemes(themes);
      setRecords(records);
      setError(null);
    } catch {
      if (request === generation.current)
        setError(
          "端末のデータを読み込めませんでした。ブラウザでサイトのデータ保存を許可して、再試行してください。",
        );
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const onFocus = () => {
      void refresh();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      generation.current++;
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);
  return (
    <Context.Provider value={{ themes, records, loading, error, refresh }}>
      {children}
    </Context.Provider>
  );
}
export function useStudy() {
  const value = useContext(Context);
  if (!value) throw new Error("StudyProvider is required");
  return value;
}
