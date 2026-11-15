"use client";
import { useLayoutEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type { FocusTimer } from "@/lib/focus";
import { notebookPage, notebookPatternIndex } from "@/lib/focus-notebook";
import { DrawingPattern, drawingPatterns } from "./drawing-pattern";
import { PencilIllustration } from "./pencil-illustration";
import { createDrawingProgress } from "./drawing-progress";

const motionQuery = "(prefers-reduced-motion: reduce)";
function reducedMotionSnapshot() {
  return typeof window.matchMedia === "function"
    ? window.matchMedia(motionQuery).matches
    : true;
}
function subscribeMotion(changed: () => void) {
  if (typeof window.matchMedia !== "function") return () => {};
  const media = window.matchMedia(motionQuery);
  media.addEventListener("change", changed);
  return () => media.removeEventListener("change", changed);
}

export function FocusNotebookAnimation({
  timer,
  now,
}: {
  timer?: FocusTimer | null;
  now: number;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const reducedMotion = useSyncExternalStore(
    subscribeMotion,
    reducedMotionSnapshot,
    () => false,
  );
  const page = notebookPage(timer, now);
  const pattern = useMemo(
    () => notebookPatternIndex(page.id, drawingPatterns.length),
    [page.id],
  );
  const render = useRef<ReturnType<typeof createDrawingProgress> | null>(null);
  const latest = useRef({ timer, now });
  latest.current = { timer, now };
  useLayoutEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    try {
      render.current = createDrawingProgress(svg);
    } catch {
      render.current = null;
      return;
    }
    let frame = 0;
    let previousFrame = -Infinity;
    let inView = true;
    let stopped = false;
    function paint(time?: number) {
      const current = latest.current;
      const currentPage = notebookPage(current.timer, time ?? current.now);
      render.current?.(currentPage.progress, reducedMotion);
    }
    function animate(timestamp: number) {
      frame = 0;
      if (stopped || document.hidden || !inView || reducedMotion) return;
      if (timestamp - previousFrame >= 1000 / 30) {
        paint(Date.now());
        previousFrame = timestamp;
      }
      if (notebookPage(latest.current.timer, Date.now()).running)
        frame = requestAnimationFrame(animate);
    }
    function sync() {
      cancelAnimationFrame(frame);
      frame = 0;
      if (document.hidden || !inView) return;
      paint(Date.now());
      if (
        !reducedMotion &&
        notebookPage(latest.current.timer, Date.now()).running
      )
        frame = requestAnimationFrame(animate);
    }
    paint();
    sync();
    const observer =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver((entries) => {
            inView = entries[0]?.isIntersecting ?? true;
            sync();
          })
        : null;
    observer?.observe(svg);
    document.addEventListener("visibilitychange", sync);
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      document.removeEventListener("visibilitychange", sync);
      render.current = null;
    };
  }, [page.id, pattern, timer, reducedMotion]);
  useLayoutEffect(() => {
    if (document.hidden) return;
    // Static snapshots still advance in reduced-motion mode, without moving the pen.
    if (reducedMotion || !page.running)
      render.current?.(page.progress, reducedMotion);
  }, [now, page.progress, page.running, reducedMotion]);
  return (
    <div className="focus-notebook" aria-hidden="true">
      <svg
        ref={ref}
        viewBox="0 -12 360 188"
        focusable="false"
        data-page-id={page.id}
        data-pattern={drawingPatterns[pattern].name}
      >
        <path
          className="notebook-paper"
          d="M17 12 Q180 9 343 12 L342 164 Q180 167 18 164 Z"
        />
        <g className="notebook-rules" fill="none">
          <path d="M32 74 Q180 73 328 75 M32 99 Q180 97 328 99 M32 125 Q180 124 328 126" />
        </g>
        <DrawingPattern key={page.id} index={pattern} />
        <g data-notebook-check className="notebook-check" visibility="hidden">
          <path d="M289 144 l5 5 10 -12" />
        </g>
        <PencilIllustration />
        <text className="notebook-page-number" x="35" y="151">
          {page.setIndex === null
            ? "TRACE"
            : `SET ${String(page.setIndex).padStart(2, "0")}`}
        </text>
      </svg>
    </div>
  );
}
