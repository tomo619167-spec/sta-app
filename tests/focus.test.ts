import "fake-indexeddb/auto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { openDB, deleteDB } from "idb";
import { IndexedDBStudyRepository } from "../lib/storage/indexed-db";
import {
  defaultFocusSettings,
  initialFocusState,
  transitionFocus,
  focusElapsed,
  focusRemaining,
  focusTotals,
  timerDisplay,
  validateFocusSettings,
  resolveFocusTarget,
  noFocusTarget,
  type FocusSettings,
  type FocusTarget,
} from "../lib/focus";
import { initialLearningDraft } from "../lib/learning";
import { feedbackExample } from "../lib/learning-feedback";
const epoch = Date.parse("2026-11-14T09:00:00Z");
async function setup() {
  const name = crypto.randomUUID();
  const repo = new IndexedDBStudyRepository(name);
  const subject = await repo.createSubject("世界史");
  const theme = await repo.createTheme({
    name: "フランス革命",
    subjectId: subject.id,
    description: "説明する",
  });
  const item = await repo.createItem(theme.id, "原因", "原因を説明する");
  return { name, repo, subject, theme, item };
}
async function configure(
  repo: IndexedDBStudyRepository,
  mode: "simple" | "pomodoro" = "simple",
  overrides: Partial<FocusSettings> = {},
) {
  return repo.updateFocus(
    {
      type: "configure",
      mode,
      settings: {
        ...defaultFocusSettings,
        simpleMinutes: 1,
        focusMinutes: 1,
        shortBreakMinutes: 1,
        longBreakMinutes: 2,
        ...overrides,
      },
    },
    epoch,
  );
}
test("focus settings validate whole minutes, bounds, sets and optional sound; clock displays long sessions", () => {
  assert.deepEqual(
    validateFocusSettings(defaultFocusSettings),
    defaultFocusSettings,
  );
  for (const key of [
    "simpleMinutes",
    "focusMinutes",
    "shortBreakMinutes",
    "longBreakMinutes",
    "setsUntilLongBreak",
  ] as const) {
    for (const value of [
      0,
      -1,
      NaN,
      Infinity,
      1.5,
      key === "setsUntilLongBreak" ? 13 : 181,
    ])
      assert.throws(() =>
        validateFocusSettings({ ...defaultFocusSettings, [key]: value }),
      );
  }
  assert.equal(timerDisplay(180 * 60), "180:00");
  assert.equal(timerDisplay(59), "00:59");
});
test("elapsed time derives from the deadline rather than tick count and caps late wakeups at the planned duration", () => {
  const started = transitionFocus(
    initialFocusState(),
    { type: "start", target: noFocusTarget },
    epoch,
    noFocusTarget,
  ).state;
  assert.equal(focusRemaining(started.timer!, epoch + 12345), 1488);
  const complete = transitionFocus(
    started,
    { type: "tick" },
    epoch + 2 * 60 * 60 * 1000,
  );
  assert.equal(complete.session!.actualFocusSeconds, 1500);
  assert.equal(
    complete.session!.endedAt,
    new Date(epoch + 1500000).toISOString(),
  );
  assert.equal(focusElapsed(started.timer!, epoch - 1000), 0);
  assert.equal(
    transitionFocus(complete.state, { type: "tick" }, epoch + 99999999).session,
    undefined,
  );
});
test("pause, close, reopen and resume preserve subsecond time; pauses never count toward the saved actual time", async () => {
  const { repo } = await setup();
  await configure(repo);
  await repo.updateFocus({ type: "start", target: noFocusTarget }, epoch);
  await repo.updateFocus({ type: "pause" }, epoch + 10500);
  await repo.close();
  const restored = await repo.getFocusState();
  assert.equal(focusRemaining(restored.timer!, epoch + 500000), 50);
  await repo.updateFocus({ type: "resume" }, epoch + 100000);
  await repo.updateFocus({ type: "end" }, epoch + 111300);
  const review = await repo.getFocusState();
  assert.equal(review.timer!.status, "review");
  assert.equal(focusElapsed(review.timer!, epoch + 9999999), 21800);
  assert.equal((await repo.listFocusSessions()).length, 0);
  await repo.updateFocus({ type: "save" }, epoch + 200000);
  const [record] = await repo.listFocusSessions();
  assert.equal(record.actualFocusSeconds, 21);
  assert.equal(record.plannedFocusSeconds, 60);
  assert.equal(record.status, "interrupted");
  assert.equal(record.endedAt, new Date(epoch + 111300).toISOString());
  await repo.close();
});
test("all target levels resolve using the existing hierarchy; invalid or deleted targets cannot start", async () => {
  const { repo, subject, theme, item } = await setup();
  for (const target of [
    noFocusTarget,
    { type: "subject", id: subject.id },
    { type: "theme", id: theme.id },
    { type: "item", id: item.id },
  ] as const) {
    const resolved = resolveFocusTarget(target, [subject], [theme], [item]);
    assert.equal(resolved.id, target.id);
    if (target.type !== "none") assert.equal(resolved.subjectId, subject.id);
    if (["theme", "item"].includes(target.type))
      assert.equal(resolved.themeId, theme.id);
  }
  await assert.rejects(
    repo.updateFocus({
      type: "start",
      target: { type: "item", id: "missing" },
    }),
    /学習対象/,
  );
  assert.equal((await repo.getFocusState()).timer, null);
  await repo.close();
});
test("running state and settings survive reopening, forbid changes during a cycle, and completion saves without dismissal", async () => {
  const { repo } = await setup();
  await configure(repo, "simple", { simpleMinutes: 180, sound: true });
  await repo.close();
  assert.equal((await repo.getFocusState()).settings.simpleMinutes, 180);
  await repo.updateFocus({ type: "start", target: noFocusTarget }, epoch);
  await assert.rejects(configure(repo, "pomodoro"), /終了/);
  await repo.close();
  const active = await repo.getFocusState();
  assert.equal(focusRemaining(active.timer!, epoch + 30000), 10770);
  await repo.updateFocus({ type: "tick" }, epoch + 10800000 + 999999);
  await repo.close();
  assert.equal((await repo.getFocusState()).timer!.status, "completed");
  assert.equal((await repo.listFocusSessions())[0].actualFocusSeconds, 10800);
  await repo.close();
});
test("two repository instances serialize completion, end, save and next commands without duplicate records or sets", async () => {
  const { repo, name } = await setup();
  const other = new IndexedDBStudyRepository(name);
  await configure(repo, "pomodoro");
  await repo.updateFocus({ type: "start", target: noFocusTarget }, epoch);
  await Promise.all([
    repo.updateFocus({ type: "tick" }, epoch + 60000),
    other.updateFocus({ type: "end" }, epoch + 60000),
    repo.updateFocus({ type: "save" }, epoch + 60000),
  ]);
  assert.equal((await repo.listFocusSessions()).length, 1);
  const state = await repo.getFocusState();
  // If end ran after completion it finishes the cycle; neither path writes again.
  assert.ok(["completed", "finished"].includes(state.timer!.status));
  if (state.timer!.status === "finished")
    await repo.updateFocus({ type: "dismiss" }, epoch + 60000);
  else await repo.updateFocus({ type: "end" }, epoch + 60000);
  await repo.updateFocus(
    { type: "start", target: noFocusTarget },
    epoch + 100000,
  );
  await repo.updateFocus({ type: "tick" }, epoch + 160000);
  await Promise.all([
    repo.updateFocus({ type: "next" }, epoch + 160000),
    other.updateFocus({ type: "next" }, epoch + 160000),
  ]);
  const next = await repo.getFocusState();
  assert.equal(next.timer!.phase, "shortBreak");
  assert.equal(next.timer!.setIndex, 1);
  assert.equal((await repo.listFocusSessions()).length, 2);
  await other.close();
  await repo.close();
});
test("pomodoro explicitly starts breaks, uses a long break after four sets, and never records break time", async () => {
  const { repo } = await setup();
  await configure(repo, "pomodoro");
  await repo.updateFocus({ type: "start", target: noFocusTarget }, epoch);
  let now = epoch;
  for (let index = 1; index <= 4; index++) {
    now += 60000;
    const complete = await repo.updateFocus({ type: "tick" }, now);
    assert.equal(complete.timer!.phase, "focus");
    assert.equal(complete.timer!.status, "completed");
    assert.equal((await repo.listFocusSessions()).length, index);
    // Waiting several minutes must not silently start a break or count more focus.
    now += 600000;
    await repo.updateFocus({ type: "tick" }, now);
    const resting = await repo.updateFocus({ type: "next" }, now);
    assert.equal(
      resting.timer!.phase,
      index === 4 ? "longBreak" : "shortBreak",
    );
    now += index === 4 ? 120000 : 60000;
    const breakDone = await repo.updateFocus({ type: "tick" }, now);
    assert.equal(breakDone.timer!.status, "completed");
    assert.equal((await repo.listFocusSessions()).length, index);
    if (index < 4) await repo.updateFocus({ type: "next" }, now);
  }
  const sessions = await repo.listFocusSessions();
  assert.equal(new Set(sessions.map((x) => x.pomodoroCycleId)).size, 1);
  assert.deepEqual(
    sessions.map((x) => x.pomodoroSetIndex).sort(),
    [1, 2, 3, 4],
  );
  assert.equal(focusTotals(sessions, new Date(now)).total, 240);
  await repo.close();
});
test("custom pomodoro settings, decreased intervals, pause during breaks and interruption retain completed sets", async () => {
  const { repo } = await setup();
  await configure(repo, "pomodoro", {
    focusMinutes: 2,
    shortBreakMinutes: 3,
    longBreakMinutes: 4,
    setsUntilLongBreak: 1,
  });
  await repo.updateFocus({ type: "start", target: noFocusTarget }, epoch);
  await repo.updateFocus({ type: "tick" }, epoch + 120000);
  const resting = await repo.updateFocus({ type: "next" }, epoch + 120000);
  assert.equal(resting.timer!.durationMs, 240000);
  await repo.updateFocus({ type: "pause" }, epoch + 150000);
  await repo.updateFocus({ type: "resume" }, epoch + 250000);
  await repo.updateFocus({ type: "tick" }, epoch + 460000);
  await repo.updateFocus({ type: "next" }, epoch + 460000);
  await repo.updateFocus({ type: "end" }, epoch + 477800);
  await repo.close();
  assert.equal((await repo.getFocusState()).timer!.status, "review");
  await repo.updateFocus({ type: "save" }, epoch + 500000);
  const sessions = await repo.listFocusSessions();
  assert.equal(sessions.length, 2);
  assert.equal(
    sessions.reduce((n, x) => n + x.actualFocusSeconds, 0),
    137,
  );
  assert.equal(
    sessions.find((x) => x.status === "interrupted")!.pomodoroSetIndex,
    2,
  );
  await repo.close();
});
test("discarding the current partial set never deletes completed pomodoro sets; ending a break records no focus", async () => {
  const { repo } = await setup();
  await configure(repo, "pomodoro");
  await repo.updateFocus({ type: "start", target: noFocusTarget }, epoch);
  await repo.updateFocus({ type: "tick" }, epoch + 60000);
  await repo.updateFocus({ type: "next" }, epoch + 60000);
  await repo.updateFocus({ type: "tick" }, epoch + 120000);
  await repo.updateFocus({ type: "next" }, epoch + 120000);
  await repo.updateFocus({ type: "end" }, epoch + 130000);
  await repo.updateFocus({ type: "discard" }, epoch + 130000);
  assert.equal((await repo.listFocusSessions()).length, 1);
  await repo.updateFocus({ type: "dismiss" }, epoch + 130000);
  await repo.updateFocus(
    { type: "start", target: noFocusTarget },
    epoch + 200000,
  );
  await repo.updateFocus({ type: "tick" }, epoch + 260000);
  await repo.updateFocus({ type: "next" }, epoch + 260000);
  await repo.updateFocus({ type: "end" }, epoch + 270000);
  assert.equal((await repo.getFocusState()).timer!.status, "finished");
  assert.equal((await repo.listFocusSessions()).length, 2);
  await repo.close();
});
test("a failed state write atomically rolls back completion; retry produces exactly one record", async () => {
  const { repo } = await setup();
  await configure(repo);
  await repo.updateFocus({ type: "start", target: noFocusTarget }, epoch);
  const before = await repo.getFocusState();
  const put = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function (
    ...args: Parameters<IDBObjectStore["put"]>
  ) {
    if (this.name === "focus-state")
      throw new DOMException("Quota", "QuotaExceededError");
    return put.apply(this, args);
  };
  try {
    await assert.rejects(repo.updateFocus({ type: "tick" }, epoch + 60000));
  } finally {
    IDBObjectStore.prototype.put = put;
  }
  assert.deepEqual(await repo.getFocusState(), before);
  assert.equal((await repo.listFocusSessions()).length, 0);
  await repo.updateFocus({ type: "tick" }, epoch + 100000);
  assert.equal((await repo.listFocusSessions()).length, 1);
  await repo.close();
});
test("target snapshots survive theme/item deletion; deleted sessions update totals and never resurrect", async () => {
  const { repo, subject, theme, item } = await setup();
  await configure(repo);
  await repo.updateFocus(
    { type: "start", target: { type: "item", id: item.id } },
    epoch,
  );
  await repo.deleteTheme(theme.id);
  await repo.updateFocus({ type: "tick" }, epoch + 60000);
  const [session] = await repo.listFocusSessions();
  assert.equal(session.target.name, item.title);
  const totals = focusTotals([session, session], new Date(epoch));
  assert.equal(totals.total, 60);
  assert.equal(totals.today, 60);
  assert.equal(totals.subjects[subject.id], 60);
  assert.equal(totals.themes[theme.id], 60);
  assert.equal(totals.items[item.id], 60);
  await repo.deleteFocusSession(session.id);
  await repo.updateFocus({ type: "tick" }, epoch + 100000);
  await repo.close();
  await repo.updateFocus({ type: "tick" }, epoch + 200000);
  assert.equal(focusTotals(await repo.listFocusSessions()).total, 0);
  await repo.close();
});
test("hierarchical aggregation counts none, subject, theme and item exactly once per session and uses local calendar dates", async () => {
  const { repo, subject, theme, item } = await setup();
  await configure(repo);
  for (const target of [
    noFocusTarget,
    { type: "subject", id: subject.id },
    { type: "theme", id: theme.id },
    { type: "item", id: item.id },
  ] as const) {
    await repo.updateFocus({ type: "start", target }, epoch);
    await repo.updateFocus({ type: "tick" }, epoch + 60000);
    await repo.updateFocus({ type: "dismiss" }, epoch + 60000);
  }
  const sessions = await repo.listFocusSessions();
  const totals = focusTotals(sessions, new Date(epoch));
  assert.equal(totals.total, 240);
  assert.equal(totals.today, 240);
  assert.equal(totals.subjects[subject.id], 180);
  assert.equal(totals.themes[theme.id], 120);
  assert.equal(totals.items[item.id], 60);
  assert.equal(focusTotals(sessions, new Date(epoch + 86400000)).today, 0);
  await repo.close();
});
async function seedV6() {
  const { repo, name, theme, item } = await setup();
  const target = { type: "item" as const, id: item.id };
  await repo.setMastery(theme.id, target, 3);
  const record = await repo.saveLearningRecord({
    ...initialLearningDraft(theme.id, target, "output"),
    note: "元の説明",
    outputRating: 2,
  });
  await repo.importFeedback(record.id, JSON.stringify(feedbackExample(record)));
  await repo.saveLearningDraft({
    ...initialLearningDraft(theme.id, target, "deepen"),
    question: "途中の問い",
  });
  await repo.close();
  const source = await openDB(name);
  const schemas: {
    name: string;
    keyPath: string | string[] | null;
    autoIncrement: boolean;
    indexes: {
      name: string;
      keyPath: string | string[];
      unique: boolean;
      multiEntry: boolean;
    }[];
    rows: unknown[];
    keys: IDBValidKey[];
  }[] = [];
  for (const store of Array.from(source.objectStoreNames).filter(
    (x) => !x.startsWith("focus-"),
  )) {
    const tx = source.transaction(store);
    const object = tx.objectStore(store);
    schemas.push({
      name: store,
      keyPath: object.keyPath,
      autoIncrement: object.autoIncrement,
      indexes: Array.from(object.indexNames).map((name) => {
        const index = object.index(name);
        return {
          name,
          keyPath: index.keyPath,
          unique: index.unique,
          multiEntry: index.multiEntry,
        };
      }),
      rows: await object.getAll(),
      keys: await object.getAllKeys(),
    });
  }
  source.close();
  await deleteDB(name);
  const old = await openDB(name, 6, {
    upgrade(db) {
      for (const schema of schemas) {
        const store = db.createObjectStore(schema.name, {
          keyPath: schema.keyPath,
          autoIncrement: schema.autoIncrement,
        });
        for (const index of schema.indexes)
          store.createIndex(index.name, index.keyPath, {
            unique: index.unique,
            multiEntry: index.multiEntry,
          });
      }
    },
  });
  const tx = old.transaction(
    schemas.map((s) => s.name),
    "readwrite",
  );
  for (const schema of schemas)
    for (const [index, row] of schema.rows.entries())
      await tx
        .objectStore(schema.name)
        .put(row, schema.keyPath === null ? schema.keys[index] : undefined);
  await tx.done;
  old.close();
  return { repo, name, schemas };
}
test("v6 to v7 migration adds only two empty stores and retains all original records, ratings, feedback and drafts byte-equivalently", async () => {
  const { repo, name, schemas } = await seedV6();
  await repo.getFocusState();
  await repo.close();
  const db = await openDB(name);
  assert.equal(db.version, 7);
  assert.equal(db.objectStoreNames.length, 14);
  for (const schema of schemas)
    assert.deepEqual(await db.getAll(schema.name), schema.rows, schema.name);
  assert.deepEqual(await db.getAll("focus-state"), []);
  assert.deepEqual(await db.getAll("focus-sessions"), []);
  db.close();
});
test("a failed v7 upgrade rolls back to v6 with all originals intact and safely retries", async () => {
  const { repo, name, schemas } = await seedV6();
  const create = IDBDatabase.prototype.createObjectStore;
  IDBDatabase.prototype.createObjectStore = function (
    ...args: Parameters<IDBDatabase["createObjectStore"]>
  ) {
    if (args[0] === "focus-sessions")
      throw new DOMException("Quota", "QuotaExceededError");
    return create.apply(this, args);
  };
  try {
    await assert.rejects(repo.getFocusState());
  } finally {
    IDBDatabase.prototype.createObjectStore = create;
  }
  const old = await openDB(name);
  assert.equal(old.version, 6);
  assert.equal(old.objectStoreNames.contains("focus-state"), false);
  for (const schema of schemas)
    assert.deepEqual(await old.getAll(schema.name), schema.rows);
  old.close();
  assert.deepEqual(await repo.listFocusSessions(), []);
  await repo.close();
});
