import type { Subject, Theme, StudyItem } from "./model";

export type FocusMode = "simple" | "pomodoro";
export type FocusTargetType = "none" | "subject" | "theme" | "item";
export interface FocusTarget {
  type: FocusTargetType;
  id: string | null;
  name: string;
  subjectId?: string;
  subjectName?: string;
  themeId?: string;
  themeName?: string;
}
export interface FocusSettings {
  simpleMinutes: number;
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  setsUntilLongBreak: number;
  sound: boolean;
}
export const defaultFocusSettings: FocusSettings = {
  simpleMinutes: 25,
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  setsUntilLongBreak: 4,
  sound: false,
};
export const noFocusTarget: FocusTarget = {
  type: "none",
  id: null,
  name: "指定しない",
};
export interface FocusSession {
  id: string;
  mode: FocusMode;
  targetType: FocusTargetType;
  targetId: string | null;
  target: FocusTarget;
  startedAt: string;
  endedAt: string;
  plannedFocusSeconds: number;
  actualFocusSeconds: number;
  status: "completed" | "interrupted";
  pomodoroCycleId?: string;
  pomodoroSetIndex?: number;
  createdAt: string;
  updatedAt: string;
}
export interface FocusTimer {
  timerId: string;
  sessionId: string;
  mode: FocusMode;
  phase: "focus" | "shortBreak" | "longBreak";
  status: "running" | "paused" | "review" | "completed" | "finished";
  target: FocusTarget;
  settings: FocusSettings;
  setIndex: number;
  durationMs: number;
  elapsedMs: number;
  lastStartedAt: number | null;
  phaseStartedAt: number;
  phaseEndedAt?: number;
  lastSession?: FocusSession;
}
export interface FocusState {
  id: "timer";
  revision: number;
  mode: FocusMode;
  settings: FocusSettings;
  timer: FocusTimer | null;
}
export type FocusCommand =
  | { type: "configure"; mode: FocusMode; settings: FocusSettings }
  | { type: "start"; target: Pick<FocusTarget, "type" | "id"> }
  | {
      type:
        | "tick"
        | "pause"
        | "resume"
        | "end"
        | "save"
        | "discard"
        | "next"
        | "dismiss";
    };
export const initialFocusState = (): FocusState => ({
  id: "timer",
  revision: 0,
  mode: "simple",
  settings: { ...defaultFocusSettings },
  timer: null,
});
export function validateFocusSettings(settings: FocusSettings): FocusSettings {
  for (const key of [
    "simpleMinutes",
    "focusMinutes",
    "shortBreakMinutes",
    "longBreakMinutes",
    "setsUntilLongBreak",
  ] as const) {
    const max = key === "setsUntilLongBreak" ? 12 : 180;
    if (
      !Number.isInteger(settings[key]) ||
      settings[key] < 1 ||
      settings[key] > max
    )
      throw new Error(
        `${key === "setsUntilLongBreak" ? "セット数は1〜12" : "時間は1〜180"}の整数で設定してください。`,
      );
  }
  if (typeof settings.sound !== "boolean")
    throw new Error("通知音の設定を確認してください。");
  return { ...settings };
}
export function resolveFocusTarget(
  selected: Pick<FocusTarget, "type" | "id">,
  subjects: Subject[],
  themes: Theme[],
  items: StudyItem[],
): FocusTarget {
  if (selected.type === "none" && selected.id === null)
    return { ...noFocusTarget };
  const item =
    selected.type === "item"
      ? items.find((x) => x.id === selected.id)
      : undefined;
  const theme =
    selected.type === "theme"
      ? themes.find((x) => x.id === selected.id)
      : item
        ? themes.find((x) => x.id === item.themeId)
        : undefined;
  const subject = subjects.find(
    (x) =>
      x.id === (selected.type === "subject" ? selected.id : theme?.subjectId),
  );
  if (
    !subject ||
    (selected.type === "item" && !item) ||
    (["theme", "item"].includes(selected.type) && !theme) ||
    !["subject", "theme", "item"].includes(selected.type)
  )
    throw new Error("学習対象が見つかりません。選び直してください。");
  return {
    type: selected.type,
    id: selected.id,
    name: item?.title ?? theme?.name ?? subject.name,
    subjectId: subject.id,
    subjectName: subject.name,
    ...(theme ? { themeId: theme.id, themeName: theme.name } : {}),
  };
}
/** Intervals only repaint: elapsed time always derives from persisted timestamps. */
export function focusElapsed(timer: FocusTimer, now: number): number {
  return Math.min(
    timer.durationMs,
    timer.elapsedMs +
      (timer.status === "running" && timer.lastStartedAt !== null
        ? Math.max(0, now - timer.lastStartedAt)
        : 0),
  );
}
export function focusRemaining(timer: FocusTimer, now: number) {
  return Math.max(
    0,
    Math.ceil((timer.durationMs - focusElapsed(timer, now)) / 1000),
  );
}
export function timerDisplay(seconds: number) {
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
}
export function focusDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}分${rest ? `${rest}秒` : ""}`;
}
function sessionFor(
  timer: FocusTimer,
  status: FocusSession["status"],
  now: number,
): FocusSession {
  const ended = new Date(timer.phaseEndedAt ?? now).toISOString();
  return {
    id: timer.sessionId,
    mode: timer.mode,
    targetType: timer.target.type,
    targetId: timer.target.id,
    target: timer.target,
    startedAt: new Date(timer.phaseStartedAt).toISOString(),
    endedAt: ended,
    plannedFocusSeconds: timer.durationMs / 1000,
    actualFocusSeconds: Math.floor(timer.elapsedMs / 1000),
    status,
    ...(timer.mode === "pomodoro"
      ? { pomodoroCycleId: timer.timerId, pomodoroSetIndex: timer.setIndex }
      : {}),
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
  };
}
/** Pure state machine. Repository commits its new state and optional record atomically. */
export function transitionFocus(
  state: FocusState,
  command: FocusCommand,
  now: number,
  target?: FocusTarget,
): { state: FocusState; session?: FocusSession } {
  if (!Number.isFinite(now)) throw new Error("時刻を確認してください。");
  let timer = state.timer;
  let session: FocusSession | undefined;
  if (
    timer?.status === "running" &&
    focusElapsed(timer, now) >= timer.durationMs
  ) {
    timer = {
      ...timer,
      elapsedMs: timer.durationMs,
      phaseEndedAt: timer.lastStartedAt! + timer.durationMs - timer.elapsedMs,
      lastStartedAt: null,
      status: "completed",
    };
    if (timer.phase === "focus") {
      session = sessionFor(timer, "completed", now);
      timer.lastSession = session;
    }
    state = { ...state, timer };
    // An end/pause racing the deadline still commits a completed set, never an interruption.
    if (["end", "pause", "resume"].includes(command.type))
      return { state, session };
  }
  if (command.type === "configure") {
    if (timer && timer.status !== "finished")
      throw new Error("計測を終了してから設定を変更してください。");
    if (!["simple", "pomodoro"].includes(command.mode))
      throw new Error("モードを確認してください。");
    return {
      state: {
        ...state,
        mode: command.mode,
        settings: validateFocusSettings(command.settings),
      },
      session,
    };
  }
  if (command.type === "start") {
    if (timer && timer.status !== "finished") return { state, session };
    if (!target) throw new Error("学習対象を確認してください。");
    const settings = validateFocusSettings(state.settings);
    return {
      state: {
        ...state,
        timer: {
          timerId: crypto.randomUUID(),
          sessionId: crypto.randomUUID(),
          mode: state.mode,
          phase: "focus",
          status: "running",
          target,
          settings,
          setIndex: 1,
          durationMs:
            (state.mode === "simple"
              ? settings.simpleMinutes
              : settings.focusMinutes) * 60000,
          elapsedMs: 0,
          lastStartedAt: now,
          phaseStartedAt: now,
        },
      },
      session,
    };
  }
  if (!timer) return { state, session };
  if (command.type === "pause" && timer.status === "running")
    timer = {
      ...timer,
      elapsedMs: focusElapsed(timer, now),
      lastStartedAt: null,
      status: "paused",
    };
  else if (command.type === "resume" && timer.status === "paused")
    timer = { ...timer, lastStartedAt: now, status: "running" };
  else if (
    command.type === "end" &&
    ["running", "paused"].includes(timer.status)
  )
    timer = {
      ...timer,
      elapsedMs: focusElapsed(timer, now),
      lastStartedAt: null,
      phaseEndedAt: now,
      status: timer.phase === "focus" ? "review" : "finished",
    };
  else if (command.type === "end" && timer.status === "completed")
    timer = { ...timer, status: "finished" };
  else if (
    (command.type === "save" || command.type === "discard") &&
    timer.status === "review"
  ) {
    if (command.type === "save") {
      session = sessionFor(timer, "interrupted", now);
      timer = { ...timer, lastSession: session };
    }
    timer = { ...timer, status: "finished" };
  } else if (
    command.type === "next" &&
    timer.status === "completed" &&
    timer.mode === "pomodoro"
  ) {
    const phase =
      timer.phase === "focus"
        ? timer.setIndex % timer.settings.setsUntilLongBreak === 0
          ? "longBreak"
          : "shortBreak"
        : "focus";
    const minutes =
      phase === "focus"
        ? timer.settings.focusMinutes
        : phase === "shortBreak"
          ? timer.settings.shortBreakMinutes
          : timer.settings.longBreakMinutes;
    timer = {
      ...timer,
      sessionId: crypto.randomUUID(),
      phase,
      status: "running",
      durationMs: minutes * 60000,
      elapsedMs: 0,
      phaseStartedAt: now,
      phaseEndedAt: undefined,
      lastStartedAt: now,
      setIndex: timer.setIndex + (phase === "focus" ? 1 : 0),
    };
  } else if (
    command.type === "dismiss" &&
    (timer.status === "finished" ||
      (timer.mode === "simple" && timer.status === "completed"))
  )
    return { state: { ...state, timer: null }, session };
  return {
    state: timer === state.timer ? state : { ...state, timer },
    session,
  };
}
/** Snapshots retain attribution even when the source hierarchy is renamed or deleted. */
export function focusTotals(sessions: FocusSession[], now = new Date()) {
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const tomorrow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  ).getTime();
  const result = {
    today: 0,
    total: 0,
    subjects: {} as Record<string, number>,
    themes: {} as Record<string, number>,
    items: {} as Record<string, number>,
  };
  const seen = new Set<string>();
  for (const session of sessions) {
    if (seen.has(session.id)) continue;
    seen.add(session.id);
    const seconds = session.actualFocusSeconds;
    result.total += seconds;
    const ended = Date.parse(session.endedAt);
    if (ended >= today && ended < tomorrow) result.today += seconds;
    for (const [bucket, id] of [
      [result.subjects, session.target.subjectId],
      [result.themes, session.target.themeId],
      [result.items, session.targetType === "item" ? session.targetId : null],
    ] as const)
      if (id) bucket[id] = (bucket[id] ?? 0) + seconds;
  }
  return result;
}
