import "fake-indexeddb/auto";
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { IndexedDBStudyRepository } from "../lib/storage/indexed-db";
import { progress } from "../lib/model";
const connections: IndexedDBStudyRepository[] = [];
function repository(name = crypto.randomUUID()) {
  const repo = new IndexedDBStudyRepository(name);
  connections.push(repo);
  return repo;
}
afterEach(async () => {
  await Promise.all(connections.splice(0).map((repo) => repo.close()));
});
const input = {
  name: " フランス革命 ",
  subject: "世界史",
  description: "背景と影響を整理する",
};
test("theme CRUD persists across fresh repository connections", async () => {
  const dbName = crypto.randomUUID();
  const first = repository(dbName);
  const created = await first.createTheme(input);
  assert.equal(created.name, "フランス革命");
  await first.close();
  const reopened = repository(dbName);
  assert.equal(
    (await reopened.getTheme(created.id))?.description,
    input.description,
  );
  const updated = await reopened.updateTheme(created.id, {
    ...input,
    name: "フランス革命と近代社会",
  });
  assert.equal(updated.name, "フランス革命と近代社会");
  assert.equal(updated.createdAt, created.createdAt);
  await reopened.deleteTheme(created.id);
  assert.deepEqual(await reopened.listThemes(), []);
});
test("records update recent study timestamp and cascade deletion only affects their own theme", async () => {
  const repo = repository();
  const first = await repo.createTheme(input);
  const other = await repo.createTheme({ ...input, name: "三角関数" });
  const record = await repo.addRecord(first.id, "  三部会について整理した  ");
  await repo.addRecord(other.id, "加法定理を学んだ");
  assert.equal(record.note, "三部会について整理した");
  assert.equal(
    (await repo.getTheme(first.id))?.lastStudiedAt,
    record.studiedAt,
  );
  assert.equal((await repo.getTheme(other.id))?.roadmap.length, 0);
  assert.equal((await repo.listRecords(first.id)).length, 1);
  await repo.deleteTheme(first.id);
  assert.equal((await repo.listRecords()).length, 1);
  assert.equal((await repo.listRecords())[0].themeId, other.id);
});
test("invalid and whitespace-only inputs never persist", async () => {
  const repo = repository();
  await assert.rejects(repo.createTheme({ ...input, name: "   " }));
  await assert.rejects(repo.createTheme({ ...input, subject: "  " }));
  await assert.rejects(repo.createTheme({ ...input, name: "a".repeat(81) }));
  await assert.rejects(
    repo.createTheme({ ...input, description: "a".repeat(1001) }),
  );
  assert.deepEqual(await repo.listThemes(), []);
  const theme = await repo.createTheme(input);
  await assert.rejects(repo.addRecord(theme.id, "  "));
  await assert.rejects(repo.addRecord(theme.id, "a".repeat(1001)));
  assert.deepEqual(await repo.listRecords(), []);
  assert.equal((await repo.getTheme(theme.id))?.lastStudiedAt, null);
});
test("deleted themes cannot be recreated by stale edits or records", async () => {
  const repo = repository();
  const theme = await repo.createTheme(input);
  await repo.deleteTheme(theme.id);
  await assert.rejects(repo.updateTheme(theme.id, input));
  await assert.rejects(repo.addRecord(theme.id, "古いタブからの記録"));
  assert.deepEqual(await repo.listThemes(), []);
  assert.deepEqual(await repo.listRecords(), []);
});
test("progress derives from roadmap items and an empty roadmap is 0 percent", async () => {
  const theme = await repository().createTheme(input);
  assert.deepEqual(progress(theme), { total: 0, completed: 0, percent: 0 });
  assert.deepEqual(
    progress({
      ...theme,
      roadmap: [
        { id: "1", title: "背景", completed: true },
        { id: "2", title: "影響", completed: false },
      ],
    }),
    { total: 2, completed: 1, percent: 50 },
  );
});
test("a failed theme timestamp write rolls back its study record atomically", async () => {
  const repo = repository();
  const theme = await repo.createTheme(input);
  const originalPut = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function (
    ...args: Parameters<IDBObjectStore["put"]>
  ) {
    if (this.name === "themes")
      throw new DOMException("Test quota failure", "QuotaExceededError");
    return originalPut.apply(this, args);
  };
  try {
    await assert.rejects(repo.addRecord(theme.id, "保存失敗テスト"), {
      name: "QuotaExceededError",
    });
  } finally {
    IDBObjectStore.prototype.put = originalPut;
  }
  assert.deepEqual(await repo.listRecords(), []);
  assert.equal((await repo.getTheme(theme.id))?.lastStudiedAt, null);
});
