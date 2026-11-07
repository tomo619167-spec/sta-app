import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import {
  normalizeSubject,
  validateSubject,
  validateTheme,
  validateItem,
  type LegacyTheme,
  type Subject,
  type StudyItem,
  type StudyRecord,
  type Theme,
  type ThemeInput,
} from "../model";
import type { StudyRepository } from "./repository";
interface StudyDB extends DBSchema {
  subjects: { key: string; value: Subject; indexes: { "by-name": string } };
  themes: { key: string; value: Theme; indexes: { "by-subject": string } };
  items: { key: string; value: StudyItem; indexes: { "by-theme": string } };
  records: { key: string; value: StudyRecord; indexes: { "by-theme": string } };
  "legacy-themes-v1": { key: string; value: LegacyTheme };
}
async function abortTransaction(tx: { abort(): void; done: Promise<unknown> }) {
  try {
    tx.abort();
  } catch {
    /* already completed or aborted */
  }
  await tx.done.catch(() => {});
}
export class IndexedDBStudyRepository implements StudyRepository {
  private connection?: Promise<IDBPDatabase<StudyDB>>;
  constructor(private readonly name = "yohaku-study") {}
  private db() {
    if (!this.connection)
      this.connection = openDB<StudyDB>(this.name, 2, {
        upgrade(db, oldVersion, _newVersion, tx) {
          // The open request reports upgrade failures; also consume tx.done.
          void tx.done.catch(() => {});
          if (oldVersion < 1) {
            db.createObjectStore("themes", { keyPath: "id" });
            db.createObjectStore("records", { keyPath: "id" }).createIndex(
              "by-theme",
              "themeId",
            );
          }
          if (oldVersion < 2) {
            db.createObjectStore("subjects", { keyPath: "id" }).createIndex(
              "by-name",
              "normalizedName",
              { unique: true },
            );
            db.createObjectStore("items", { keyPath: "id" }).createIndex(
              "by-theme",
              "themeId",
            );
            db.createObjectStore("legacy-themes-v1", { keyPath: "id" });
            tx.objectStore("themes").createIndex("by-subject", "subjectId");
            // No network/other async work inside this versionchange transaction.
            // A failed request aborts the entire upgrade, retaining the v1 database.
            void (async () => {
              const subjects = new Map<string, Subject>();
              let cursor = await tx.objectStore("themes").openCursor();
              while (cursor) {
                const original = cursor.value as LegacyTheme;
                await tx.objectStore("legacy-themes-v1").add(original);
                const displayName = original.subject?.trim() || "未分類";
                const normalizedName = normalizeSubject(displayName);
                let subject = subjects.get(normalizedName);
                if (!subject) {
                  subject = {
                    id: crypto.randomUUID(),
                    name: displayName,
                    normalizedName,
                    createdAt: original.createdAt,
                    updatedAt: original.updatedAt,
                  };
                  subjects.set(normalizedName, subject);
                  await tx.objectStore("subjects").add(subject);
                }
                await cursor.update({ ...original, subjectId: subject.id });
                for (const [index, item] of (
                  original.roadmap ?? []
                ).entries()) {
                  await tx.objectStore("items").add({
                    ...item,
                    id: `v1:${original.id}:${index}:${item.id}`,
                    themeId: original.id,
                    position: index,
                    createdAt: original.createdAt,
                    updatedAt: original.updatedAt,
                  });
                }
                cursor = await cursor.continue();
              }
            })().catch(() => {
              try {
                tx.abort();
              } catch {
                /* request already aborted */
              }
            });
          }
        },
        blocked: () => {
          if (typeof window !== "undefined")
            window.dispatchEvent(new Event("study-storage-blocked"));
        },
        blocking: () => {
          void this.connection?.then((db) => db.close());
          this.connection = undefined;
        },
        terminated: () => {
          this.connection = undefined;
        },
      }).catch((error) => {
        this.connection = undefined;
        throw error;
      });
    return this.connection;
  }
  async listSubjects() {
    return (await (await this.db()).getAll("subjects")).sort(
      (a, b) =>
        a.createdAt.localeCompare(b.createdAt) ||
        a.name.localeCompare(b.name, "ja"),
    );
  }
  async createSubject(name: string) {
    const value = validateSubject(name);
    const now = new Date().toISOString();
    const subject = {
      ...value,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    try {
      await (await this.db()).add("subjects", subject);
    } catch (error) {
      if ((error as DOMException).name === "ConstraintError")
        throw new Error("同じ名前の科目があります。");
      throw error;
    }
    return subject;
  }
  async renameSubject(id: string, name: string) {
    const value = validateSubject(name);
    const tx = (await this.db()).transaction("subjects", "readwrite");
    try {
      const subject = await tx.store.get(id);
      if (!subject) throw new Error("科目が見つかりません。");
      const updated = {
        ...subject,
        ...value,
        updatedAt: new Date().toISOString(),
      };
      await tx.store.put(updated);
      await tx.done;
      return updated;
    } catch (error) {
      await abortTransaction(tx);
      if ((error as DOMException).name === "ConstraintError")
        throw new Error("同じ名前の科目があります。");
      throw error;
    }
  }
  async listThemes() {
    return (await (await this.db()).getAll("themes")).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }
  async getTheme(id: string) {
    return (await this.db()).get("themes", id);
  }
  async createTheme(input: ThemeInput) {
    const value = validateTheme(input);
    const tx = (await this.db()).transaction(
      ["subjects", "themes"],
      "readwrite",
    );
    try {
      const subject = await tx.objectStore("subjects").get(value.subjectId);
      if (!subject) throw new Error("科目を選び直してください。");
      const now = new Date().toISOString();
      const theme: Theme = {
        ...value,
        subject: subject.name,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        lastStudiedAt: null,
        roadmap: [],
      };
      await tx.objectStore("themes").add(theme);
      await tx.done;
      return theme;
    } catch (error) {
      await abortTransaction(tx);
      throw error;
    }
  }
  async updateTheme(id: string, input: ThemeInput) {
    const value = validateTheme(input);
    const tx = (await this.db()).transaction(
      ["subjects", "themes"],
      "readwrite",
    );
    try {
      if (!(await tx.objectStore("subjects").get(value.subjectId)))
        throw new Error("科目を選び直してください。");
      const theme = await tx.objectStore("themes").get(id);
      if (!theme) throw new Error("テーマが見つかりません。");
      const updated = {
        ...theme,
        ...value,
        updatedAt: new Date().toISOString(),
      };
      await tx.objectStore("themes").put(updated);
      await tx.done;
      return updated;
    } catch (error) {
      await abortTransaction(tx);
      throw error;
    }
  }
  async deleteTheme(id: string) {
    const tx = (await this.db()).transaction(
      ["themes", "items", "records", "legacy-themes-v1"],
      "readwrite",
    );
    try {
      for (const name of ["items", "records"] as const) {
        const keys = await tx
          .objectStore(name)
          .index("by-theme")
          .getAllKeys(id);
        for (const key of keys) await tx.objectStore(name).delete(key);
      }
      await tx.objectStore("themes").delete(id);
      await tx.objectStore("legacy-themes-v1").delete(id);
      await tx.done;
    } catch (error) {
      await abortTransaction(tx);
      throw error;
    }
  }
  async listItems(themeId?: string) {
    const db = await this.db();
    const items = themeId
      ? await db.getAllFromIndex("items", "by-theme", themeId)
      : await db.getAll("items");
    return items.sort(
      (a, b) =>
        a.position - b.position || a.createdAt.localeCompare(b.createdAt),
    );
  }
  async createItem(themeId: string, title: string) {
    const value = validateItem(title);
    const tx = (await this.db()).transaction(["themes", "items"], "readwrite");
    try {
      if (!(await tx.objectStore("themes").get(themeId)))
        throw new Error("テーマが見つかりません。");
      const items = await tx
        .objectStore("items")
        .index("by-theme")
        .getAll(themeId);
      const now = new Date().toISOString();
      const item: StudyItem = {
        id: crypto.randomUUID(),
        title: value,
        themeId,
        completed: false,
        position: Math.max(-1, ...items.map((item) => item.position)) + 1,
        createdAt: now,
        updatedAt: now,
      };
      await tx.objectStore("items").add(item);
      await tx.done;
      return item;
    } catch (error) {
      await abortTransaction(tx);
      throw error;
    }
  }
  async updateItem(id: string, input: { title: string; completed: boolean }) {
    const title = validateItem(input.title);
    const tx = (await this.db()).transaction("items", "readwrite");
    try {
      const item = await tx.store.get(id);
      if (!item) throw new Error("学習項目が見つかりません。");
      const updated = {
        ...item,
        title,
        completed: input.completed,
        updatedAt: new Date().toISOString(),
      };
      await tx.store.put(updated);
      await tx.done;
      return updated;
    } catch (error) {
      await abortTransaction(tx);
      throw error;
    }
  }
  async deleteItem(id: string) {
    await (await this.db()).delete("items", id);
  }
  async listRecords(themeId?: string) {
    const db = await this.db();
    const records = themeId
      ? await db.getAllFromIndex("records", "by-theme", themeId)
      : await db.getAll("records");
    return records.sort((a, b) => b.studiedAt.localeCompare(a.studiedAt));
  }
  async addRecord(themeId: string, note: string) {
    const text = note.trim();
    if (!text || text.length > 1000)
      throw new Error("学習内容は1〜1,000文字で入力してください。");
    const tx = (await this.db()).transaction(
      ["themes", "records"],
      "readwrite",
    );
    try {
      const theme = await tx.objectStore("themes").get(themeId);
      if (!theme) throw new Error("テーマが見つかりません。");
      const now = new Date().toISOString();
      const record = {
        id: crypto.randomUUID(),
        themeId,
        note: text,
        studiedAt: now,
      };
      await tx.objectStore("records").add(record);
      await tx
        .objectStore("themes")
        .put({ ...theme, lastStudiedAt: now, updatedAt: now });
      await tx.done;
      return record;
    } catch (error) {
      await abortTransaction(tx);
      throw error;
    }
  }
  async close() {
    if (this.connection) (await this.connection).close();
    this.connection = undefined;
  }
}
