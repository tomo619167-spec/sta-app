import "fake-indexeddb/auto";
import type { FourLevel } from "../lib/model";
import { inferSubjectIcon, type SubjectIconKey } from "../lib/subject-icons";
import { latestMastery, latestOutput, masteryCounts } from "../lib/ratings";
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
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
  await tx
    .objectStore("records")
    .put({
      ...old.record,
      activity: "output",
      targetType: "theme",
      targetId: old.theme.id,
      completion: 0,
    });
  await tx
    .objectStore("records")
    .add({
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
test("v3 to v4 preserves every existing store byte-equivalently and never converts old percentages or mastery", async () => {
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
  assert.equal(db.version, 4);
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
