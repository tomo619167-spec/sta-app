import { focusElapsed, type FocusTimer } from "./focus";

export function clampDrawingProgress(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}
/** Presentation only: never modifies or persists timer state. */
export function notebookPage(
  timer: FocusTimer | null | undefined,
  now: number,
) {
  if (!timer)
    return { id: "blank", progress: 0, running: false, setIndex: null };
  const progress = clampDrawingProgress(
    timer.phase === "focus"
      ? focusElapsed(timer, now) / timer.durationMs
      : timer.lastSession
        ? timer.lastSession.actualFocusSeconds /
          timer.lastSession.plannedFocusSeconds
        : 1,
  );
  return {
    id: `${timer.timerId}:page:${timer.setIndex}`,
    progress,
    running:
      timer.phase === "focus" && timer.status === "running" && progress < 1,
    setIndex: timer.mode === "pomodoro" ? timer.setIndex : null,
  };
}
export function notebookPatternIndex(id: string, count: number) {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return count > 0 ? (hash >>> 0) % count : 0;
}
export interface DrawingSpan {
  start: number;
  end: number;
  inkEnd: number;
}
/** Give each stroke time proportional to its physical length, with brief pen lifts. */
export function drawingTimeline(lengths: number[]) {
  let total = 0;
  const spans = lengths.map((length, index) => {
    const start = total;
    const inkEnd = start + Math.max(0.01, length);
    total = inkEnd + (index === lengths.length - 1 ? 0 : 8);
    return { start, inkEnd, end: total };
  });
  return { spans, total };
}
export function sampleDrawing(
  timeline: ReturnType<typeof drawingTimeline>,
  progress: number,
) {
  const distance = timeline.total * clampDrawingProgress(progress);
  let index = timeline.spans.findIndex((span) => distance < span.end);
  if (index < 0) index = Math.max(0, timeline.spans.length - 1);
  const span = timeline.spans[index];
  return {
    index,
    fraction: span
      ? clampDrawingProgress(
          (distance - span.start) / (span.inkEnd - span.start),
        )
      : 0,
    lift:
      span && span.end > span.inkEnd
        ? clampDrawingProgress(
            (distance - span.inkEnd) / (span.end - span.inkEnd),
          )
        : 0,
  };
}
