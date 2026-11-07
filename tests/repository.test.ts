import "fake-indexeddb/auto";
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { openDB } from "idb";
import { IndexedDBStudyRepository } from "../lib/storage/indexed-db";
import { progress, type LegacyTheme } from "../lib/model";
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
  assert.deepEqual(await repo.listRecords(), [record]);
  assert.deepEqual(progress(await repo.listItems("theme-a")), {
    total: 2,
    completed: 1,
    percent: 50,
  });
  await repo.close();
  const db = await openDB(name, 2);
  for (const original of others)
    assert.deepEqual(await db.get("legacy-themes-v1", original.id), original);
  db.close();
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
