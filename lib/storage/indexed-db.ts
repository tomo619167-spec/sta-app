import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import {
  validateTheme,
  type StudyRecord,
  type Theme,
  type ThemeInput,
} from "../model";
import type { StudyRepository } from "./repository";
interface StudyDB extends DBSchema {
  themes: { key: string; value: Theme };
  records: { key: string; value: StudyRecord; indexes: { "by-theme": string } };
}
async function abortTransaction(tx: { abort(): void; done: Promise<unknown> }) {
  try {
    tx.abort();
  } catch {
    /* It may already have aborted. */
  }
  await tx.done.catch(() => {});
}
/** Only this adapter knows IndexedDB; schema changes must increment the version. */
export class IndexedDBStudyRepository implements StudyRepository {
  private connection?: Promise<IDBPDatabase<StudyDB>>;
  constructor(private readonly name = "yohaku-study") {}
  private db() {
    if (!this.connection) {
      this.connection = openDB<StudyDB>(this.name, 1, {
        upgrade(db) {
          db.createObjectStore("themes", { keyPath: "id" });
          db.createObjectStore("records", { keyPath: "id" }).createIndex(
            "by-theme",
            "themeId",
          );
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
    }
    return this.connection;
  }
  async listThemes() {
    const themes = await (await this.db()).getAll("themes");
    return themes.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async getTheme(id: string) {
    return (await this.db()).get("themes", id);
  }
  async createTheme(input: ThemeInput) {
    const validated = validateTheme(input);
    const now = new Date().toISOString();
    const theme: Theme = {
      ...validated,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      lastStudiedAt: null,
      roadmap: [],
    };
    await (await this.db()).add("themes", theme);
    return theme;
  }
  async updateTheme(id: string, input: ThemeInput) {
    const validated = validateTheme(input);
    const tx = (await this.db()).transaction("themes", "readwrite");
    try {
      const existing = await tx.store.get(id);
      if (!existing)
        throw new Error("テーマが見つかりません。削除された可能性があります。");
      const theme = {
        ...existing,
        ...validated,
        updatedAt: new Date().toISOString(),
      };
      await tx.store.put(theme);
      await tx.done;
      return theme;
    } catch (error) {
      await abortTransaction(tx);
      throw error;
    }
  }
  async deleteTheme(id: string) {
    const tx = (await this.db()).transaction(
      ["themes", "records"],
      "readwrite",
    );
    try {
      const keys = await tx
        .objectStore("records")
        .index("by-theme")
        .getAllKeys(id);
      await Promise.all(
        keys.map((key) => tx.objectStore("records").delete(key)),
      );
      await tx.objectStore("themes").delete(id);
      await tx.done;
    } catch (error) {
      await abortTransaction(tx);
      throw error;
    }
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
      if (!theme)
        throw new Error("テーマが見つかりません。削除された可能性があります。");
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
