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
import {
  focusRemaining,
  type FocusCommand,
  type FocusState,
} from "@/lib/focus";
import { useStudy } from "./provider";

interface FocusContextValue {
  state: FocusState | null;
  now: number;
  busy: boolean;
  error: string;
  run: (command: FocusCommand) => Promise<boolean>;
  prepareSound: () => void;
}
const Context = createContext<FocusContextValue | null>(null);
export function FocusProvider({ children }: { children: ReactNode }) {
  const { refresh } = useStudy();
  const [state, setState] = useState<FocusState | null>(null);
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const current = useRef<FocusState | null>(null);
  const lock = useRef(false);
  const channel = useRef<BroadcastChannel | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const prepareSound = useCallback(() => {
    try {
      audio.current ??= new AudioContext();
      void audio.current.resume().catch(() => {});
    } catch {
      /* Sound is optional; the visible completion state remains available. */
    }
  }, []);
  const accept = useCallback((next: FocusState) => {
    if (current.current && next.revision < current.current.revision) return;
    current.current = next;
    setState(next);
    setNow(Date.now());
  }, []);
  const run = useCallback(
    async (command: FocusCommand) => {
      if (lock.current) return false;
      lock.current = true;
      setBusy(true);
      try {
        const before = current.current?.timer;
        const next = await studyRepository.updateFocus(command);
        accept(next);
        setError("");
        channel.current?.postMessage("changed");
        await refresh();
        if (
          before?.status === "running" &&
          next.timer?.status === "completed" &&
          next.timer.settings.sound &&
          document.visibilityState === "visible"
        ) {
          try {
            const context = audio.current;
            if (context?.state === "running") {
              const oscillator = context.createOscillator();
              const gain = context.createGain();
              oscillator.connect(gain);
              gain.connect(context.destination);
              oscillator.frequency.value = 660;
              gain.gain.setValueAtTime(0.08, context.currentTime);
              gain.gain.exponentialRampToValueAtTime(
                0.001,
                context.currentTime + 0.4,
              );
              oscillator.start();
              oscillator.stop(context.currentTime + 0.4);
            }
          } catch {
            /* Browsers can suspend audio; never interrupt recording. */
          }
        }
        return true;
      } catch {
        setError(
          "タイマーを保存できませんでした。状態を保持しています。再試行してください。",
        );
        return false;
      } finally {
        lock.current = false;
        setBusy(false);
      }
    },
    [accept, refresh],
  );
  useEffect(() => {
    let alive = true;
    async function read() {
      try {
        const saved = await studyRepository.getFocusState();
        if (alive) {
          accept(saved);
          setError("");
        }
      } catch {
        if (alive)
          setError("タイマーを読み込めませんでした。再試行してください。");
      }
    }
    void read();
    if (typeof BroadcastChannel !== "undefined") {
      channel.current = new BroadcastChannel("trace-focus");
      channel.current.onmessage = () => {
        void read();
        void refresh();
      };
    }
    const foreground = () => {
      if (!document.hidden) void read();
    };
    window.addEventListener("focus", foreground);
    document.addEventListener("visibilitychange", foreground);
    const interval = window.setInterval(() => {
      setNow(Date.now());
      const timer = current.current?.timer;
      if (
        timer?.status === "running" &&
        focusRemaining(timer, Date.now()) === 0
      )
        void run({ type: "tick" });
    }, 500);
    return () => {
      alive = false;
      clearInterval(interval);
      channel.current?.close();
      channel.current = null;
      window.removeEventListener("focus", foreground);
      document.removeEventListener("visibilitychange", foreground);
    };
  }, [accept, refresh, run]);
  return (
    <Context.Provider value={{ state, now, busy, error, run, prepareSound }}>
      {children}
    </Context.Provider>
  );
}
export function useFocusTimer() {
  const value = useContext(Context);
  if (!value) throw new Error("FocusProvider is required");
  return value;
}
