import {
  validateLearningDraft,
  validateLearningInput,
  recordRevision,
  recordSnapshot,
  type LearningDraft,
} from "../learning";
import {
  parseFeedbackJSON,
  validateFeedbackDraft,
  validateDraftFeedback,
  assertFeedbackContext,
  type FeedbackDraft,
  type LearningFeedback,
} from "../learning-feedback";
import { validateRoadmapDraft, type RoadmapDraft } from "../roadmap-draft";
import {
  openDB,
  type DBSchema,
  type IDBPTransaction,
  type IDBPDatabase,
} from "idb";
import {
  normalizeSubject,
  type MasteryChange,
  type FourLevel,
  validateGoal,
  validateCompletion,
  type StudyTarget,
  type RecordOptions,
  type LegacyStudyRecord,
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
import {
  inferSubjectIcon,
  validateSubjectIcon,
  type SubjectIconKey,
  type SubjectIconSetting,
} from "../subject-icons";
import { validateFourLevel } from "../ratings";
import {
  parseRoadmapJSON,
  assertRoadmapContext,
  findRoadmapDuplicates,
} from "../roadmap-json";
import { sortStudyItems } from "../roadmap";
import type { StudyRepository } from "./repository";
interface StudyDB extends DBSchema {
  "learning-drafts": {
    key: string;
    value: LearningDraft;
    indexes: { "by-theme": string; "by-target": ["theme" | "item", string] };
  };
  "learning-feedback": {
    key: string;
    value: LearningFeedback;
    indexes: {
      "by-theme": string;
      "by-target": ["theme" | "item", string];
      "by-record": string;
    };
  };
  "feedback-drafts": {
    key: string;
    value: FeedbackDraft;
    indexes: { "by-theme": string; "by-target": ["theme" | "item", string] };
  };

  "roadmap-drafts": { key: string; value: RoadmapDraft };
  "subject-icons": { key: string; value: SubjectIconSetting };
  "mastery-history": {
    key: number;
    value: Omit<MasteryChange, "id">;
    indexes: { "by-theme": string; "by-target": ["theme" | "item", string] };
  };
  subjects: { key: string; value: Subject; indexes: { "by-name": string } };
  themes: { key: string; value: Theme; indexes: { "by-subject": string } };
  items: { key: string; value: StudyItem; indexes: { "by-theme": string } };
  records: {
    key: string;
    value: StudyRecord;
    indexes: { "by-theme": string; "by-target": ["theme" | "item", string] };
  };
  "legacy-records-v2": {
    key: string;
    value: LegacyStudyRecord;
    indexes: { "by-theme": string };
  };
  "legacy-themes-v1": { key: string; value: LegacyTheme };
}
const learningStores = [
  "themes",
  "items",
  "records",
  "learning-drafts",
  "learning-feedback",
  "feedback-drafts",
] as const;
type LearningTransaction = IDBPTransaction<
  StudyDB,
  typeof learningStores,
  "readwrite"
>;
async function learningTarget(
  tx: LearningTransaction,
  themeId: string,
  target: StudyTarget,
) {
  const theme = await tx.objectStore("themes").get(themeId);
  if (!theme) throw new Error("テーマが見つかりません。");
  if (
    !["theme", "item"].includes(target.type) ||
    (target.type === "theme" && target.id !== themeId)
  )
    throw new Error("学習対象が一致しません。");
  if (target.type === "item") {
    const item = await tx.objectStore("items").get(target.id);
    if (!item || item.themeId !== themeId)
      throw new Error("学習項目が見つからないか、別のテーマに属しています。");
  }
  return theme;
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
      this.connection = openDB<StudyDB>(this.name, 6, {
        upgrade(db, oldVersion, _newVersion, tx) {
          // The open request reports upgrade failures; also consume tx.done.
          void tx.done.catch(() => {});
          let migrateHierarchy: Promise<void> = Promise.resolve();
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
            migrateHierarchy = (async () => {
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
                    goal: "",
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
          if (oldVersion < 3) {
            const hierarchyReady = migrateHierarchy;
            const records = tx.objectStore("records");
            records.createIndex("by-target", ["targetType", "targetId"]);
            db.createObjectStore("legacy-records-v2", {
              keyPath: "id",
            }).createIndex("by-theme", "themeId");
            migrateHierarchy = (async () => {
              await hierarchyReady;
              let cursor = await records.openCursor();
              while (cursor) {
                const original = cursor.value;
                await tx.objectStore("legacy-records-v2").add(original);
                await cursor.update({
                  ...original,
                  targetType: original.targetType ?? "theme",
                  targetId: original.targetId ?? original.themeId,
                  activity: original.activity ?? "memo",
                });
                cursor = await cursor.continue();
              }
              let item = await tx.objectStore("items").openCursor();
              while (item) {
                await item.update({
                  ...item.value,
                  goal: item.value.goal ?? "",
                });
                item = await item.continue();
              }
            })().catch(() => {
              try {
                tx.abort();
              } catch {
                /* already aborted */
              }
            });
          }
          if (oldVersion < 6) {
            for (const [name, keyPath] of [
              ["learning-drafts", "key"],
              ["learning-feedback", "id"],
              ["feedback-drafts", "recordId"],
            ] as const) {
              const store = db.createObjectStore(name, { keyPath });
              store.createIndex("by-theme", "themeId");
              store.createIndex("by-target", ["targetType", "targetId"]);
            }
            tx.objectStore("learning-feedback").createIndex(
              "by-record",
              "recordId",
            );
          }
          if (oldVersion < 5) {
            // Additive only: all existing learning data remains untouched.
            db.createObjectStore("roadmap-drafts", { keyPath: "themeId" });
          }
          if (oldVersion < 4) {
            db.createObjectStore("subject-icons", { keyPath: "subjectId" });
            const history = db.createObjectStore("mastery-history", {
              autoIncrement: true,
            });
            history.createIndex("by-theme", "themeId");
            history.createIndex("by-target", ["targetType", "targetId"]);
            // Additive upgrade: existing subjects/items/themes/records are never rewritten.
            // Wait for the older hierarchy migrations when upgrading directly from v1/v2.
            void (async () => {
              await migrateHierarchy;
              let subject = await tx.objectStore("subjects").openCursor();
              while (subject) {
                const value = subject.value;
                if (!(await tx.objectStore("subject-icons").get(value.id))) {
                  await tx.objectStore("subject-icons").add({
                    subjectId: value.id,
                    icon: inferSubjectIcon(value.name),
                    source: "auto",
                    updatedAt: value.updatedAt,
                  });
                }
                subject = await subject.continue();
              }
            })().catch(() => {
              try {
                tx.abort();
              } catch {
                /* already aborted */
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
  async getRoadmapDraft(themeId: string) {
    const value = await (await this.db()).get("roadmap-drafts", themeId);
    return value ? validateRoadmapDraft(value) : undefined;
  }
  async saveRoadmapDraft(draft: RoadmapDraft) {
    const value = validateRoadmapDraft(draft);
    const tx = (await this.db()).transaction(
      ["themes", "roadmap-drafts"],
      "readwrite",
    );
    try {
      if (!(await tx.objectStore("themes").get(value.themeId)))
        throw new Error("テーマが見つかりません。");
      await tx.objectStore("roadmap-drafts").put(value);
      await tx.done;
    } catch (error) {
      await abortTransaction(tx);
      throw error;
    }
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
    const tx = (await this.db()).transaction(
      ["subjects", "subject-icons"],
      "readwrite",
    );
    try {
      await tx.objectStore("subjects").add(subject);
      await tx.objectStore("subject-icons").add({
        subjectId: subject.id,
        icon: inferSubjectIcon(subject.name),
        source: "auto",
        updatedAt: now,
      });
      await tx.done;
    } catch (error) {
      await abortTransaction(tx);
      if ((error as DOMException).name === "ConstraintError")
        throw new Error("同じ名前の科目があります。");
      throw error;
    }
    return subject;
  }
  async renameSubject(id: string, name: string) {
    const value = validateSubject(name);
    const tx = (await this.db()).transaction(
      ["subjects", "subject-icons"],
      "readwrite",
    );
    try {
      const subject = await tx.objectStore("subjects").get(id);
      if (!subject) throw new Error("科目が見つかりません。");
      const updated = {
        ...subject,
        ...value,
        updatedAt: new Date().toISOString(),
      };
      await tx.objectStore("subjects").put(updated);
      const setting = await tx.objectStore("subject-icons").get(id);
      if (!setting || setting.source === "auto") {
        await tx.objectStore("subject-icons").put({
          subjectId: id,
          icon: inferSubjectIcon(value.name),
          source: "auto",
          updatedAt: updated.updatedAt,
        });
      }
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
  async updateThemeGoal(id: string, goal: string) {
    const value = validateGoal(goal);
    const tx = (await this.db()).transaction("themes", "readwrite");
    try {
      const theme = await tx.store.get(id);
      if (!theme) throw new Error("テーマが見つかりません。");
      const updated = {
        ...theme,
        description: value,
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
  async moveItem(themeId: string, itemId: string, direction: "up" | "down") {
    if (direction !== "up" && direction !== "down")
      throw new Error("移動方向を確認してください。");
    const tx = (await this.db()).transaction(["themes", "items"], "readwrite");
    try {
      if (!(await tx.objectStore("themes").get(themeId)))
        throw new Error("テーマが見つかりません。");
      const items = sortStudyItems(
        await tx.objectStore("items").index("by-theme").getAll(themeId),
      );
      const index = items.findIndex((item) => item.id === itemId);
      if (index < 0)
        throw new Error("学習項目が見つからないか、別のテーマに属しています。");
      const next = index + (direction === "up" ? -1 : 1);
      if (next >= 0 && next < items.length) {
        [items[index], items[next]] = [items[next], items[index]];
        const now = new Date().toISOString();
        for (const [position, item] of items.entries())
          if (position !== item.position) {
            await tx
              .objectStore("items")
              .put({ ...item, position, updatedAt: now });
          }
      }
      await tx.done;
    } catch (error) {
      await abortTransaction(tx);
      throw error;
    }
  }
  async importRoadmap(
    themeId: string,
    source: string,
    allowDuplicates = false,
  ) {
    const document = parseRoadmapJSON(source);
    const tx = (await this.db()).transaction(
      ["themes", "subjects", "items", "roadmap-drafts"],
      "readwrite",
    );
    try {
      const theme = await tx.objectStore("themes").get(themeId);
      if (!theme) throw new Error("テーマが見つかりません。");
      const subject = await tx.objectStore("subjects").get(theme.subjectId);
      if (!subject) throw new Error("科目が見つかりません。");
      assertRoadmapContext(document, subject.name, theme.name);
      const existing = await tx
        .objectStore("items")
        .index("by-theme")
        .getAll(themeId);
      if (
        findRoadmapDuplicates(document.items, existing).length &&
        !allowDuplicates
      )
        throw new Error(
          "同じ名前の項目があります。プレビューで重複を確認してください。",
        );
      const start = Math.max(-1, ...existing.map((item) => item.position)) + 1;
      const now = new Date().toISOString();
      const added: StudyItem[] = [];
      for (const [index, item] of document.items.entries()) {
        const value: StudyItem = {
          ...item,
          id: crypto.randomUUID(),
          themeId,
          completed: false,
          position: start + index,
          createdAt: now,
          updatedAt: now,
        };
        await tx.objectStore("items").add(value);
        added.push(value);
      }
      await tx.objectStore("roadmap-drafts").delete(themeId);
      await tx.done;
      return added;
    } catch (error) {
      await abortTransaction(tx);
      throw error;
    }
  }
  async deleteTheme(id: string) {
    const tx = (await this.db()).transaction(
      [
        "themes",
        "items",
        "records",
        "legacy-themes-v1",
        "roadmap-drafts",
        "learning-drafts",
        "learning-feedback",
        "feedback-drafts",
        "legacy-records-v2",
        "mastery-history",
      ],
      "readwrite",
    );
    try {
      for (const name of [
        "items",
        "records",
        "legacy-records-v2",
        "mastery-history",
        "learning-drafts",
        "learning-feedback",
        "feedback-drafts",
      ] as const) {
        const keys = await tx
          .objectStore(name)
          .index("by-theme")
          .getAllKeys(id);
        for (const key of keys) await tx.objectStore(name).delete(key);
      }
      await tx.objectStore("roadmap-drafts").delete(id);
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
    return sortStudyItems(items);
  }
  async createItem(themeId: string, title: string, goal = "") {
    const targetGoal = validateGoal(goal);
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
        goal: targetGoal,
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
  async updateItem(
    id: string,
    input: { title: string; completed: boolean; goal?: string },
  ) {
    const goal =
      input.goal === undefined ? undefined : validateGoal(input.goal);
    const title = validateItem(input.title);
    const tx = (await this.db()).transaction("items", "readwrite");
    try {
      const item = await tx.store.get(id);
      if (!item) throw new Error("学習項目が見つかりません。");
      const updated = {
        ...item,
        title,
        ...(goal === undefined ? {} : { goal }),
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
    const tx = (await this.db()).transaction(
      [
        "items",
        "records",
        "mastery-history",
        "learning-drafts",
        "learning-feedback",
        "feedback-drafts",
      ],
      "readwrite",
    );
    try {
      const keys = await tx
        .objectStore("records")
        .index("by-target")
        .getAllKeys(["item", id]);
      for (const key of keys) await tx.objectStore("records").delete(key);
      const historyKeys = await tx
        .objectStore("mastery-history")
        .index("by-target")
        .getAllKeys(["item", id]);
      for (const key of historyKeys)
        await tx.objectStore("mastery-history").delete(key);
      for (const name of [
        "learning-drafts",
        "learning-feedback",
        "feedback-drafts",
      ] as const) {
        const keys = await tx
          .objectStore(name)
          .index("by-target")
          .getAllKeys(["item", id]);
        for (const key of keys) await tx.objectStore(name).delete(key);
      }
      await tx.objectStore("items").delete(id);
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
  async listTargetRecords(target: StudyTarget) {
    return (
      await (
        await this.db()
      ).getAllFromIndex("records", "by-target", [target.type, target.id])
    ).sort((a, b) => b.studiedAt.localeCompare(a.studiedAt));
  }
  async addRecord(themeId: string, note: string, options: RecordOptions = {}) {
    const target = options.target ?? { type: "theme", id: themeId };
    const completion = validateCompletion(options.completion);
    const activity = options.activity ?? "memo";
    const outputRating =
      options.outputRating === undefined
        ? undefined
        : validateFourLevel(options.outputRating);
    if (outputRating !== undefined && activity !== "output")
      throw new Error("完成度はアウトプットで評価してください。");
    if (
      !["theme", "item"].includes(target.type) ||
      !["memo", "output", "deepen"].includes(activity)
    )
      throw new Error("学習対象を確認してください。");
    const text = note.trim();
    if (!text || text.length > 1000)
      throw new Error("学習内容は1〜1,000文字で入力してください。");
    const tx = (await this.db()).transaction(
      ["themes", "items", "records"],
      "readwrite",
    );
    try {
      const theme = await tx.objectStore("themes").get(themeId);
      if (!theme) throw new Error("テーマが見つかりません。");
      if (target.type === "theme" && target.id !== themeId)
        throw new Error("学習対象がテーマと一致しません。");
      if (target.type === "item") {
        const item = await tx.objectStore("items").get(target.id);
        if (!item || item.themeId !== themeId)
          throw new Error(
            "学習項目が見つからないか、別のテーマに属しています。",
          );
      }
      const now = new Date().toISOString();
      const record: StudyRecord = {
        id: crypto.randomUUID(),
        themeId,
        targetType: target.type,
        targetId: target.id,
        activity,
        ...(completion === undefined ? {} : { completion }),
        ...(outputRating === undefined ? {} : { outputRating }),
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
  async getLearningDraft(key: string) {
    const draft = await (await this.db()).get("learning-drafts", key);
    if (draft) validateDraftFeedback(draft);
    return draft ? validateLearningDraft(draft) : undefined;
  }
  async saveLearningDraft(draft: LearningDraft) {
    const value = validateLearningDraft(draft);
    validateDraftFeedback(value);
    const tx = (await this.db()).transaction(learningStores, "readwrite");
    try {
      await learningTarget(tx, value.themeId, {
        type: value.targetType,
        id: value.targetId,
      });
      if (value.recordId) {
        const record = await tx.objectStore("records").get(value.recordId);
        if (
          !record ||
          record.themeId !== value.themeId ||
          record.targetType !== value.targetType ||
          record.targetId !== value.targetId ||
          record.activity !== value.activity
        )
          throw new Error("記録が見つかりません。");
      }
      await tx.objectStore("learning-drafts").put(value);
      await tx.done;
    } catch (error) {
      await abortTransaction(tx);
      throw error;
    }
  }
  async saveLearningRecord(draft: LearningDraft, feedbackSource?: string) {
    const value = validateLearningDraft(draft);
    const input = validateLearningInput(value);
    const document =
      feedbackSource === undefined
        ? undefined
        : parseFeedbackJSON(feedbackSource);
    if (document) {
      validateDraftFeedback(value);
      if (
        !value.feedback ||
        value.recordId ||
        value.feedback.record.question !== input.question ||
        value.feedback.record.questionKind !== input.questionKind
      )
        throw new Error(
          "問いが変更されています。プロンプトを作り直してください。",
        );
      assertFeedbackContext(document, value.feedback.record);
    }
    const tx = (await this.db()).transaction(learningStores, "readwrite");
    try {
      const theme = await learningTarget(tx, value.themeId, {
        type: value.targetType,
        id: value.targetId,
      });
      const old = value.recordId
        ? await tx.objectStore("records").get(value.recordId)
        : undefined;
      if (
        value.recordId &&
        (!old ||
          old.themeId !== value.themeId ||
          old.targetId !== value.targetId ||
          old.targetType !== value.targetType ||
          old.activity !== value.activity)
      )
        throw new Error("記録が見つかりません。");
      if (old && value.baseRevision !== recordRevision(old))
        throw new Error(
          "記録が更新されています。画面を開き直して確認してください。",
        );
      const now = document
        ? recordRevision(value.feedback!.record)
        : new Date(
            Math.max(Date.now(), old ? Date.parse(recordRevision(old)) + 1 : 0),
          ).toISOString();
      const record: StudyRecord = {
        ...old,
        id:
          old?.id ??
          (document ? value.feedback!.record.id : crypto.randomUUID()),
        themeId: value.themeId,
        targetType: value.targetType,
        targetId: value.targetId,
        ...input,
        note: input.note.trim(),
        ...(input.activity === "output" && {
          title:
            input.title?.trim() ||
            old?.title ||
            (value.targetType === "theme"
              ? theme.name
              : (await tx.objectStore("items").get(value.targetId))!.title),
        }),
        ...(input.activity === "deepen" && {
          question: input.question?.trim(),
          ...(input.hypothesis !== undefined && {
            hypothesis: input.hypothesis,
          }),
          ...(input.unknowns !== undefined && { unknowns: input.unknowns }),
          ...(input.insight !== undefined && { insight: input.insight }),
        }),
        studiedAt: old?.studiedAt ?? now,
        createdAt: old?.createdAt ?? old?.studiedAt ?? now,
        updatedAt: now,
      };
      if (document) {
        if (await tx.objectStore("records").get(record.id))
          throw new Error(
            "記録IDが重複しています。プロンプトを作り直してください。",
          );
        assertFeedbackContext(document, record);
        await tx.objectStore("learning-feedback").add({
          id: crypto.randomUUID(),
          themeId: record.themeId,
          recordId: record.id,
          targetType: record.targetType,
          targetId: record.targetId,
          createdAt: new Date().toISOString(),
          document,
          snapshot: recordSnapshot(record),
        });
      }
      await tx.objectStore("records").put(record);
      await tx.objectStore("themes").put({
        ...theme,
        lastStudiedAt: old
          ? theme.lastStudiedAt
          : [theme.lastStudiedAt ?? "", now].sort().at(-1)!,
        updatedAt: new Date().toISOString(),
      });
      await tx.objectStore("learning-drafts").delete(value.key);
      await tx.done;
      return record;
    } catch (error) {
      await abortTransaction(tx);
      throw error;
    }
  }
  async deleteRecord(id: string) {
    const tx = (await this.db()).transaction(learningStores, "readwrite");
    try {
      for (const key of await tx
        .objectStore("learning-feedback")
        .index("by-record")
        .getAllKeys(id))
        await tx.objectStore("learning-feedback").delete(key);
      for (const draft of await tx.objectStore("learning-drafts").getAll())
        if (draft.recordId === id)
          await tx.objectStore("learning-drafts").delete(draft.key);
      await tx.objectStore("feedback-drafts").delete(id);
      await tx.objectStore("records").delete(id);
      await tx.done;
    } catch (error) {
      await abortTransaction(tx);
      throw error;
    }
  }
  async listFeedbacks() {
    return (await (await this.db()).getAll("learning-feedback")).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }
  async getFeedbackDraft(recordId: string) {
    const draft = await (await this.db()).get("feedback-drafts", recordId);
    return draft ? validateFeedbackDraft(draft) : undefined;
  }
  async saveFeedbackDraft(draft: FeedbackDraft) {
    validateFeedbackDraft(draft);
    const tx = (await this.db()).transaction(learningStores, "readwrite");
    try {
      await learningTarget(tx, draft.themeId, {
        type: draft.targetType,
        id: draft.targetId,
      });
      const record = await tx.objectStore("records").get(draft.recordId);
      if (
        !record ||
        record.activity === "memo" ||
        record.themeId !== draft.themeId ||
        record.targetType !== draft.targetType ||
        record.targetId !== draft.targetId ||
        recordRevision(record) !== draft.revision
      )
        throw new Error(
          "記録が変更されています。プロンプトを作り直してください。",
        );
      await tx.objectStore("feedback-drafts").put(draft);
      await tx.done;
    } catch (error) {
      await abortTransaction(tx);
      throw error;
    }
  }
  async importFeedback(recordId: string, source: string) {
    const document = parseFeedbackJSON(source);
    const tx = (await this.db()).transaction(learningStores, "readwrite");
    try {
      const record = await tx.objectStore("records").get(recordId);
      if (!record) throw new Error("記録が見つかりません。");
      await learningTarget(tx, record.themeId, {
        type: record.targetType,
        id: record.targetId,
      });
      assertFeedbackContext(document, record);
      const entry: LearningFeedback = {
        id: crypto.randomUUID(),
        themeId: record.themeId,
        recordId,
        targetType: record.targetType,
        targetId: record.targetId,
        createdAt: new Date().toISOString(),
        document,
        snapshot: recordSnapshot(record),
      };
      await tx.objectStore("learning-feedback").add(entry);
      await tx.objectStore("feedback-drafts").delete(recordId);
      await tx.done;
      return entry;
    } catch (error) {
      await abortTransaction(tx);
      throw error;
    }
  }
  async listSubjectIcons() {
    return (await this.db()).getAll("subject-icons");
  }
  async setSubjectIcon(subjectId: string, icon: SubjectIconKey | "auto") {
    if (icon !== "auto") validateSubjectIcon(icon);
    const tx = (await this.db()).transaction(
      ["subjects", "subject-icons"],
      "readwrite",
    );
    try {
      const subject = await tx.objectStore("subjects").get(subjectId);
      if (!subject) throw new Error("科目が見つかりません。");
      const setting: SubjectIconSetting = {
        subjectId,
        icon: icon === "auto" ? inferSubjectIcon(subject.name) : icon,
        source: icon === "auto" ? "auto" : "manual",
        updatedAt: new Date().toISOString(),
      };
      await tx.objectStore("subject-icons").put(setting);
      await tx.done;
      return setting;
    } catch (error) {
      await abortTransaction(tx);
      throw error;
    }
  }
  async listMasteryHistory(themeId?: string): Promise<MasteryChange[]> {
    const tx = (await this.db()).transaction("mastery-history");
    const [entries, keys] = themeId
      ? await Promise.all([
          tx.store.index("by-theme").getAll(themeId),
          tx.store.index("by-theme").getAllKeys(themeId),
        ])
      : await Promise.all([tx.store.getAll(), tx.store.getAllKeys()]);
    await tx.done;
    return entries
      .map((entry, index) => ({ ...entry, id: keys[index] }))
      .sort((a, b) => b.id - a.id);
  }
  async setMastery(
    themeId: string,
    target: StudyTarget,
    level: FourLevel,
  ): Promise<MasteryChange> {
    validateFourLevel(level);
    if (!["theme", "item"].includes(target.type))
      throw new Error("学習対象を確認してください。");
    const tx = (await this.db()).transaction(
      ["themes", "items", "mastery-history"],
      "readwrite",
    );
    try {
      if (!(await tx.objectStore("themes").get(themeId)))
        throw new Error("テーマが見つかりません。");
      if (target.type === "theme" && target.id !== themeId)
        throw new Error("学習対象がテーマと一致しません。");
      if (target.type === "item") {
        const item = await tx.objectStore("items").get(target.id);
        if (!item || item.themeId !== themeId)
          throw new Error(
            "学習項目が見つからないか、別のテーマに属しています。",
          );
      }
      const entry = {
        themeId,
        targetType: target.type,
        targetId: target.id,
        level,
        changedAt: new Date().toISOString(),
      };
      const id = await tx.objectStore("mastery-history").add(entry);
      await tx.done;
      return { ...entry, id };
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
