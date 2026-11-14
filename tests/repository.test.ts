import {
  initialLearningDraft,
  learningDraftKey,
  recordRevision,
  recordSnapshot,
  validateLearningInput,
} from "../lib/learning";
import {
  feedbackExample,
  buildFeedbackPrompt,
  parseFeedbackJSON,
  assertFeedbackContext,
  initialFeedbackDraft,
  promptStyles,
  validateFeedbackDraft,
} from "../lib/learning-feedback";
import { questionKinds, questionTemplate } from "../lib/learning";
import { filterRecords, recordKindLabel } from "../lib/record-filters";
import { newRoadmapDraft, validateRoadmapDraft } from "../lib/roadmap-draft";
import "fake-indexeddb/auto";
import {
  buildRoadmapPrompt,
  parseRoadmapJSON,
  roadmapExample,
  findRoadmapDuplicates,
} from "../lib/roadmap-json";
import { nextStudyItem } from "../lib/roadmap";
import type { FourLevel } from "../lib/model";
import { inferSubjectIcon, type SubjectIconKey } from "../lib/subject-icons";
import { latestMastery, latestOutput, masteryCounts } from "../lib/ratings";
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";

test("3.6 all question kinds and explanation styles share the same accepted feedback schema", async () => {
  const { repo, theme, itemTarget } = await learningSetup();
  for (const kind of Object.keys(
    questionKinds,
  ) as (keyof typeof questionKinds)[]) {
    const record = await repo.saveLearningRecord({
      ...initialLearningDraft(theme.id, itemTarget, "deepen"),
      questionKind: kind,
      question: questionTemplate(kind, "需要と供給"),
    });
    for (const style of promptStyles) {
      const prompt = buildFeedbackPrompt(
        record,
        theme,
        "経済学",
        undefined,
        style.value,
      );
      assert.ok(prompt.includes(`説明スタイル：${style.label}`));
      assert.ok(prompt.includes(questionKinds[kind]));
      if (kind === "definition") assert.ok(prompt.includes("簡潔な定義"));
      if (style.value === "humorous")
        assert.ok(prompt.includes("架空の例えと事実を明確に区別"));
      const source = prompt.split("\n\n").at(-1)!;
      assert.deepEqual(parseFeedbackJSON(source), feedbackExample(record));
      await repo.importFeedback(record.id, source);
    }
  }
  assert.equal((await repo.listFeedbacks()).length, 18);
  assert.deepEqual(await repo.listMasteryHistory(), []);
});

test("3.6 styles persist in registered and pending question drafts while old drafts remain compatible", async () => {
  const { repo, theme, itemTarget } = await learningSetup();
  const record = await repo.saveLearningRecord({
    ...initialLearningDraft(theme.id, itemTarget, "deepen"),
    question: "なぜ？",
  });
  const draft = {
    ...initialFeedbackDraft(
      record,
      buildFeedbackPrompt(record, theme, "経済学", undefined, "humorous"),
    ),
    style: "humorous" as const,
    copied: true,
    source: "{途中",
  };
  await repo.saveFeedbackDraft(draft);
  await repo.close();
  assert.deepEqual(await repo.getFeedbackDraft(record.id), draft);
  const { style: _style, ...old } = draft;
  assert.deepEqual(validateFeedbackDraft(old), old);
  assert.throws(
    () => validateFeedbackDraft({ ...draft, style: "other" as "simple" }),
    /形式/,
  );
  assert.equal(initialFeedbackDraft(record, "").style, "simple");
});

test("3.6 record filters classify by stored activity, never by note text, and retain legacy memos", async () => {
  const { repo, theme, themeTarget } = await learningSetup();
  const output = await repo.saveLearningRecord({
    ...initialLearningDraft(theme.id, themeTarget, "output"),
    note: "理解を深めるという文字を含む説明",
  });
  const deepen = await repo.saveLearningRecord({
    ...initialLearningDraft(theme.id, themeTarget, "deepen"),
    question: "自分の言葉で説明とは？",
  });
  const memo = await repo.addRecord(theme.id, "アウトプット 理解を深める");
  const records = await repo.listRecords();
  assert.deepEqual(
    filterRecords(records, "output").map((entry) => entry.id),
    [output.id],
  );
  assert.deepEqual(
    filterRecords(records, "deepen").map((entry) => entry.id),
    [deepen.id],
  );
  assert.equal(filterRecords(records, "all").length, 3);
  assert.equal(recordKindLabel(memo), "学習メモ（旧記録）");
  assert.equal(recordKindLabel(output), "自分の言葉で説明");
  assert.equal(recordKindLabel(deepen), "理解を深める");
  assert.deepEqual(await repo.listRecords(), records);
});
import { itemHref, studyReturnHref } from "../lib/learning-context";
import { openDB } from "idb";
import { IndexedDBStudyRepository } from "../lib/storage/indexed-db";
import { latestCompletion, progress, type LegacyTheme } from "../lib/model";
const connections: IndexedDBStudyRepository[] = [];
function repository(name = crypto.randomUUID()) {
  const repo = new IndexedDBStudyRepository(name);
  connections.push(repo);
  return repo;
}
afterEach(async () => {
  await Promise.all(connections.splice(0).map((repo) => repo.close()));
});

test("unsaved question AI work persists per target without creating records, then commits question and feedback together", async () => {
  const { repo, theme, itemTarget, themeTarget } = await learningSetup();
  const draft = {
    ...initialLearningDraft(theme.id, itemTarget, "deepen"),
    question: "需要とは？",
  };
  const now = "2026-11-01T12:00:00.000Z";
  const pending = {
    id: crypto.randomUUID(),
    themeId: theme.id,
    targetType: draft.targetType,
    targetId: draft.targetId,
    activity: "deepen" as const,
    note: draft.question,
    question: draft.question,
    questionKind: draft.questionKind,
    studiedAt: now,
    createdAt: now,
    updatedAt: now,
  };
  const source = JSON.stringify(feedbackExample(pending));
  const value = {
    ...draft,
    feedback: {
      record: pending,
      workflow: {
        ...initialFeedbackDraft(
          pending,
          buildFeedbackPrompt(pending, theme, "経済学"),
        ),
        active: true,
        step: "preview" as const,
        source,
        copied: true,
      },
    },
  };
  await repo.saveLearningDraft(value);
  const other = {
    ...initialLearningDraft(theme.id, themeTarget, "deepen"),
    question: "テーマへの問い",
  };
  await repo.saveLearningDraft(other);
  await repo.close();
  assert.deepEqual(await repo.getLearningDraft(value.key), value);
  assert.deepEqual(await repo.listRecords(), []);
  assert.deepEqual(await repo.listFeedbacks(), []);
  const saved = await repo.saveLearningRecord(value, source);
  assert.equal(saved.id, pending.id);
  assert.equal(saved.question, draft.question);
  assert.equal((await repo.listFeedbacks())[0].recordId, saved.id);
  assert.equal(await repo.getLearningDraft(value.key), undefined);
  assert.deepEqual(await repo.getLearningDraft(other.key), other);
  assert.deepEqual(await repo.listMasteryHistory(), []);
  assert.equal((await repo.getTheme(theme.id))!.updatedAt > now, true);
});

test("pending AI imports reject malformed, mismatched and changed questions and roll back all writes on failure", async () => {
  const { repo, theme, itemTarget } = await learningSetup();
  const draft = {
    ...initialLearningDraft(theme.id, itemTarget, "deepen"),
    question: "原因は？",
  };
  const now = new Date().toISOString();
  const pending = {
    id: crypto.randomUUID(),
    themeId: theme.id,
    targetType: draft.targetType,
    targetId: draft.targetId,
    activity: "deepen" as const,
    note: draft.question,
    question: draft.question,
    questionKind: draft.questionKind,
    studiedAt: now,
    createdAt: now,
    updatedAt: now,
  };
  const doc = feedbackExample(pending);
  const source = JSON.stringify(doc);
  const value = {
    ...draft,
    feedback: {
      record: pending,
      workflow: { ...initialFeedbackDraft(pending, "プロンプト"), source },
    },
  };
  await repo.saveLearningDraft(value);
  const before = await repo.getTheme(theme.id);
  for (const [candidate, json] of [
    [value, "{"],
    [value, JSON.stringify({ ...doc, targetId: "other" })],
    [{ ...value, question: "別の問い" }, source],
  ] as const)
    await assert.rejects(repo.saveLearningRecord(candidate, json));
  for (const store of ["learning-feedback", "learning-drafts"]) {
    const operation = store === "learning-feedback" ? "add" : "delete";
    const original = IDBObjectStore.prototype[operation];
    Object.defineProperty(IDBObjectStore.prototype, operation, {
      configurable: true,
      writable: true,
      value: function (this: IDBObjectStore, ...args: unknown[]) {
        if (this.name === store)
          throw new DOMException("Quota", "QuotaExceededError");
        return (original as (...values: unknown[]) => IDBRequest).apply(
          this,
          args,
        );
      },
    });
    try {
      await assert.rejects(repo.saveLearningRecord(value, source));
    } finally {
      Object.defineProperty(IDBObjectStore.prototype, operation, {
        configurable: true,
        writable: true,
        value: original,
      });
    }
    assert.deepEqual(await repo.listRecords(), []);
    assert.deepEqual(await repo.listFeedbacks(), []);
    assert.deepEqual(await repo.getTheme(theme.id), before);
    assert.deepEqual(await repo.getLearningDraft(value.key), value);
  }
});

test("return links are derived from the validated target and encode IDs", () => {
  assert.equal(
    itemHref("theme/a", "item?b"),
    "/themes/theme%2Fa/items/item%3Fb",
  );
  assert.equal(studyReturnHref("t", { type: "theme", id: "t" }), "/themes/t");
  assert.equal(
    studyReturnHref("t", { type: "item", id: "i" }),
    "/themes/t/items/i",
  );
});
async function setup() {
  const repo = repository();
  const subject = await repo.createSubject("世界史");
  const input = {
    name: "フランス革命",
    subjectId: subject.id,
    description: "背景と影響を整理",
  };
  return { repo, subject, input };
}
async function seedV1(name: string, themes: LegacyTheme[]) {
  const db = await openDB(name, 1, {
    upgrade(db) {
      db.createObjectStore("themes", { keyPath: "id" });
      db.createObjectStore("records", { keyPath: "id" }).createIndex(
        "by-theme",
        "themeId",
      );
    },
  });
  const tx = db.transaction(["themes", "records"], "readwrite");
  for (const theme of themes) await tx.objectStore("themes").add(theme);
  const record = {
    id: "record-1",
    themeId: themes[0].id,
    note: "旧版で学んだこと",
    studiedAt: "2026-11-01T08:00:00.000Z",
  };
  await tx.objectStore("records").add(record);
  await tx.done;
  db.close();
  return record;
}
const legacy: LegacyTheme = {
  id: "theme-a",
  name: "フランス革命",
  subject: "世界史",
  description: "旧データの説明\nそのまま残す",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
  lastStudiedAt: "2026-11-01T08:00:00.000Z",
  roadmap: [
    { id: "a", title: "革命が起きた原因", completed: true },
    { id: "b", title: "革命の影響", completed: false },
  ],
};
test("v1 migration retains every original field, records, roadmap and a byte-equivalent recovery copy", async () => {
  const name = crypto.randomUUID();
  const others = [
    legacy,
    { ...legacy, id: "theme-b", subject: " 世界史 ", roadmap: [] },
    { ...legacy, id: "theme-c", subject: "数学", roadmap: [] },
  ];
  const record = await seedV1(name, others);
  const repo = repository(name);
  const themes = await repo.listThemes();
  assert.equal(themes.length, 3);
  assert.equal((await repo.listSubjects()).length, 2);
  for (const original of others) {
    const migrated = themes.find((t) => t.id === original.id)!;
    const { subjectId, ...fields } = migrated;
    assert.ok(subjectId);
    assert.deepEqual(fields, original);
  }
  assert.equal(
    themes.find((t) => t.id === "theme-a")!.subjectId,
    themes.find((t) => t.id === "theme-b")!.subjectId,
  );
  assert.deepEqual(await repo.listRecords(), [
    {
      ...record,
      targetType: "theme",
      targetId: record.themeId,
      activity: "memo",
    },
  ]);
  assert.deepEqual(progress(await repo.listItems("theme-a")), {
    total: 2,
    completed: 1,
    percent: 50,
  });
  await repo.close();
  const db = await openDB(name);
  for (const original of others)
    assert.deepEqual(await db.get("legacy-themes-v1", original.id), original);
  db.close();
  assert.equal((await repo.listItems())[0].goal, "");
  const reopened = repository(name);
  assert.equal((await reopened.listItems()).length, 2);
  assert.equal((await reopened.listSubjects()).length, 2);
});
test("an interrupted migration rolls back and leaves the entire v1 database available", async () => {
  const name = crypto.randomUUID();
  const record = await seedV1(name, [legacy]);
  const originalAdd = IDBObjectStore.prototype.add;
  IDBObjectStore.prototype.add = function (
    ...args: Parameters<IDBObjectStore["add"]>
  ) {
    if (this.name === "subjects")
      throw new DOMException("Quota test", "QuotaExceededError");
    return originalAdd.apply(this, args);
  };
  const repo = repository(name);
  try {
    await assert.rejects(repo.listThemes());
  } finally {
    IDBObjectStore.prototype.add = originalAdd;
  }
  const db = await openDB(name, 1);
  assert.equal(db.version, 1);
  assert.deepEqual(await db.get("themes", legacy.id), legacy);
  assert.deepEqual(await db.get("records", record.id), record);
  assert.equal(db.objectStoreNames.contains("subjects"), false);
  db.close();
  assert.equal((await repo.listThemes()).length, 1);
});
test("subjects reject equivalent names and concurrent duplicates; renaming keeps every theme linked", async () => {
  const { repo, subject, input } = await setup();
  const theme = await repo.createTheme(input);
  await assert.rejects(repo.createSubject(" 世界史 "), /同じ名前/);
  await repo.createSubject("数学");
  await assert.rejects(repo.renameSubject(subject.id, "数学"), /同じ名前/);
  const renamed = await repo.renameSubject(subject.id, "歴史");
  assert.equal(renamed.id, subject.id);
  assert.equal((await repo.getTheme(theme.id))!.subjectId, subject.id);
  assert.equal((await repo.getTheme(theme.id))!.subject, "世界史");
  const results = await Promise.allSettled([
    repo.createSubject("ＭＡＴＨ"),
    repo.createSubject("math"),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  await assert.rejects(repo.createSubject("  "));
});
test("themes and items persist across reopening; moving subjects does not change children or history", async () => {
  const { repo, subject, input } = await setup();
  const theme = await repo.createTheme(input);
  const item = await repo.createItem(theme.id, "革命が起きた原因");
  await repo.updateItem(item.id, { title: "革命の原因", completed: true });
  await repo.addRecord(theme.id, "三部会を整理");
  const other = await repo.createSubject("経済学");
  await repo.updateTheme(theme.id, {
    ...input,
    name: "革命と経済",
    subjectId: other.id,
  });
  assert.equal((await repo.getTheme(theme.id))!.subjectId, other.id);
  assert.equal((await repo.listItems(theme.id))[0].completed, true);
  assert.equal((await repo.listRecords(theme.id)).length, 1);
  assert.equal(
    (await repo.listSubjects()).find((s) => s.id === subject.id)!.name,
    "世界史",
  );
  await repo.close();
  assert.equal((await repo.getTheme(theme.id))!.name, "革命と経済");
  assert.deepEqual(progress(await repo.listItems(theme.id)), {
    total: 1,
    completed: 1,
    percent: 100,
  });
});
test("foreign keys, stale writes and blank or oversized input never create orphan data", async () => {
  const { repo, input } = await setup();
  await assert.rejects(repo.createTheme({ ...input, subjectId: "missing" }));
  await assert.rejects(repo.createTheme({ ...input, name: "  " }));
  await assert.rejects(
    repo.createTheme({ ...input, description: "a".repeat(1001) }),
  );
  await assert.rejects(repo.createItem("missing", "原因"));
  const theme = await repo.createTheme(input);
  await assert.rejects(repo.createItem(theme.id, "   "));
  await assert.rejects(repo.createItem(theme.id, "a".repeat(121)));
  await assert.rejects(repo.addRecord(theme.id, "   "));
  await repo.deleteTheme(theme.id);
  await assert.rejects(repo.updateTheme(theme.id, input));
  await assert.rejects(repo.addRecord(theme.id, "stale"));
  await assert.rejects(repo.createItem(theme.id, "stale"));
  assert.deepEqual(await repo.listItems(), []);
  assert.deepEqual(await repo.listRecords(), []);
});
test("theme deletion cascades items and records while preserving subjects and other themes", async () => {
  const { repo, input } = await setup();
  const theme = await repo.createTheme(input);
  const other = await repo.createTheme({ ...input, name: "産業革命" });
  await repo.createItem(theme.id, "原因");
  const kept = await repo.createItem(other.id, "技術革新");
  await repo.addRecord(theme.id, "削除対象");
  await repo.addRecord(other.id, "保持対象");
  await repo.deleteTheme(theme.id);
  assert.deepEqual(await repo.listItems(), [kept]);
  assert.equal((await repo.listRecords())[0].themeId, other.id);
  assert.equal((await repo.listSubjects()).length, 1);
});
test("a failed theme timestamp write rolls back the study record atomically", async () => {
  const { repo, input } = await setup();
  const theme = await repo.createTheme(input);
  const originalPut = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function (
    ...args: Parameters<IDBObjectStore["put"]>
  ) {
    if (this.name === "themes")
      throw new DOMException("Quota test", "QuotaExceededError");
    return originalPut.apply(this, args);
  };
  try {
    await assert.rejects(repo.addRecord(theme.id, "保存失敗"), {
      name: "QuotaExceededError",
    });
  } finally {
    IDBObjectStore.prototype.put = originalPut;
  }
  assert.deepEqual(await repo.listRecords(), []);
  assert.equal((await repo.getTheme(theme.id))!.lastStudiedAt, null);
});
async function seedV2(name: string) {
  const db = await openDB(name, 2, {
    upgrade(db) {
      db.createObjectStore("subjects", { keyPath: "id" }).createIndex(
        "by-name",
        "normalizedName",
        { unique: true },
      );
      db.createObjectStore("themes", { keyPath: "id" }).createIndex(
        "by-subject",
        "subjectId",
      );
      db.createObjectStore("items", { keyPath: "id" }).createIndex(
        "by-theme",
        "themeId",
      );
      db.createObjectStore("records", { keyPath: "id" }).createIndex(
        "by-theme",
        "themeId",
      );
      db.createObjectStore("legacy-themes-v1", { keyPath: "id" });
    },
  });
  const subject = {
    id: "s1",
    name: "世界史",
    normalizedName: "世界史",
    createdAt: legacy.createdAt,
    updatedAt: legacy.updatedAt,
  };
  const theme = { ...legacy, subjectId: subject.id };
  const item = {
    id: "item-1",
    themeId: theme.id,
    title: "原因",
    completed: true,
    position: 0,
    createdAt: legacy.createdAt,
    updatedAt: legacy.updatedAt,
  };
  const record = {
    id: "v2-record",
    themeId: theme.id,
    note: "既存の記録\nそのまま残す",
    studiedAt: legacy.lastStudiedAt!,
  };
  const tx = db.transaction(
    ["subjects", "themes", "items", "records"],
    "readwrite",
  );
  await tx.objectStore("subjects").add(subject);
  await tx.objectStore("themes").add(theme);
  await tx.objectStore("items").add(item);
  await tx.objectStore("records").add(record);
  await tx.done;
  db.close();
  return { subject, theme, item, record };
}
test("v2 upgrades preserve subjects, themes, mastery and original records with theme targeting", async () => {
  const name = crypto.randomUUID();
  const old = await seedV2(name);
  const repo = repository(name);
  assert.deepEqual(await repo.listSubjects(), [old.subject]);
  assert.deepEqual(await repo.getTheme(old.theme.id), old.theme);
  assert.deepEqual(await repo.listItems(), [{ ...old.item, goal: "" }]);
  assert.deepEqual(await repo.listRecords(), [
    {
      ...old.record,
      targetType: "theme",
      targetId: old.theme.id,
      activity: "memo",
    },
  ]);
  assert.deepEqual(
    await repo.listTargetRecords({ type: "item", id: old.item.id }),
    [],
  );
  await repo.close();
  const db = await openDB(name);
  assert.deepEqual(
    await db.get("legacy-records-v2", old.record.id),
    old.record,
  );
  db.close();
  assert.equal((await repo.listRecords()).length, 1);
});
test("a failed v3 migration restores v2 and its records; retry is safe", async () => {
  const name = crypto.randomUUID();
  const old = await seedV2(name);
  const originalUpdate = IDBCursor.prototype.update;
  IDBCursor.prototype.update = function (
    ...args: Parameters<IDBCursor["update"]>
  ) {
    if (this.source.name === "records")
      throw new DOMException("Quota test", "QuotaExceededError");
    return originalUpdate.apply(this, args);
  };
  const repo = repository(name);
  try {
    await assert.rejects(repo.listRecords());
  } finally {
    IDBCursor.prototype.update = originalUpdate;
  }
  const db = await openDB(name, 2);
  assert.equal(db.version, 2);
  assert.deepEqual(await db.get("records", old.record.id), old.record);
  assert.deepEqual(await db.get("items", old.item.id), old.item);
  assert.equal(db.objectStoreNames.contains("legacy-records-v2"), false);
  db.close();
  assert.equal(
    (await repo.listTargetRecords({ type: "theme", id: old.theme.id })).length,
    1,
  );
});
test("theme and item completion are independent and never change roadmap mastery", async () => {
  const { repo, input } = await setup();
  const theme = await repo.createTheme(input);
  const item = await repo.createItem(theme.id, "原因", "背景を説明できる");
  const themeRecord = await repo.addRecord(theme.id, "テーマの学び", {
    completion: 20,
    activity: "output",
  });
  const itemRecord = await repo.addRecord(theme.id, "項目の学び", {
    target: { type: "item", id: item.id },
    completion: 90,
    activity: "deepen",
  });
  const records = await repo.listRecords(theme.id);
  assert.equal(themeRecord.targetType, "theme");
  assert.equal(themeRecord.targetId, theme.id);
  assert.equal(itemRecord.targetType, "item");
  assert.equal(latestCompletion(records, { type: "theme", id: theme.id }), 20);
  assert.equal(latestCompletion(records, { type: "item", id: item.id }), 90);
  assert.equal(
    (await repo.listTargetRecords({ type: "theme", id: theme.id })).length,
    1,
  );
  assert.equal(
    (await repo.listTargetRecords({ type: "item", id: item.id })).length,
    1,
  );
  assert.deepEqual(progress(await repo.listItems()), {
    total: 1,
    completed: 0,
    percent: 0,
  });
  await repo.updateItem(item.id, { title: "革命の原因", completed: true });
  assert.equal((await repo.listItems())[0].goal, "背景を説明できる");
  await repo.close();
  assert.equal(
    latestCompletion(await repo.listRecords(), { type: "theme", id: theme.id }),
    20,
  );
});
test("zero and omitted completion are distinguished; invalid or mismatched targets do not save", async () => {
  const { repo, input } = await setup();
  const theme = await repo.createTheme(input);
  const item = await repo.createItem(theme.id, "原因");
  const other = await repo.createTheme({ ...input, name: "別テーマ" });
  await repo.addRecord(theme.id, "0の完成度", { completion: 0 });
  await repo.addRecord(theme.id, "未設定の完成度", {
    target: { type: "item", id: item.id },
  });
  assert.equal(
    latestCompletion(await repo.listRecords(), { type: "theme", id: theme.id }),
    0,
  );
  assert.equal(
    latestCompletion(await repo.listRecords(), { type: "item", id: item.id }),
    undefined,
  );
  for (const completion of [-1, 101, NaN, Infinity, 1.5])
    await assert.rejects(repo.addRecord(theme.id, "不正値", { completion }));
  await assert.rejects(
    repo.addRecord(other.id, "別テーマの項目", {
      target: { type: "item", id: item.id },
    }),
  );
  await assert.rejects(
    repo.addRecord(theme.id, "不正なテーマ", {
      target: { type: "theme", id: other.id },
    }),
  );
  await assert.rejects(
    repo.addRecord(theme.id, "削除済み項目", {
      target: { type: "item", id: "missing" },
    }),
  );
  assert.equal((await repo.listRecords()).length, 2);
});
test("deleting an item removes only its scoped records; goals validate without data loss", async () => {
  const { repo, input } = await setup();
  const theme = await repo.createTheme(input);
  const first = await repo.createItem(theme.id, "原因", "説明できる");
  const second = await repo.createItem(theme.id, "影響");
  await repo.addRecord(theme.id, "テーマの記録");
  await repo.addRecord(theme.id, "削除する記録", {
    target: { type: "item", id: first.id },
  });
  await repo.addRecord(theme.id, "残す項目記録", {
    target: { type: "item", id: second.id },
  });
  await assert.rejects(
    repo.updateItem(first.id, {
      title: first.title,
      completed: false,
      goal: "a".repeat(1001),
    }),
  );
  assert.equal((await repo.listItems())[0].goal, "説明できる");
  await repo.deleteItem(first.id);
  assert.equal((await repo.listRecords()).length, 2);
  assert.equal(
    (await repo.listTargetRecords({ type: "item", id: first.id })).length,
    0,
  );
  await assert.rejects(
    repo.addRecord(theme.id, "古いフォーム", {
      target: { type: "item", id: first.id },
    }),
  );
});

async function seedV3(name: string) {
  const old = await seedV2(name);
  const db = await openDB(name, 3, {
    upgrade(db, _old, _new, tx) {
      tx.objectStore("records").createIndex("by-target", [
        "targetType",
        "targetId",
      ]);
      db.createObjectStore("legacy-records-v2", { keyPath: "id" }).createIndex(
        "by-theme",
        "themeId",
      );
    },
  });
  const tx = db.transaction(Array.from(db.objectStoreNames), "readwrite");
  await tx
    .objectStore("items")
    .put({ ...old.item, goal: "消してはいけない目標" });
  await tx.objectStore("records").put({
    ...old.record,
    activity: "output",
    targetType: "theme",
    targetId: old.theme.id,
    completion: 0,
  });
  await tx.objectStore("records").add({
    ...old.record,
    id: "percent-100",
    activity: "output",
    targetType: "item",
    targetId: old.item.id,
    completion: 100,
  });
  await tx.objectStore("legacy-records-v2").add(old.record);
  await tx.objectStore("legacy-themes-v1").add(legacy);
  await tx.done;
  const original: Record<string, unknown[]> = {};
  for (const store of Array.from(db.objectStoreNames))
    original[store] = await db.getAll(store);
  db.close();
  return { old, original };
}
test("v3 to v6 preserves every existing store byte-equivalently and never converts old percentages or mastery", async () => {
  const name = crypto.randomUUID();
  const { old, original } = await seedV3(name);
  const repo = repository(name);
  assert.equal((await repo.listSubjectIcons())[0].icon, "history");
  assert.deepEqual(await repo.listMasteryHistory(), []);
  assert.deepEqual(
    (await repo.listRecords())
      .map((record) => record.completion)
      .sort((a, b) => a! - b!),
    [0, 100],
  );
  assert.ok(
    (await repo.listRecords()).every(
      (record) => record.outputRating === undefined,
    ),
  );
  assert.equal(
    latestMastery(await repo.listMasteryHistory(), {
      type: "item",
      id: old.item.id,
    }),
    undefined,
  );
  await repo.close();
  const db = await openDB(name);
  assert.equal(db.version, 6);
  for (const [store, rows] of Object.entries(original))
    assert.deepEqual(await db.getAll(store), rows);
  db.close();
  await repo.setSubjectIcon(old.subject.id, "chemistry");
  await repo.close();
  assert.equal((await repo.listSubjectIcons())[0].source, "manual");
  assert.equal((await repo.listSubjectIcons())[0].icon, "chemistry");
  assert.equal((await repo.listRecords()).length, 2);
});
test("a failed v4 icon migration rolls back the entire upgrade and can retry without duplication", async () => {
  const name = crypto.randomUUID();
  const { original } = await seedV3(name);
  const add = IDBObjectStore.prototype.add;
  IDBObjectStore.prototype.add = function (
    ...args: Parameters<IDBObjectStore["add"]>
  ) {
    if (this.name === "subject-icons")
      throw new DOMException("Quota", "QuotaExceededError");
    return add.apply(this, args);
  };
  const repo = repository(name);
  try {
    await assert.rejects(repo.listSubjects());
  } finally {
    IDBObjectStore.prototype.add = add;
  }
  const db = await openDB(name, 3);
  assert.equal(db.version, 3);
  assert.equal(db.objectStoreNames.contains("mastery-history"), false);
  for (const [store, rows] of Object.entries(original))
    assert.deepEqual(await db.getAll(store), rows);
  db.close();
  assert.equal((await repo.listSubjectIcons()).length, 1);
  await repo.close();
  assert.equal((await repo.listSubjectIcons()).length, 1);
});
test("subject keywords cover related names, normalize full-width text and fall back without APIs", () => {
  const examples = {
    math: ["数学Ⅰ", "線形代数", "微分積分", "確率統計"],
    language: ["英語", "ＴＯＥＩＣ", "英文学"],
    history: ["世界史", "日本史", "西洋史"],
    physics: ["物理基礎", "量子力学"],
    chemistry: ["有機化学"],
    biology: ["生物基礎", "生命科学"],
    economics: ["経済学", "ミクロ経済学"],
    code: ["情報Ⅰ", "プログラミング"],
    general: ["ゼミ", "", "未知の科目"],
  };
  for (const [icon, names] of Object.entries(examples))
    for (const name of names) assert.equal(inferSubjectIcon(name), icon, name);
});
test("automatic icons follow renames while manual icons persist until automatic is explicitly restored", async () => {
  const repo = repository();
  const subject = await repo.createSubject("数学Ⅰ");
  assert.equal((await repo.listSubjectIcons())[0].icon, "math");
  await repo.renameSubject(subject.id, "英語");
  assert.equal((await repo.listSubjectIcons())[0].icon, "language");
  await repo.setSubjectIcon(subject.id, "biology");
  await repo.renameSubject(subject.id, "世界史");
  await repo.close();
  assert.equal((await repo.listSubjectIcons())[0].icon, "biology");
  assert.equal((await repo.listSubjectIcons())[0].source, "manual");
  await repo.setSubjectIcon(subject.id, "auto");
  assert.equal((await repo.listSubjectIcons())[0].icon, "history");
  await assert.rejects(
    repo.setSubjectIcon(subject.id, "invalid" as SubjectIconKey),
  );
  await assert.rejects(repo.setSubjectIcon("missing", "math"));
  await assert.rejects(repo.createSubject(" 世界史 "));
  assert.equal((await repo.listSubjectIcons()).length, 1);
});
test("four-level mastery is scoped, can decrease, retains every event and never follows output ratings", async () => {
  const { repo, input } = await setup();
  const theme = await repo.createTheme(input);
  const item = await repo.createItem(theme.id, "原因");
  const themeTarget = { type: "theme" as const, id: theme.id };
  const itemTarget = { type: "item" as const, id: item.id };
  await repo.setMastery(theme.id, themeTarget, 2);
  for (const level of [1, 2, 3, 4, 2] as const)
    await repo.setMastery(theme.id, itemTarget, level);
  const history = await repo.listMasteryHistory(theme.id);
  assert.equal(history.length, 6);
  assert.equal(latestMastery(history, itemTarget), 2);
  assert.equal(latestMastery(history, themeTarget), 2);
  assert.ok(
    history.every((event) => !Number.isNaN(Date.parse(event.changedAt))),
  );
  await repo.addRecord(theme.id, "十分できたアウトプット", {
    target: itemTarget,
    activity: "output",
    outputRating: 4,
  });
  await repo.addRecord(theme.id, "未評価のアウトプット", {
    target: themeTarget,
    activity: "output",
  });
  assert.deepEqual(await repo.listMasteryHistory(), history);
  assert.equal(
    (await repo.listRecords()).find((record) => record.targetType === "item")!
      .outputRating,
    4,
  );
  assert.equal(
    (await repo.listRecords()).find((record) => record.targetType === "theme")!
      .outputRating,
    undefined,
  );
  assert.equal((await repo.listItems())[0].completed, false);
  assert.deepEqual(masteryCounts(await repo.listItems(), history), {
    1: 0,
    2: 1,
    3: 0,
    4: 0,
    unrated: 0,
    total: 1,
  });
  await repo.close();
  assert.equal(latestMastery(await repo.listMasteryHistory(), itemTarget), 2);
});
test("unrated output sessions remain unrated and do not inherit a previous session or change mastery", async () => {
  const name = crypto.randomUUID();
  const repo = repository(name);
  const subject = await repo.createSubject("世界史");
  const theme = await repo.createTheme({
    name: "革命",
    subjectId: subject.id,
    description: "",
  });
  const target = { type: "theme" as const, id: theme.id };
  for (const level of [1, 2, 3, 4] as const)
    await repo.addRecord(theme.id, `評価${level}`, {
      activity: "output",
      outputRating: level,
    });
  // Distinct fixture times make the latest-session policy independent of CPU speed.
  const db = await openDB(name);
  const records = await db.getAll("records");
  for (const record of records)
    await db.put("records", {
      ...record,
      studiedAt: "2026-01-01T00:00:00.000Z",
    });
  db.close();
  await repo.addRecord(theme.id, "未評価", { activity: "output" });
  assert.equal(
    latestOutput(await repo.listRecords(), target)?.outputRating,
    undefined,
  );
  assert.equal((await repo.listRecords()).length, 5);
  assert.deepEqual(await repo.listMasteryHistory(), []);
});
test("invalid ratings and foreign or deleted targets cannot create mastery events or output records", async () => {
  const { repo, input } = await setup();
  const theme = await repo.createTheme(input);
  const other = await repo.createTheme({ ...input, name: "別テーマ" });
  const item = await repo.createItem(theme.id, "原因");
  for (const level of [0, 5, NaN, Infinity, 1.5]) {
    await assert.rejects(
      repo.setMastery(
        theme.id,
        { type: "item", id: item.id },
        level as FourLevel,
      ),
    );
    await assert.rejects(
      repo.addRecord(theme.id, "不正値", {
        activity: "output",
        outputRating: level as FourLevel,
      }),
    );
  }
  await assert.rejects(
    repo.setMastery(other.id, { type: "item", id: item.id }, 3),
  );
  await assert.rejects(
    repo.setMastery(theme.id, { type: "theme", id: other.id }, 3),
  );
  await assert.rejects(
    repo.setMastery(theme.id, { type: "item", id: "missing" }, 3),
  );
  await assert.rejects(
    repo.addRecord(theme.id, "違う評価", {
      activity: "deepen",
      outputRating: 3,
    }),
  );
  assert.deepEqual(await repo.listMasteryHistory(), []);
  assert.deepEqual(await repo.listRecords(), []);
});
test("mastery history deletion is scoped to its parent and failed writes retain the previous level", async () => {
  const { repo, input } = await setup();
  const theme = await repo.createTheme(input);
  const other = await repo.createTheme({ ...input, name: "別テーマ" });
  const item = await repo.createItem(theme.id, "原因");
  await repo.setMastery(theme.id, { type: "item", id: item.id }, 4);
  await repo.setMastery(theme.id, { type: "theme", id: theme.id }, 2);
  await repo.setMastery(other.id, { type: "theme", id: other.id }, 3);
  const add = IDBObjectStore.prototype.add;
  IDBObjectStore.prototype.add = function (
    ...args: Parameters<IDBObjectStore["add"]>
  ) {
    if (this.name === "mastery-history")
      throw new DOMException("Quota", "QuotaExceededError");
    return add.apply(this, args);
  };
  try {
    await assert.rejects(
      repo.setMastery(theme.id, { type: "item", id: item.id }, 1),
    );
  } finally {
    IDBObjectStore.prototype.add = add;
  }
  assert.equal(
    latestMastery(await repo.listMasteryHistory(), {
      type: "item",
      id: item.id,
    }),
    4,
  );
  await repo.deleteItem(item.id);
  assert.equal((await repo.listMasteryHistory()).length, 2);
  await repo.deleteTheme(theme.id);
  const remaining = await repo.listMasteryHistory();
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].themeId, other.id);
});

function roadmapSource(
  items = [
    { title: "革命の背景", goal: "身分制度の特徴を自分の言葉で説明できる" },
  ],
  subject = "世界史",
  theme = "フランス革命",
) {
  return JSON.stringify({ version: 1, subject, theme, items });
}
test("the fixed prompt and import validator share the same versioned JSON format", () => {
  const example = roadmapExample("世界史", "フランス革命");
  const prompt = buildRoadmapPrompt({
    subject: "世界史",
    theme: "フランス革命",
    goal: "革命の背景と変化を説明できる",
    level: "university",
    notes: "初学者向け",
  });
  assert.ok(prompt.includes("大学"));
  assert.ok(prompt.includes("確認可能な行動"));
  assert.ok(prompt.includes("指定外の項目は出力しない"));
  assert.ok(prompt.endsWith(JSON.stringify(example, null, 2)));
  assert.deepEqual(parseRoadmapJSON(prompt.split("\n\n").at(-1)!), example);
  assert.throws(
    () =>
      buildRoadmapPrompt({
        subject: "世界史",
        theme: "革命",
        goal: "",
        level: "other",
        notes: "",
      }),
    /到達目標/,
  );
});
test("JSON validation reports syntax, version, required fields, sizes and unsupported assessment fields precisely", () => {
  const invalid: [string, RegExp][] = [
    ["{", /構文/],
    ["```json\n{}\n```", /コードブロック/],
    ["null", /オブジェクト/],
    ["[]", /オブジェクト/],
    [JSON.stringify({ version: 2 }), /version/],
    [JSON.stringify({ version: "1" }), /version/],
    [JSON.stringify({ version: 1, theme: "革命", items: [] }), /subject/],
    [roadmapSource([], "世界史", "フランス革命"), /items/],
    [roadmapSource([{ title: "", goal: "説明" }]), /items\[0\].title/],
    [roadmapSource([{ title: "原因", goal: "" }]), /items\[0\].goal/],
    [roadmapSource([{ title: "a".repeat(121), goal: "説明" }]), /120文字/],
    [roadmapSource([{ title: "原因", goal: "a".repeat(1001) }]), /1000文字/],
    [
      roadmapSource(
        Array.from({ length: 51 }, (_, index) => ({
          title: `項目${index}`,
          goal: "説明",
        })),
      ),
      /1〜50/,
    ],
    [
      JSON.stringify({
        version: 1,
        subject: "世界史",
        theme: "革命",
        items: [{ title: "原因", goal: "説明", completed: true }],
      }),
      /completed/,
    ],
    [
      JSON.stringify({
        version: 1,
        subject: "世界史",
        theme: "革命",
        items: [null],
      }),
      /items\[0\]/,
    ],
    [
      JSON.stringify({
        version: 1,
        subject: "世界史",
        theme: "革命",
        items: [{ title: 1, goal: "説明" }],
      }),
      /title/,
    ],
    [" ".repeat(100001), /100,000/],
  ];
  for (const [source, message] of invalid)
    assert.throws(() => parseRoadmapJSON(source), message);
  const valid = parseRoadmapJSON(
    roadmapSource([{ title: " 原因 ", goal: " 背景を説明できる " }]),
  );
  assert.equal(valid.items[0].title, "原因");
  assert.equal(valid.items[0].goal, "背景を説明できる");
});
test("duplicate checks cover normalized existing titles and repeated titles inside the same import", () => {
  const document = parseRoadmapJSON(
    roadmapSource([
      { title: " Ａ  B ", goal: "説明1" },
      { title: "a b", goal: "説明2" },
      { title: "別項目", goal: "説明3" },
    ]),
  );
  assert.deepEqual(findRoadmapDuplicates(document.items, [{ title: "a b" }]), [
    { index: 0, existing: true, within: false },
    { index: 1, existing: true, within: true },
  ]);
});
test("theme goal editing preserves current names, hierarchy, legacy roadmap, records and independent mastery", async () => {
  const { repo, input } = await setup();
  const theme = await repo.createTheme(input);
  const item = await repo.createItem(theme.id, "原因", "元の到達目標");
  const record = await repo.addRecord(theme.id, "既存の記録", {
    completion: 60,
  });
  await repo.setMastery(theme.id, { type: "theme", id: theme.id }, 2);
  await repo.updateTheme(theme.id, { ...input, name: "近代社会" });
  const updated = await repo.updateThemeGoal(
    theme.id,
    "社会と政治の変化を比較して説明できる",
  );
  assert.equal(updated.name, "近代社会");
  assert.equal(updated.subjectId, input.subjectId);
  assert.deepEqual(updated.roadmap, theme.roadmap);
  assert.equal(updated.description, "社会と政治の変化を比較して説明できる");
  assert.deepEqual(await repo.listItems(), [item]);
  assert.deepEqual(await repo.listRecords(), [record]);
  assert.equal(
    latestMastery(await repo.listMasteryHistory(), {
      type: "theme",
      id: theme.id,
    }),
    2,
  );
  await assert.rejects(repo.updateThemeGoal(theme.id, "x".repeat(1001)));
  assert.deepEqual(await repo.getTheme(theme.id), updated);
  await repo.close();
  assert.equal(
    (await repo.getTheme(theme.id))!.description,
    updated.description,
  );
});
test("moving items persists their order without changing goals, legacy mastery, records or another theme", async () => {
  const { repo, input } = await setup();
  const theme = await repo.createTheme(input);
  const other = await repo.createTheme({ ...input, name: "別テーマ" });
  const a = await repo.createItem(theme.id, "前提", "目標A");
  const b = await repo.createItem(theme.id, "原因", "目標B");
  const c = await repo.createItem(theme.id, "影響", "目標C");
  const outside = await repo.createItem(other.id, "他の項目");
  await repo.updateItem(b.id, {
    title: b.title,
    goal: b.goal,
    completed: true,
  });
  const record = await repo.addRecord(theme.id, "原因を説明", {
    target: { type: "item", id: b.id },
    activity: "output",
    outputRating: 3,
  });
  const history = await repo.setMastery(
    theme.id,
    { type: "item", id: b.id },
    2,
  );
  await repo.moveItem(theme.id, c.id, "up");
  assert.deepEqual(
    (await repo.listItems(theme.id)).map((item) => item.id),
    [a.id, c.id, b.id],
  );
  await repo.moveItem(theme.id, a.id, "down");
  const reordered = await repo.listItems(theme.id);
  assert.deepEqual(
    reordered.map((item) => item.position),
    [0, 1, 2],
  );
  assert.deepEqual(
    reordered.map((item) => item.id),
    [c.id, a.id, b.id],
  );
  assert.equal(reordered[2].goal, "目標B");
  assert.equal(reordered[2].completed, true);
  assert.deepEqual(await repo.listItems(other.id), [outside]);
  assert.deepEqual(await repo.listRecords(), [record]);
  assert.deepEqual(await repo.listMasteryHistory(), [history]);
  await repo.moveItem(theme.id, c.id, "up");
  assert.deepEqual(await repo.listItems(theme.id), reordered);
  await assert.rejects(repo.moveItem(theme.id, outside.id, "up"));
  await assert.rejects(repo.moveItem(theme.id, "missing", "down"));
  await repo.close();
  assert.deepEqual(await repo.listItems(theme.id), reordered);
});
test("a failed reorder rolls back every position and timestamp", async () => {
  const { repo, input } = await setup();
  const theme = await repo.createTheme(input);
  const a = await repo.createItem(theme.id, "前提");
  await repo.createItem(theme.id, "原因");
  const before = await repo.listItems();
  const put = IDBObjectStore.prototype.put;
  let writes = 0;
  IDBObjectStore.prototype.put = function (
    ...args: Parameters<IDBObjectStore["put"]>
  ) {
    if (this.name === "items" && ++writes === 2)
      throw new DOMException("Quota", "QuotaExceededError");
    return put.apply(this, args);
  };
  try {
    await assert.rejects(repo.moveItem(theme.id, a.id, "down"));
  } finally {
    IDBObjectStore.prototype.put = put;
  }
  assert.deepEqual(await repo.listItems(), before);
});
test("next study follows display order, prioritizes stages 1 or 2, then unassessed, and ignores theme mastery", async () => {
  const { repo, input } = await setup();
  const theme = await repo.createTheme(input);
  const unrated = await repo.createItem(theme.id, "未評価");
  const ready = await repo.createItem(theme.id, "説明できる");
  const studying = await repo.createItem(theme.id, "学習中");
  const newItem = await repo.createItem(theme.id, "未着手");
  await repo.setMastery(theme.id, { type: "item", id: ready.id }, 3);
  await repo.setMastery(theme.id, { type: "item", id: studying.id }, 2);
  await repo.setMastery(theme.id, { type: "item", id: newItem.id }, 1);
  const next = async () =>
    nextStudyItem(
      await repo.listItems(theme.id),
      await repo.listMasteryHistory(),
    )?.id;
  assert.equal(await next(), studying.id);
  await repo.moveItem(theme.id, newItem.id, "up");
  assert.equal(await next(), newItem.id);
  await repo.setMastery(theme.id, { type: "item", id: newItem.id }, 4);
  assert.equal(await next(), studying.id);
  await repo.setMastery(theme.id, { type: "item", id: studying.id }, 3);
  assert.equal(await next(), unrated.id);
  await repo.setMastery(theme.id, { type: "item", id: unrated.id }, 3);
  await repo.setMastery(theme.id, { type: "theme", id: theme.id }, 1);
  assert.equal(await next(), undefined);
});
test("JSON imports append new IDs in JSON order while all existing rows and assessment histories remain unchanged", async () => {
  const { repo, input } = await setup();
  const theme = await repo.createTheme(input);
  const original = await repo.createItem(theme.id, "既存", "既存の目標");
  const record = await repo.addRecord(theme.id, "元の記録", {
    completion: 100,
  });
  const beforeTheme = await repo.getTheme(theme.id);
  const mastery = await repo.setMastery(
    theme.id,
    { type: "item", id: original.id },
    4,
  );
  const added = await repo.importRoadmap(
    theme.id,
    roadmapSource([
      { title: "原因", goal: "背景を説明できる" },
      { title: "影響", goal: "変化を比較できる" },
    ]),
  );
  assert.equal(new Set(added.map((item) => item.id)).size, 2);
  assert.deepEqual(
    added.map((item) => item.position),
    [1, 2],
  );
  assert.deepEqual(
    (await repo.listItems(theme.id)).map((item) => item.title),
    ["既存", "原因", "影響"],
  );
  assert.deepEqual((await repo.listItems(theme.id))[0], original);
  assert.ok(
    added.every((item) => !item.completed && item.themeId === theme.id),
  );
  assert.deepEqual(await repo.listRecords(), [record]);
  assert.deepEqual(await repo.listMasteryHistory(), [mastery]);
  assert.deepEqual(await repo.getTheme(theme.id), beforeTheme);
  await repo.close();
  assert.equal((await repo.listItems(theme.id)).length, 3);
});
test("duplicate imports need explicit consent and do not overwrite either title or goal", async () => {
  const { repo, input } = await setup();
  const theme = await repo.createTheme(input);
  const original = await repo.createItem(theme.id, "Ａ  B", "元の目標");
  const source = roadmapSource([
    { title: "a b", goal: "新しい目標" },
    { title: "a b", goal: "別の新しい目標" },
  ]);
  await assert.rejects(repo.importRoadmap(theme.id, source), /同じ名前/);
  assert.deepEqual(await repo.listItems(), [original]);
  await repo.importRoadmap(theme.id, source, true);
  assert.equal((await repo.listItems()).length, 3);
  assert.deepEqual((await repo.listItems())[0], original);
});
test("a failed import rolls back every inserted item and leaves the existing database usable", async () => {
  const { repo, input } = await setup();
  const theme = await repo.createTheme(input);
  const original = await repo.createItem(theme.id, "既存", "残す目標");
  const add = IDBObjectStore.prototype.add;
  let writes = 0;
  IDBObjectStore.prototype.add = function (
    ...args: Parameters<IDBObjectStore["add"]>
  ) {
    if (this.name === "items" && ++writes === 2)
      throw new DOMException("Quota", "QuotaExceededError");
    return add.apply(this, args);
  };
  const source = roadmapSource([
    { title: "原因", goal: "原因を説明できる" },
    { title: "影響", goal: "影響を説明できる" },
  ]);
  try {
    await assert.rejects(repo.importRoadmap(theme.id, source));
  } finally {
    IDBObjectStore.prototype.add = add;
  }
  await repo.close();
  assert.deepEqual(await repo.listItems(), [original]);
  assert.deepEqual(await repo.listRecords(), []);
  assert.deepEqual(await repo.listMasteryHistory(), []);
  await repo.importRoadmap(theme.id, source);
  assert.equal((await repo.listItems()).length, 3);
});
test("imports recheck context and duplicates at commit time including concurrent imports", async () => {
  const { repo, input } = await setup();
  const theme = await repo.createTheme(input);
  const source = roadmapSource();
  parseRoadmapJSON(source);
  await repo.updateTheme(theme.id, { ...input, name: "変更後" });
  await assert.rejects(repo.importRoadmap(theme.id, source), /theme/);
  await repo.updateTheme(theme.id, input);
  await repo.renameSubject(input.subjectId, "歴史");
  await assert.rejects(repo.importRoadmap(theme.id, source), /subject/);
  await repo.renameSubject(input.subjectId, "世界史");
  const result = await Promise.allSettled([
    repo.importRoadmap(theme.id, source),
    repo.importRoadmap(theme.id, source),
  ]);
  assert.equal(
    result.filter((entry) => entry.status === "fulfilled").length,
    1,
  );
  assert.equal((await repo.listItems()).length, 1);
  const before = await repo.listItems();
  await assert.rejects(repo.importRoadmap(theme.id, "{}"));
  assert.deepEqual(await repo.listItems(), before);
  await repo.deleteTheme(theme.id);
  await assert.rejects(repo.importRoadmap(theme.id, source), /テーマ/);
});

async function seedV4(name: string) {
  const { old } = await seedV3(name);
  const db = await openDB(name, 4, {
    upgrade(db) {
      db.createObjectStore("subject-icons", { keyPath: "subjectId" });
      const history = db.createObjectStore("mastery-history", {
        autoIncrement: true,
      });
      history.createIndex("by-theme", "themeId");
      history.createIndex("by-target", ["targetType", "targetId"]);
    },
  });
  await db.put("subject-icons", {
    subjectId: old.subject.id,
    icon: "physics",
    source: "manual",
    updatedAt: "2026-11-01",
  });
  await db.add("mastery-history", {
    themeId: old.theme.id,
    targetType: "item",
    targetId: old.item.id,
    level: 3,
    changedAt: "2026-11-01",
  });
  const rows: Record<string, unknown[]> = {};
  for (const store of Array.from(db.objectStoreNames))
    rows[store] = await db.getAll(store);
  db.close();
  return { old, rows };
}
test("v4 to v6 adds draft and feedback stores and preserves all eight original stores", async () => {
  const name = crypto.randomUUID();
  const { old, rows } = await seedV4(name);
  const repo = repository(name);
  assert.equal(await repo.getRoadmapDraft(old.theme.id), undefined);
  await repo.close();
  const db = await openDB(name);
  assert.equal(db.version, 6);
  assert.equal(db.objectStoreNames.length, 12);
  for (const [store, values] of Object.entries(rows))
    assert.deepEqual(await db.getAll(store), values);
  assert.deepEqual(await db.getAll("roadmap-drafts"), []);
  db.close();
});
test("failed v5 draft-store creation rolls back to v4 and retries safely", async () => {
  const name = crypto.randomUUID();
  const { rows } = await seedV4(name);
  const create = IDBDatabase.prototype.createObjectStore;
  IDBDatabase.prototype.createObjectStore = function (
    ...args: Parameters<IDBDatabase["createObjectStore"]>
  ) {
    if (args[0] === "roadmap-drafts")
      throw new DOMException("Quota", "QuotaExceededError");
    return create.apply(this, args);
  };
  const repo = repository(name);
  try {
    await assert.rejects(repo.listThemes());
  } finally {
    IDBDatabase.prototype.createObjectStore = create;
  }
  const db = await openDB(name);
  assert.equal(db.version, 4);
  assert.equal(db.objectStoreNames.contains("roadmap-drafts"), false);
  for (const [store, values] of Object.entries(rows))
    assert.deepEqual(await db.getAll(store), values);
  db.close();
  assert.ok((await repo.listThemes()).length);
  await repo.close();
  const upgraded = await openDB(name);
  assert.equal(upgraded.version, 6);
  upgraded.close();
});
test("versioned drafts retain unfinished inputs and step separately per theme and disappear with their theme", async () => {
  const { repo, input } = await setup();
  const a = await repo.createTheme(input);
  const b = await repo.createTheme({ ...input, name: "革命後" });
  const first = {
    ...newRoadmapDraft(a),
    active: true,
    step: "json" as const,
    goal: "下書きの目標",
    level: "university" as const,
    notes: "補足",
    prompt: "コピー済みプロンプト",
    copied: true,
    source: "{ unfinished",
  };
  const second = { ...newRoadmapDraft(b), active: false, notes: "別テーマ" };
  await repo.saveRoadmapDraft(first);
  await repo.saveRoadmapDraft(second);
  await repo.close();
  assert.deepEqual(await repo.getRoadmapDraft(a.id), first);
  assert.deepEqual(await repo.getRoadmapDraft(b.id), second);
  assert.deepEqual(await repo.listItems(), []);
  assert.equal((await repo.getTheme(a.id))?.description, input.description);
  assert.throws(() => validateRoadmapDraft({ ...first, version: 2 } as never));
  await assert.rejects(
    repo.saveRoadmapDraft({ ...first, source: "a".repeat(100001) }),
  );
  assert.deepEqual(await repo.getRoadmapDraft(a.id), first);
  await repo.deleteTheme(a.id);
  assert.equal(await repo.getRoadmapDraft(a.id), undefined);
  await assert.rejects(repo.saveRoadmapDraft(first), /テーマ/);
  assert.deepEqual(await repo.getRoadmapDraft(b.id), second);
});
test("successful import removes only its draft atomically; invalid JSON and aborted batches preserve drafts and old items", async () => {
  const { repo, input } = await setup();
  const theme = await repo.createTheme(input);
  const other = await repo.createTheme({ ...input, name: "別テーマ" });
  const item = await repo.createItem(theme.id, "残す項目", "既存の目標");
  const source = roadmapSource([
    { title: "新規A", goal: "目標A" },
    { title: "新規B", goal: "目標B" },
  ]);
  const draft = {
    ...newRoadmapDraft(theme),
    active: true,
    step: "preview" as const,
    source,
  };
  const otherDraft = newRoadmapDraft(other);
  await repo.saveRoadmapDraft(draft);
  await repo.saveRoadmapDraft(otherDraft);
  await assert.rejects(repo.importRoadmap(theme.id, "{"));
  assert.deepEqual(await repo.getRoadmapDraft(theme.id), draft);
  const add = IDBObjectStore.prototype.add;
  let writes = 0;
  IDBObjectStore.prototype.add = function (
    ...args: Parameters<IDBObjectStore["add"]>
  ) {
    if (this.name === "items" && ++writes === 2)
      throw new DOMException("Quota", "QuotaExceededError");
    return add.apply(this, args);
  };
  try {
    await assert.rejects(repo.importRoadmap(theme.id, source));
  } finally {
    IDBObjectStore.prototype.add = add;
  }
  assert.deepEqual(await repo.listItems(theme.id), [item]);
  assert.deepEqual(await repo.getRoadmapDraft(theme.id), draft);
  const del = IDBObjectStore.prototype.delete;
  IDBObjectStore.prototype.delete = function (
    ...args: Parameters<IDBObjectStore["delete"]>
  ) {
    if (this.name === "roadmap-drafts")
      throw new DOMException("Quota", "QuotaExceededError");
    return del.apply(this, args);
  };
  try {
    await assert.rejects(repo.importRoadmap(theme.id, source));
  } finally {
    IDBObjectStore.prototype.delete = del;
  }
  assert.deepEqual(await repo.listItems(theme.id), [item]);
  assert.deepEqual(await repo.getRoadmapDraft(theme.id), draft);
  await repo.importRoadmap(theme.id, source);
  await repo.close();
  assert.equal(await repo.getRoadmapDraft(theme.id), undefined);
  assert.deepEqual(await repo.getRoadmapDraft(other.id), otherDraft);
  assert.deepEqual(
    (await repo.listItems(theme.id)).map((i) => i.title),
    ["残す項目", "新規A", "新規B"],
  );
});

async function learningSetup() {
  const { repo, input, subject } = await setup();
  const theme = await repo.createTheme(input);
  const item = await repo.createItem(theme.id, "原因", "原因を説明できる");
  return {
    repo,
    theme,
    item,
    subject,
    themeTarget: { type: "theme" as const, id: theme.id },
    itemTarget: { type: "item" as const, id: item.id },
  };
}
test("output drafts survive reopening per target and every save adds an independently rated timestamped record", async () => {
  const { repo, theme, themeTarget, itemTarget } = await learningSetup();
  const themeDraft = {
    ...initialLearningDraft(theme.id, themeTarget, "output"),
    note: "記憶からの説明\n".repeat(2000),
    outputRating: 4 as const,
  };
  const itemDraft = {
    ...initialLearningDraft(theme.id, itemTarget, "output"),
    note: "項目の説明",
  };
  const deepenDraft = initialLearningDraft(theme.id, itemTarget, "deepen");
  await repo.saveLearningDraft(themeDraft);
  await repo.saveLearningDraft(itemDraft);
  await repo.saveLearningDraft(deepenDraft);
  await repo.close();
  assert.deepEqual(await repo.getLearningDraft(themeDraft.key), themeDraft);
  const first = await repo.saveLearningRecord(themeDraft);
  assert.equal(first.outputRating, 4);
  assert.equal(first.note, themeDraft.note.trim());
  assert.equal(first.createdAt, first.studiedAt);
  assert.equal(first.updatedAt, first.createdAt);
  assert.equal(await repo.getLearningDraft(themeDraft.key), undefined);
  assert.deepEqual(await repo.getLearningDraft(itemDraft.key), itemDraft);
  const second = await repo.saveLearningRecord(itemDraft);
  assert.equal(second.outputRating, undefined);
  assert.equal(second.targetId, itemTarget.id);
  assert.notEqual(first.id, second.id);
  for (const level of [1, 2, 3, 4] as const) {
    const record = await repo.saveLearningRecord({
      ...itemDraft,
      outputRating: level,
    });
    assert.equal(record.outputRating, level);
  }
  assert.equal((await repo.listRecords()).length, 6);
  assert.deepEqual(await repo.listMasteryHistory(), []);
  assert.deepEqual(await repo.getLearningDraft(deepenDraft.key), deepenDraft);
});
test("deepening partial drafts resume, edits retain the original date and output ratings never update mastery", async () => {
  const { repo, theme, itemTarget } = await learningSetup();
  const partial = {
    ...initialLearningDraft(theme.id, itemTarget, "deepen"),
    questionKind: "whatif" as const,
    question: "もし条件が違ったら？",
  };
  await repo.saveLearningDraft(partial);
  await repo.close();
  assert.deepEqual(await repo.getLearningDraft(partial.key), partial);
  await assert.rejects(
    repo.saveLearningRecord({ ...partial, question: "" }),
    /問い/,
  );
  const first = await repo.saveLearningRecord({
    ...partial,
    hypothesis: "旧下書きの仮説",
    insight: "旧下書きの気づき",
  });
  const edit = {
    ...initialLearningDraft(theme.id, itemTarget, "deepen", first),
    question: "もし別の条件が揃ったら？",
  };
  await repo.saveLearningDraft(edit);
  const updated = await repo.saveLearningRecord(edit);
  assert.equal(updated.id, first.id);
  assert.equal(updated.createdAt, first.createdAt);
  assert.equal(updated.studiedAt, first.studiedAt);
  assert.ok(updated.updatedAt! > first.updatedAt!);
  assert.equal(updated.question, edit.question);
  assert.equal(updated.note, edit.question);
  assert.equal(updated.hypothesis, "旧下書きの仮説");
  assert.equal(updated.insight, "旧下書きの気づき");
  const another = await repo.saveLearningRecord({
    ...partial,
    question: "別の問い？",
  });
  assert.notEqual(another.id, first.id);
  assert.equal(another.hypothesis, "");
  assert.equal(another.insight, "");
  assert.equal(updated.outputRating, undefined);
  assert.equal(await repo.getLearningDraft(edit.key), undefined);
  assert.equal((await repo.listRecords()).length, 2);
  assert.deepEqual(await repo.listMasteryHistory(), []);
});
test("failed learning save rolls back record, theme timestamp and draft removal together", async () => {
  const { repo, theme, themeTarget } = await learningSetup();
  const draft = {
    ...initialLearningDraft(theme.id, themeTarget, "output"),
    note: "保存に失敗しても残す",
  };
  await repo.saveLearningDraft(draft);
  const del = IDBObjectStore.prototype.delete;
  IDBObjectStore.prototype.delete = function (
    ...args: Parameters<IDBObjectStore["delete"]>
  ) {
    if (this.name === "learning-drafts")
      throw new DOMException("Quota", "QuotaExceededError");
    return del.apply(this, args);
  };
  try {
    await assert.rejects(repo.saveLearningRecord(draft));
  } finally {
    IDBObjectStore.prototype.delete = del;
  }
  assert.deepEqual(await repo.listRecords(), []);
  assert.deepEqual(await repo.getTheme(theme.id), theme);
  assert.deepEqual(await repo.getLearningDraft(draft.key), draft);
  await repo.saveLearningRecord(draft);
  assert.equal((await repo.listRecords()).length, 1);
});
test("foreign targets, oversized inputs, stale edits and deleted parents never overwrite a learning record", async () => {
  const { repo, theme, itemTarget, themeTarget } = await learningSetup();
  const draft = {
    ...initialLearningDraft(theme.id, itemTarget, "output"),
    note: "原文",
  };
  assert.throws(() =>
    validateLearningInput({ ...draft, note: "a".repeat(30001) }),
  );
  await assert.rejects(
    repo.saveLearningDraft({ ...draft, themeId: "missing" }),
  );
  const wrong = {
    ...initialLearningDraft(
      theme.id,
      { type: "theme" as const, id: "foreign" },
      "output",
    ),
    note: "誤った対象",
  };
  await assert.rejects(repo.saveLearningRecord(wrong), /対象/);
  const first = await repo.saveLearningRecord(draft);
  const edit = initialLearningDraft(theme.id, itemTarget, "output", first);
  await repo.saveLearningRecord({ ...edit, note: "新しい原文" });
  await assert.rejects(
    repo.saveLearningRecord({ ...edit, note: "古い編集内容" }),
    /更新/,
  );
  assert.equal((await repo.listRecords())[0].note, "新しい原文");
  await repo.deleteItem(itemTarget.id);
  await assert.rejects(repo.saveLearningDraft(draft));
  const legacy = await repo.addRecord(theme.id, "旧評価を保持", {
    target: themeTarget,
    activity: "output",
    completion: 60,
  });
  const changed = await repo.saveLearningRecord({
    ...initialLearningDraft(theme.id, themeTarget, "output", legacy),
    note: "明示的な編集",
    outputRating: 2,
  });
  assert.equal(changed.completion, 60);
  assert.equal(changed.outputRating, 2);
});
test("both feedback prompts produce the exact versioned schema and reject malformed, cross-target and assessment data", async () => {
  const { repo, theme, item, itemTarget } = await learningSetup();
  for (const activity of ["output", "deepen"] as const) {
    const record = await repo.saveLearningRecord({
      ...initialLearningDraft(theme.id, itemTarget, activity),
      note: "自分で説明",
      question: "なぜ？",
    });
    const prompt = buildFeedbackPrompt(record, theme, "世界史", item);
    const document = parseFeedbackJSON(prompt.split("\n\n").at(-1)!);
    assert.deepEqual(document, feedbackExample(record));
    assertFeedbackContext(document, record);
    assert.match(prompt, /不確実/);
    assert.match(prompt, /1〜3/);
    if (activity === "deepen") {
      assert.equal(document.version, 3);
      assert.match(prompt, /簡潔な定義/);
      assert.match(prompt, /自分の問い/);
      assert.deepEqual(
        parseFeedbackJSON(JSON.stringify(feedbackExample(record, 1))),
        feedbackExample(record, 1),
      );
      assert.deepEqual(
        parseFeedbackJSON(JSON.stringify(feedbackExample(record, 2))),
        feedbackExample(record, 2),
      );
      assert.throws(
        () =>
          parseFeedbackJSON(JSON.stringify({ ...document, explanation: "" })),
        /explanation/,
      );
    }
    for (const source of [
      "{",
      "```json\n{}\n```",
      JSON.stringify({ ...document, version: 4 }),
      JSON.stringify({ ...document, questions: [] }),
      JSON.stringify({ ...document, questions: ["a", "b", "c", "d"] }),
      JSON.stringify({ ...document, uncertainty: undefined }),
      JSON.stringify({ ...document, outputRating: 4 }),
      JSON.stringify({ ...document, mastery: 4 }),
    ])
      assert.throws(() => parseFeedbackJSON(source));
    assert.throws(
      () => assertFeedbackContext({ ...document, targetId: "foreign" }, record),
      /対象/,
    );
    assert.throws(
      () => assertFeedbackContext({ ...document, revision: "old" }, record),
      /変更/,
    );
  }
});
test("AI feedback keeps its original snapshot, remains separate from insight and ratings, and rejects a stale revision", async () => {
  const { repo, theme, itemTarget } = await learningSetup();
  await repo.setMastery(theme.id, itemTarget, 2);
  const record = await repo.saveLearningRecord({
    ...initialLearningDraft(theme.id, itemTarget, "deepen"),
    question: "なぜ税負担が問題？",
    hypothesis: "自分の仮説",
    insight: "自分の気づき",
  });
  const prompt = buildFeedbackPrompt(record, theme, "世界史");
  const draft = {
    ...initialFeedbackDraft(record, prompt),
    active: true,
    step: "json" as const,
    source: "{ unfinished",
  };
  await repo.saveFeedbackDraft(draft);
  await repo.close();
  assert.deepEqual(await repo.getFeedbackDraft(record.id), draft);
  const before = await repo.listRecords();
  const history = await repo.listMasteryHistory();
  const feedback = await repo.importFeedback(
    record.id,
    JSON.stringify(feedbackExample(record)),
  );
  assert.deepEqual(await repo.listRecords(), before);
  assert.deepEqual(await repo.listMasteryHistory(), history);
  assert.deepEqual(feedback.snapshot, recordSnapshot(record));
  assert.equal(await repo.getFeedbackDraft(record.id), undefined);
  const edited = await repo.saveLearningRecord({
    ...initialLearningDraft(theme.id, itemTarget, "deepen", record),
    question: "別の問い？",
  });
  await assert.rejects(
    repo.importFeedback(record.id, JSON.stringify(feedbackExample(record))),
    /変更/,
  );
  assert.equal(
    (await repo.listFeedbacks())[0].snapshot.insight,
    "自分の気づき",
  );
  assert.equal(edited.insight, "自分の気づき");
  assert.equal(edited.question, "別の問い？");
  const output = await repo.saveLearningRecord({
    ...initialLearningDraft(theme.id, itemTarget, "output"),
    note: "本文",
    outputRating: 3,
  });
  await repo.importFeedback(output.id, JSON.stringify(feedbackExample(output)));
  assert.equal(
    (await repo.listTargetRecords(itemTarget)).find(
      (record) => record.id === output.id,
    )?.outputRating,
    3,
  );
});
test("feedback registration and draft removal are atomic even when draft deletion fails", async () => {
  const { repo, theme, themeTarget } = await learningSetup();
  const record = await repo.saveLearningRecord({
    ...initialLearningDraft(theme.id, themeTarget, "output"),
    note: "本文",
  });
  const source = JSON.stringify(feedbackExample(record));
  const draft = {
    ...initialFeedbackDraft(
      record,
      buildFeedbackPrompt(record, theme, "世界史"),
    ),
    source,
    step: "preview" as const,
    active: true,
  };
  await repo.saveFeedbackDraft(draft);
  const del = IDBObjectStore.prototype.delete;
  IDBObjectStore.prototype.delete = function (
    ...args: Parameters<IDBObjectStore["delete"]>
  ) {
    if (this.name === "feedback-drafts")
      throw new DOMException("Quota", "QuotaExceededError");
    return del.apply(this, args);
  };
  try {
    await assert.rejects(repo.importFeedback(record.id, source));
  } finally {
    IDBObjectStore.prototype.delete = del;
  }
  assert.deepEqual(await repo.listFeedbacks(), []);
  assert.deepEqual(await repo.getFeedbackDraft(record.id), draft);
  assert.deepEqual((await repo.listRecords())[0], record);
  await repo.importFeedback(record.id, source);
  assert.equal((await repo.listFeedbacks()).length, 1);
  assert.equal(await repo.getFeedbackDraft(record.id), undefined);
});
test("record, item and theme deletion remove only their linked learning drafts and feedback", async () => {
  const { repo, theme, themeTarget, itemTarget } = await learningSetup();
  const itemDraft = {
    ...initialLearningDraft(theme.id, itemTarget, "output"),
    note: "項目",
  };
  const themeDraft = {
    ...initialLearningDraft(theme.id, themeTarget, "output"),
    note: "テーマ",
  };
  const a = await repo.saveLearningRecord(itemDraft);
  const b = await repo.saveLearningRecord(themeDraft);
  await repo.importFeedback(a.id, JSON.stringify(feedbackExample(a)));
  await repo.importFeedback(b.id, JSON.stringify(feedbackExample(b)));
  await repo.saveLearningDraft(itemDraft);
  await repo.saveLearningDraft(themeDraft);
  await repo.saveFeedbackDraft(
    initialFeedbackDraft(a, buildFeedbackPrompt(a, theme, "世界史")),
  );
  await repo.deleteRecord(a.id);
  assert.equal((await repo.listFeedbacks()).length, 1);
  assert.equal(await repo.getFeedbackDraft(a.id), undefined);
  assert.deepEqual(await repo.getLearningDraft(itemDraft.key), itemDraft);
  const again = await repo.saveLearningRecord(itemDraft);
  await repo.saveLearningDraft(itemDraft);
  await repo.importFeedback(again.id, JSON.stringify(feedbackExample(again)));
  await repo.deleteItem(itemTarget.id);
  assert.equal((await repo.listRecords()).length, 1);
  assert.equal((await repo.listFeedbacks()).length, 1);
  assert.equal(await repo.getLearningDraft(itemDraft.key), undefined);
  assert.deepEqual(await repo.getLearningDraft(themeDraft.key), themeDraft);
  await repo.deleteTheme(theme.id);
  assert.deepEqual(await repo.listFeedbacks(), []);
  assert.equal(await repo.getLearningDraft(themeDraft.key), undefined);
});
async function seedV5(name: string) {
  const { old } = await seedV4(name);
  const db = await openDB(name, 5, {
    upgrade(db) {
      db.createObjectStore("roadmap-drafts", { keyPath: "themeId" });
    },
  });
  await db.put("roadmap-drafts", {
    ...newRoadmapDraft(old.theme),
    active: true,
    step: "json",
    source: "{ partial roadmap",
  });
  const rows: Record<string, unknown[]> = {};
  for (const store of Array.from(db.objectStoreNames))
    rows[store] = await db.getAll(store);
  db.close();
  return { old, rows };
}
test("v5 to v6 preserves every existing row including in-progress roadmap drafts and adds only empty learning stores", async () => {
  const name = crypto.randomUUID();
  const { rows } = await seedV5(name);
  const repo = repository(name);
  await repo.listRecords();
  await repo.close();
  const db = await openDB(name);
  assert.equal(db.version, 6);
  assert.equal(db.objectStoreNames.length, 12);
  for (const [store, values] of Object.entries(rows))
    assert.deepEqual(await db.getAll(store), values);
  for (const store of [
    "learning-drafts",
    "learning-feedback",
    "feedback-drafts",
  ])
    assert.deepEqual(await db.getAll(store), []);
  db.close();
});
test("a failed v6 upgrade restores v5 and all its originals, then retries without duplicate learning data", async () => {
  const name = crypto.randomUUID();
  const { rows } = await seedV5(name);
  const create = IDBDatabase.prototype.createObjectStore;
  IDBDatabase.prototype.createObjectStore = function (
    ...args: Parameters<IDBDatabase["createObjectStore"]>
  ) {
    if (args[0] === "learning-feedback")
      throw new DOMException("Quota", "QuotaExceededError");
    return create.apply(this, args);
  };
  const repo = repository(name);
  try {
    await assert.rejects(repo.listRecords());
  } finally {
    IDBDatabase.prototype.createObjectStore = create;
  }
  const db = await openDB(name);
  assert.equal(db.version, 5);
  for (const [store, values] of Object.entries(rows))
    assert.deepEqual(await db.getAll(store), values);
  assert.equal(db.objectStoreNames.contains("learning-drafts"), false);
  db.close();
  assert.deepEqual(await repo.listFeedbacks(), []);
  assert.ok((await repo.listRecords()).length);
});

test("output titles persist with drafts and edits, while earlier sessions keep their own ratings", async () => {
  const { repo, theme, item, itemTarget, themeTarget } = await learningSetup();
  const draft = {
    ...initialLearningDraft(theme.id, itemTarget, "output"),
    title: "因果関係を説明する",
    note: "一回目",
    outputRating: 1 as const,
  };
  await repo.saveLearningDraft(draft);
  await repo.close();
  assert.deepEqual(await repo.getLearningDraft(draft.key), draft);
  const first = await repo.saveLearningRecord(draft);
  const second = await repo.saveLearningRecord({
    ...draft,
    title: "復習して説明",
    note: "二回目",
    outputRating: 4,
  });
  const edited = await repo.saveLearningRecord({
    ...initialLearningDraft(theme.id, itemTarget, "output", second),
    title: "復習後の説明",
    note: "編集した二回目",
  });
  assert.equal(edited.title, "復習後の説明");
  assert.equal(
    (await repo.listRecords()).find((record) => record.id === first.id)
      ?.outputRating,
    1,
  );
  assert.equal(edited.outputRating, 4);
  const defaultItem = await repo.saveLearningRecord({
    ...initialLearningDraft(theme.id, itemTarget, "output"),
    note: "タイトル未設定",
  });
  const defaultTheme = await repo.saveLearningRecord({
    ...initialLearningDraft(theme.id, themeTarget, "output"),
    note: "テーマ全体",
  });
  assert.equal(defaultItem.title, item.title);
  assert.equal(defaultTheme.title, theme.name);
  await assert.rejects(
    repo.saveLearningDraft({ ...draft, title: "a".repeat(161) }),
    /タイトル/,
  );
  assert.deepEqual(await repo.listMasteryHistory(), []);
});
test("optional reflections resume and can be edited or cleared without losing old fields on minimal legacy edits", async () => {
  const { repo, theme, itemTarget } = await learningSetup();
  const draft = {
    ...initialLearningDraft(theme.id, itemTarget, "deepen"),
    question: "需要と供給とは？",
    hypothesis: "自分なりの説明",
    unknowns: "価格が動く条件",
    insight: "曲線の違いに気づいた",
  };
  await repo.saveLearningDraft(draft);
  await repo.close();
  assert.deepEqual(await repo.getLearningDraft(draft.key), draft);
  const first = await repo.saveLearningRecord(draft);
  const minimal = {
    ...initialLearningDraft(theme.id, itemTarget, "deepen", first),
    question: "需要だけが変化したら？",
  };
  delete minimal.hypothesis;
  delete minimal.unknowns;
  delete minimal.insight;
  const legacyEdited = await repo.saveLearningRecord(minimal);
  assert.equal(legacyEdited.hypothesis, draft.hypothesis);
  assert.equal(legacyEdited.unknowns, draft.unknowns);
  assert.equal(legacyEdited.insight, draft.insight);
  const cleared = await repo.saveLearningRecord({
    ...initialLearningDraft(theme.id, itemTarget, "deepen", legacyEdited),
    hypothesis: "",
    unknowns: "",
    insight: "",
  });
  assert.equal(cleared.hypothesis, "");
  assert.equal(cleared.unknowns, "");
  assert.equal(cleared.insight, "");
  await assert.rejects(
    repo.saveLearningDraft({ ...draft, unknowns: "a".repeat(15001) }),
    /不明点/,
  );
  assert.equal(cleared.createdAt, first.createdAt);
});
test("deepening v3 follows the question and preserves legacy reflections and versioned feedback separately", async () => {
  const { repo, theme, itemTarget } = await learningSetup();
  const record = await repo.saveLearningRecord({
    ...initialLearningDraft(theme.id, itemTarget, "deepen"),
    question: "需要とは？",
    hypothesis: "買いたい量",
    unknowns: "所得との関係",
    insight: "価格の条件がある",
  });
  const prompt = buildFeedbackPrompt(record, theme, "経済学");
  for (const text of [
    "需要とは？",
    "反例",
    "別の視点",
    "簡潔な定義",
    "似た概念との違い",
  ])
    assert.ok(prompt.includes(text));
  assert.ok(!prompt.includes("買いたい量"));
  const document = parseFeedbackJSON(prompt.split("\n\n").at(-1)!);
  assert.equal(document.version, 3);
  for (const field of [
    "hints",
    "features",
    "counterexamples",
    "perspectives",
    "examples",
    "comparisons",
  ])
    assert.throws(() =>
      parseFeedbackJSON(JSON.stringify({ ...document, [field]: undefined })),
    );
  for (const version of [1, 2, 3])
    await repo.importFeedback(
      record.id,
      JSON.stringify(feedbackExample(record, version)),
    );
  assert.equal((await repo.listFeedbacks()).length, 3);
  assert.deepEqual((await repo.listRecords())[0], record);
});
