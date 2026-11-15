import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clampDrawingProgress,
  notebookPage,
  notebookPatternIndex,
  drawingTimeline,
  sampleDrawing,
} from "../lib/focus-notebook";
import {
  defaultFocusSettings,
  initialFocusState,
  noFocusTarget,
  transitionFocus,
  type FocusState,
} from "../lib/focus";
const epoch = Date.parse("2026-11-15T09:00:00Z");
function start(mode: "simple" | "pomodoro" = "simple", minutes = 1) {
  let state = transitionFocus(
    initialFocusState(),
    {
      type: "configure",
      mode,
      settings: {
        ...defaultFocusSettings,
        simpleMinutes: minutes,
        focusMinutes: minutes,
        shortBreakMinutes: 1,
      },
    },
    epoch,
  ).state;
  return transitionFocus(
    state,
    { type: "start", target: noFocusTarget },
    epoch,
    noFocusTarget,
  ).state;
}
function step(
  state: FocusState,
  type: "tick" | "pause" | "resume" | "end" | "save" | "discard" | "next",
  offset: number,
) {
  return transitionFocus(state, { type }, epoch + offset).state;
}
test("drawing patterns are deterministic for the same session, distributed across four variants and safe for arbitrary IDs", () => {
  const indexes = new Set<number>();
  for (let i = 0; i < 40; i++) {
    const id = `cycle-${i}:page:1`;
    const index = notebookPatternIndex(id, 4);
    assert.equal(index, notebookPatternIndex(id, 4));
    assert.ok(index >= 0 && index < 4);
    indexes.add(index);
  }
  assert.equal(indexes.size, 4);
  assert.equal(
    notebookPatternIndex("日本語の学習", 4),
    notebookPatternIndex("日本語の学習", 4),
  );
  assert.equal(notebookPatternIndex("", 0), 0);
});
test("stroke projection weights ink by actual path length, lifts between strokes and clamps endpoints without accumulating frames", () => {
  const timeline = drawingTimeline([100, 50]);
  assert.equal(timeline.total, 158);
  assert.deepEqual(sampleDrawing(timeline, 50 / 158), {
    index: 0,
    fraction: 0.5,
    lift: 0,
  });
  assert.deepEqual(sampleDrawing(timeline, 104 / 158), {
    index: 0,
    fraction: 1,
    lift: 0.5,
  });
  assert.deepEqual(sampleDrawing(timeline, 133 / 158), {
    index: 1,
    fraction: 0.5,
    lift: 0,
  });
  assert.equal(sampleDrawing(timeline, 999).fraction, 1);
  assert.equal(sampleDrawing(timeline, -1).fraction, 0);
  for (const value of [NaN, Infinity, -Infinity])
    assert.equal(clampDrawingProgress(value), 0);
  assert.equal(sampleDrawing(drawingTimeline([]), 0.5).fraction, 0);
});
test("idle pages are blank and all simple durations reconstruct from authoritative elapsed time, including late wakeups", () => {
  assert.deepEqual(notebookPage(undefined, epoch), {
    id: "blank",
    progress: 0,
    running: false,
    setIndex: null,
  });
  for (const minutes of [1, 15, 25, 45, 180]) {
    const state = start("simple", minutes);
    const timer = state.timer!;
    const snapshot = JSON.stringify(timer);
    assert.equal(
      notebookPage(timer, epoch + minutes * 60000 * 0.4).progress,
      0.4,
    );
    assert.equal(notebookPage(timer, epoch + minutes * 60000 * 3).progress, 1);
    assert.equal(
      notebookPage(timer, epoch + minutes * 60000 * 3).running,
      false,
    );
    assert.equal(
      notebookPage(JSON.parse(snapshot), epoch + minutes * 60000 * 0.4).id,
      notebookPage(timer, epoch).id,
    );
    assert.equal(JSON.stringify(timer), snapshot);
  }
});
test("pause, resume, interruption and reload use the saved elapsed time and never replay a page from the start", () => {
  let state = start();
  const id = notebookPage(state.timer, epoch).id;
  state = step(state, "pause", 15000);
  assert.equal(notebookPage(state.timer, epoch + 500000).progress, 0.25);
  assert.equal(notebookPage(state.timer, epoch + 500000).running, false);
  state = step(state, "resume", 100000);
  assert.equal(notebookPage(state.timer, epoch + 115000).progress, 0.5);
  state = step(state, "end", 115000);
  state = step(state, "save", 200000);
  const restored = JSON.parse(JSON.stringify(state.timer));
  assert.equal(notebookPage(restored, epoch + 900000).progress, 0.5);
  assert.equal(notebookPage(restored, epoch).id, id);
  assert.equal(notebookPage(restored, epoch + 900000).running, false);
});
test("each pomodoro focus set has one page; completed pages remain unchanged throughout short and long rests", () => {
  let state = start("pomodoro");
  let now = 0;
  const ids = new Set<string>();
  for (let set = 1; set <= 4; set++) {
    const active = notebookPage(state.timer, epoch + now);
    ids.add(active.id);
    assert.equal(active.setIndex, set);
    assert.equal(active.progress, 0);
    now += 60000;
    state = step(state, "tick", now);
    const complete = notebookPage(state.timer, epoch + now);
    assert.equal(complete.progress, 1);
    state = step(state, "next", now);
    assert.equal(state.timer!.phase, set === 4 ? "longBreak" : "shortBreak");
    for (const offset of [0, 10000, 20000]) {
      const rest = notebookPage(state.timer, epoch + now + offset);
      assert.equal(rest.id, complete.id);
      assert.equal(rest.progress, 1);
      assert.equal(rest.running, false);
    }
    now += state.timer!.durationMs;
    state = step(state, "tick", now);
    state = step(state, "next", now);
  }
  assert.equal(ids.size, 4);
});
test("discarding an interrupted set retains its partial picture instead of displaying a previous completed set", () => {
  let state = start("pomodoro");
  state = step(state, "tick", 60000);
  state = step(state, "next", 60000);
  state = step(state, "tick", 120000);
  state = step(state, "next", 120000);
  const id = notebookPage(state.timer, epoch + 120000).id;
  state = step(state, "end", 135000);
  state = step(state, "discard", 135000);
  const page = notebookPage(state.timer, epoch + 900000);
  assert.equal(page.id, id);
  assert.equal(page.progress, 0.25);
  assert.equal(page.running, false);
});
