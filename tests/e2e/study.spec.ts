import { expect, test, type Page, type Locator } from "@playwright/test";
// Mobile projects exercise touch input; desktop keeps ordinary mouse clicks.
async function activate(locator: Locator) {
  if (test.info().project.use.hasTouch) await locator.tap();
  else await locator.click();
}
async function createTheme(
  page: Page,
  name = "フランス革命",
  subject = "世界史",
  existing = false,
) {
  await activate(page.getByRole("button", { name: "テーマ", exact: true }));
  await page.getByLabel("テーマ名", { exact: true }).fill(name);
  await page.getByLabel("説明").fill("背景と影響");
  await activate(page.getByRole("button", { name: /^科目 / }));
  if (existing)
    await activate(page.getByRole("button", { name: subject, exact: true }));
  else {
    await activate(
      page.getByRole("button", { name: "科目を追加", exact: true }),
    );
    await page.getByLabel("科目名", { exact: true }).fill(subject);
    await activate(page.getByRole("button", { name: "追加して選択" }));
  }
  await expect(page.getByLabel("テーマ名", { exact: true })).toHaveValue(name);
  await expect(page.getByLabel("説明")).toHaveValue("背景と影響");
  await activate(
    page.getByRole("button", { name: "テーマを作成", exact: true }),
  );
  await expect(
    page.getByRole("heading", { name, exact: true, level: 1 }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/themes\//);
}
async function editTheme(page: Page) {
  await activate(page.getByRole("button", { name: "テーマのメニュー" }));
  await activate(page.getByRole("menuitem", { name: "編集", exact: true }));
}
test("subject selection, rename, duplicate prevention and subject reassignment preserve theme drafts", async ({
  page,
}) => {
  await page.goto("/");
  await createTheme(page);
  await editTheme(page);
  await page.getByLabel("テーマ名", { exact: true }).fill("革命と近代社会");
  await activate(page.getByRole("button", { name: /^科目 / }));
  await activate(page.getByRole("button", { name: "世界史のメニュー" }));
  await activate(page.getByRole("menuitem", { name: "名称変更" }));
  await page.getByLabel("科目名", { exact: true }).fill("歴史");
  await activate(page.getByRole("button", { name: "名称を保存" }));
  await activate(page.getByRole("button", { name: "歴史", exact: true }));
  await expect(page.getByLabel("テーマ名", { exact: true })).toHaveValue(
    "革命と近代社会",
  );
  await activate(page.getByRole("button", { name: /^科目 / }));
  await activate(page.getByRole("button", { name: "科目を追加", exact: true }));
  await page.getByLabel("科目名", { exact: true }).fill(" 歴史 ");
  await activate(page.getByRole("button", { name: "追加して選択" }));
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "同じ名前",
  );
  await page.getByLabel("科目名", { exact: true }).fill("経済学");
  await activate(page.getByRole("button", { name: "追加して選択" }));
  await expect(page.getByRole("button", { name: "科目 経済学" })).toBeVisible();
  await activate(page.getByRole("button", { name: "変更を保存" }));
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "革命と近代社会", level: 1 }),
  ).toBeVisible();
  await expect(page.locator(".subject-label")).toHaveText("経済学");
  await activate(
    page
      .getByRole("navigation", { name: "メインナビゲーション" })
      .getByRole("link", { name: "ホーム", exact: true }),
  );
  await expect(
    page.locator(".subject-group").filter({
      has: page.getByRole("heading", { name: "経済学", exact: true }),
    }),
  ).toContainText("革命と近代社会");
  await createTheme(page, "人権宣言", "歴史", true);
  await page.reload();
  await expect(page.locator(".subject-label")).toHaveText("歴史");
});
test("roadmap items, records, learning entries and confirmed deletion persist", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await createTheme(page);
  await activate(page.getByRole("link", { name: "ロードマップを見る" }));
  await activate(page.getByRole("button", { name: "項目を追加" }));
  await page.getByLabel("学習項目", { exact: true }).fill("革命が起きた原因");
  await page.getByLabel("到達目標").fill("原因を自分の言葉で説明できる");
  await activate(page.getByRole("button", { name: "保存", exact: true }));
  await activate(
    page.getByRole("button", { name: "革命が起きた原因", exact: true }),
  );
  await expect(page.getByText("原因を自分の言葉で説明できる")).toBeVisible();
  await activate(page.getByRole("checkbox", { name: /革命が起きた原因/ }));
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "100",
  );
  await activate(
    page.getByRole("button", { name: "革命が起きた原因のメニュー" }),
  );
  await activate(page.getByRole("menuitem", { name: "編集", exact: true }));
  await page.getByLabel("学習項目", { exact: true }).fill("身分制と財政難");
  await expect(page.getByLabel("到達目標")).toHaveValue(
    "原因を自分の言葉で説明できる",
  );
  await activate(page.getByRole("button", { name: "保存", exact: true }));
  await activate(page.getByRole("link", { name: "テーマに戻る", exact: true }));
  await activate(page.getByRole("button", { name: "学習を記録", exact: true }));
  await page.getByLabel("学習内容").fill("三部会の役割を整理した。");
  await activate(page.getByRole("button", { name: "学習を保存" }));
  await expect(page.getByText("三部会の役割を整理した。")).toBeVisible();
  await page.reload();
  await expect(page.getByText("三部会の役割を整理した。")).toBeVisible();
  await activate(page.getByRole("link", { name: "ロードマップを見る" }));
  await activate(
    page.getByRole("button", { name: "身分制と財政難", exact: true }),
  );
  await expect(
    page.getByRole("checkbox", { name: /身分制と財政難/ }),
  ).toBeChecked();
  await activate(
    page.getByRole("button", { name: "身分制と財政難", exact: true }),
  );
  await expect(
    page.getByRole("button", { name: "身分制と財政難", exact: true }),
  ).toHaveAttribute("aria-expanded", "false");
  await activate(page.getByRole("link", { name: "テーマに戻る", exact: true }));
  for (const name of ["アウトプット", "理解を深める"]) {
    await activate(
      page
        .getByRole("navigation", { name: "テーマ全体の学習" })
        .getByRole("link", { name, exact: true }),
    );
    await expect(
      page.getByRole("region", { name: "現在の学習対象" }),
    ).toContainText("テーマ全体");
    await expect(
      page.getByText("専用機能は準備中です。学習メモは記録できます。"),
    ).toBeVisible();
    await activate(
      page.getByRole("link", { name: "テーマに戻る", exact: true }),
    );
  }
  await activate(page.getByRole("link", { name: /^過去問/ }));
  await expect(page).toHaveURL(/\/subjects\//);
  await expect(page.getByText("準備中 · 現在は利用できません")).toBeVisible();
  await activate(page.getByRole("link", { name: "テーマに戻る", exact: true }));
  await activate(page.getByRole("link", { name: /^集中する/ }));
  await expect(page.getByText("準備中 · 現在は利用できません")).toBeVisible();
  await activate(
    page.getByRole("link", { name: "テーマに戻る", exact: true }).first(),
  );
  await activate(page.getByRole("button", { name: "テーマのメニュー" }));
  await activate(page.getByRole("menuitem", { name: "削除", exact: true }));
  await activate(page.getByRole("button", { name: "キャンセル", exact: true }));
  await expect(
    page.getByRole("heading", { name: "フランス革命", level: 1 }),
  ).toBeVisible();
  await activate(page.getByRole("button", { name: "テーマのメニュー" }));
  await activate(page.getByRole("menuitem", { name: "削除", exact: true }));
  await activate(page.getByRole("button", { name: "削除する", exact: true }));
  await expect(page).toHaveURL("/");
  await page.reload();
  await expect(page.locator(".theme-row")).toHaveCount(0);
  await page.goto("/history");
  await expect(page.getByText("まだ記録はありません。")).toBeVisible();
  expect(errors).toEqual([]);
});
test("v1 themes, original text, records and completed roadmap survive real browser migration", async ({
  page,
}) => {
  await page.route("**/__seed", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Migration fixture</title>",
    }),
  );
  await page.goto("/__seed");
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("yohaku-study", 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore("themes", { keyPath: "id" });
        db.createObjectStore("records", { keyPath: "id" }).createIndex(
          "by-theme",
          "themeId",
        );
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(["themes", "records"], "readwrite");
        const theme = {
          id: "legacy",
          name: "旧版のテーマ",
          subject: "世界史",
          description: "消してはいけない説明",
          createdAt: "2026-11-01T00:00:00.000Z",
          updatedAt: "2026-11-01T00:00:00.000Z",
          lastStudiedAt: "2026-11-01T00:00:00.000Z",
          roadmap: [
            { id: "r1", title: "原因", completed: true },
            { id: "r2", title: "影響", completed: false },
          ],
        };
        tx.objectStore("themes").add(theme);
        tx.objectStore("records").add({
          id: "note",
          themeId: "legacy",
          note: "旧版の記録",
          studiedAt: "2026-11-01T00:00:00.000Z",
        });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
  });
  await page.goto("/");
  await expect(page.locator(".theme-row")).toContainText("旧版のテーマ");
  await activate(page.locator(".theme-row"));
  await expect(page.getByText("消してはいけない説明")).toBeVisible();
  await expect(page.getByText("旧版の記録")).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "50",
  );
  await page.reload();
  await activate(page.getByRole("link", { name: "ロードマップを見る" }));
  await activate(page.getByRole("button", { name: "原因", exact: true }));
  await activate(page.getByRole("button", { name: "影響", exact: true }));
  await expect(page.getByRole("checkbox", { name: /原因/ })).toBeChecked();
  await expect(page.getByRole("checkbox")).toHaveCount(2);
});
test("full-screen editor follows a shrunken and panned visual viewport and keeps Save usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await createTheme(page);
  await editTheme(page);
  await page.getByLabel("説明").focus();
  await page.evaluate(() => {
    const vv = window.visualViewport!;
    Object.defineProperty(vv, "height", { configurable: true, get: () => 350 });
    Object.defineProperty(vv, "offsetTop", {
      configurable: true,
      get: () => 75,
    });
    vv.dispatchEvent(new Event("resize"));
    vv.dispatchEvent(new Event("scroll"));
  });
  await expect(page.getByRole("dialog")).toHaveCSS("height", "350px");
  await expect(page.getByRole("dialog")).toHaveCSS("top", "75px");
  await page.getByLabel("説明").fill("キーボード表示領域で保存");
  const save = page.getByRole("button", { name: "変更を保存" });
  const box = await save.boundingBox();
  expect(box!.y).toBeGreaterThanOrEqual(75);
  expect(box!.y + box!.height).toBeLessThanOrEqual(425);
  expect(
    await page
      .locator(".editor-scroll")
      .evaluate((el) => el.scrollHeight > el.clientHeight),
  ).toBe(true);
  await activate(save);
  await page.reload();
  await expect(page.getByText("キーボード表示領域で保存")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("320px landscape-sized editors can scroll, cancel and recover focus without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 300 });
  await page.goto("/");
  await createTheme(page, "学".repeat(80));
  await editTheme(page);
  await page.getByLabel("説明").fill("a".repeat(1000));
  await expect(
    page.getByRole("button", { name: "変更を保存" }),
  ).toBeInViewport();
  await activate(page.getByRole("button", { name: "閉じる", exact: true }));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("blocked IndexedDB reports an error and failed writes retain theme input", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (
      ...args: Parameters<IDBObjectStore["add"]>
    ) {
      if (this.name === "themes")
        throw new DOMException("Quota failure", "QuotaExceededError");
      return original.apply(this, args);
    };
  });
  await page.goto("/");
  await activate(page.getByRole("button", { name: "テーマ", exact: true }));
  await page.getByLabel("テーマ名", { exact: true }).fill("保存テスト");
  await activate(page.getByRole("button", { name: /^科目 / }));
  await activate(page.getByRole("button", { name: "科目を追加", exact: true }));
  await page.getByLabel("科目名", { exact: true }).fill("数学");
  await activate(page.getByRole("button", { name: "追加して選択" }));
  await activate(
    page.getByRole("button", { name: "テーマを作成", exact: true }),
  );
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "保存できません",
  );
  await expect(page.getByLabel("テーマ名", { exact: true })).toHaveValue(
    "保存テスト",
  );
  await activate(page.getByRole("button", { name: "閉じる", exact: true }));
  await page.reload();
  await expect(page.locator(".theme-row")).toHaveCount(0);
});
test("IndexedDB unavailable has retry and missing themes still navigate home", async ({
  page,
  context,
}) => {
  await page.goto("/themes/missing");
  await expect(
    page.getByRole("heading", { name: "テーマが見つかりません" }),
  ).toBeVisible();
  await activate(page.getByRole("link", { name: "ホームに戻る", exact: true }));
  await expect(
    page.getByRole("heading", { name: "学びのノート", exact: true }),
  ).toBeVisible();
  const blocked = await context.newPage();
  await blocked.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", {
      get() {
        throw new DOMException("Blocked", "SecurityError");
      },
    });
  });
  await blocked.goto("/");
  await expect(blocked.getByRole("main").getByRole("alert")).toContainText(
    "ノートを開けませんでした",
  );
  await expect(blocked.getByRole("button", { name: "再試行" })).toBeVisible();
});
async function addItem(page: Page, title = "革命が起きた原因") {
  await activate(page.getByRole("button", { name: "項目を追加" }));
  await page.getByLabel("学習項目", { exact: true }).fill(title);
  await page.getByLabel("到達目標").fill("自分の言葉で説明できる");
  await activate(page.getByRole("button", { name: "保存", exact: true }));
  await activate(page.getByRole("button", { name: title, exact: true }));
}
async function saveLearning(page: Page, note: string, completion?: number) {
  await activate(page.getByRole("button", { name: "学習を記録", exact: true }));
  await page.getByLabel("学習内容").fill(note);
  if (completion !== undefined)
    await page.getByLabel("完成度").fill(String(completion));
  await activate(page.getByRole("button", { name: "学習を保存" }));
  await expect(page.getByText(note, { exact: true })).toBeVisible();
}
test("TRACE Note reflects real mastery, three learning states and keeps v3 data unchanged on reload", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/TRACE Note/);
  await expect(
    page.getByRole("link", { name: "TRACE Note ホーム" }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "全項目の習得率 0%" }),
  ).toBeVisible();
  await createTheme(page);
  const themeUrl = page.url();
  await activate(page.getByRole("link", { name: "ロードマップを見る" }));
  await addItem(page, "革命前の社会");
  await activate(page.getByRole("checkbox", { name: /革命前の社会/ }));
  await addItem(page, "革命が起きた原因");
  await activate(
    page
      .getByRole("navigation", { name: "項目の学習" })
      .last()
      .getByRole("link", { name: "アウトプット", exact: true }),
  );
  await saveLearning(page, "財政難と身分制を整理", 90);
  await activate(
    page.getByRole("link", { name: "ロードマップに戻る", exact: true }),
  );
  await addItem(page, "革命の影響");
  await expect(page.locator('[data-learning-state="mastered"]')).toHaveCount(1);
  await expect(page.locator('[data-learning-state="in-progress"]')).toHaveCount(
    1,
  );
  await expect(page.locator('[data-learning-state="not-started"]')).toHaveCount(
    1,
  );
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "33",
  );
  // Read every store, including original migration backups. Rendering must not rewrite any row.
  async function snapshot() {
    return page.evaluate(
      async () =>
        new Promise<unknown>((resolve, reject) => {
          const request = indexedDB.open("yohaku-study");
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const db = request.result;
            const stores = Array.from(db.objectStoreNames);
            const tx = db.transaction(stores, "readonly");
            const rows: Record<string, unknown[]> = {};
            stores.forEach((name) => {
              const read = tx.objectStore(name).getAll();
              read.onsuccess = () => {
                rows[name] = read.result;
              };
            });
            tx.oncomplete = () => {
              const version = db.version;
              db.close();
              resolve({ version, rows });
            };
            tx.onerror = () => reject(tx.error);
          };
        }),
    );
  }
  const before = await snapshot();
  await page.goto("/");
  await expect(
    page.getByRole("img", { name: "全項目の習得率 33%" }),
  ).toBeVisible();
  await expect(
    page.getByRole("progressbar", { name: "世界史の習得進捗" }),
  ).toHaveAttribute("aria-valuenow", "33");
  const summary = page.getByRole("region", { name: "学習の軌跡" });
  await expect(summary.locator("dd")).toHaveText(["1", "1", "1"]);
  await page.reload();
  await expect(
    page.getByRole("img", { name: "全項目の習得率 33%" }),
  ).toBeVisible();
  await page.goto(`${themeUrl}/roadmap`);
  await expect(
    page.locator('[data-learning-state="in-progress"]'),
  ).toContainText("革命が起きた原因");
  expect(await snapshot()).toEqual(before);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await activate(
    page.getByRole("button", { name: "革命が起きた原因", exact: true }),
  );
  await expect(
    page.getByRole("navigation", { name: "項目の学習" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 320, height: 640 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("home subject addition is direct, persistent and works in a shortened viewport", async ({
  page,
}) => {
  await page.goto("/");
  await activate(page.getByRole("button", { name: "科目を追加", exact: true }));
  await page.getByLabel("科目名", { exact: true }).fill("数学");
  await page.setViewportSize({ width: 390, height: 380 });
  await expect(
    page.getByRole("button", { name: "保存", exact: true }),
  ).toBeInViewport();
  await activate(page.getByRole("button", { name: "保存", exact: true }));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "数学", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("progressbar", { name: "数学の習得進捗" }),
  ).toHaveAttribute("aria-valuenow", "0");
  await activate(page.getByRole("button", { name: "科目を追加", exact: true }));
  await page.getByLabel("科目名", { exact: true }).fill(" 数学 ");
  await activate(page.getByRole("button", { name: "保存", exact: true }));
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "同じ名前",
  );
});
test("theme and item share both learning screens but retain separate records and completion", async ({
  page,
}) => {
  await page.goto("/");
  await createTheme(page);
  const themeUrl = page.url();
  await activate(
    page
      .getByRole("navigation", { name: "テーマ全体の学習" })
      .getByRole("link", { name: "アウトプット", exact: true }),
  );
  await expect(
    page.getByRole("region", { name: "現在の学習対象" }),
  ).toContainText("フランス革命");
  await saveLearning(page, "テーマ全体の理解を整理", 20);
  await expect(page.locator(".completion-summary strong")).toHaveText("20%");
  await activate(page.getByRole("link", { name: "テーマに戻る", exact: true }));
  await activate(page.getByRole("link", { name: "ロードマップを見る" }));
  await addItem(page);
  await activate(
    page
      .getByRole("navigation", { name: "項目の学習" })
      .getByRole("link", { name: "アウトプット", exact: true }),
  );
  await expect(
    page.getByRole("region", { name: "現在の学習対象" }),
  ).toContainText("学習項目");
  await expect(
    page.getByRole("region", { name: "現在の学習対象" }),
  ).toContainText("革命が起きた原因");
  await expect(page.locator(".completion-summary strong")).toHaveText("未設定");
  await saveLearning(page, "項目の原因を説明", 90);
  await expect(
    page.getByText("テーマ全体の理解を整理", { exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".completion-summary strong")).toHaveText("90%");
  await page.reload();
  await expect(
    page.getByText("項目の原因を説明", { exact: true }),
  ).toBeVisible();
  await activate(
    page.getByRole("link", { name: "ロードマップに戻る", exact: true }),
  );
  await expect(
    page.getByRole("button", { name: "革命が起きた原因", exact: true }),
  ).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "0",
  );
  await activate(
    page
      .getByRole("navigation", { name: "項目の学習" })
      .getByRole("link", { name: "理解を深める", exact: true }),
  );
  await expect(
    page.getByRole("heading", { name: "理解を深める", level: 1 }),
  ).toBeVisible();
  await expect(page.locator(".completion-summary strong")).toHaveText("90%");
  await saveLearning(page, "なぜ財政難になったか考えた");
  await expect(page.locator(".completion-summary strong")).toHaveText("90%");
  await page.goto(themeUrl);
  await activate(
    page
      .getByRole("navigation", { name: "テーマ全体の学習" })
      .getByRole("link", { name: "理解を深める", exact: true }),
  );
  await expect(page.locator(".completion-summary strong")).toHaveText("20%");
  await expect(page.getByText("項目の原因を説明", { exact: true })).toHaveCount(
    0,
  );
  await page.goto("/history");
  await page.getByLabel("学習対象", { exact: true }).selectOption("item");
  await expect(
    page.getByText("項目の原因を説明", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("テーマ全体の理解を整理", { exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("学習対象", { exact: true }).selectOption("theme");
  await expect(
    page.getByText("テーマ全体の理解を整理", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("項目の原因を説明", { exact: true })).toHaveCount(
    0,
  );
});
test("invalid, foreign and deleted item targets never fall back to theme learning", async ({
  page,
}) => {
  await page.goto("/");
  await createTheme(page);
  const firstUrl = page.url();
  await activate(page.getByRole("link", { name: "ロードマップを見る" }));
  await addItem(page);
  const itemHref = await page
    .getByRole("navigation", { name: "項目の学習" })
    .getByRole("link", { name: "アウトプット", exact: true })
    .getAttribute("href");
  const itemId = new URL(itemHref!, "http://127.0.0.1:3100").searchParams.get(
    "item",
  )!;
  await page.goto("/");
  await createTheme(page, "産業革命", "世界史", true);
  const secondUrl = page.url();
  for (const query of ["missing", "", encodeURIComponent(itemId)]) {
    await page.goto(`${secondUrl}/output?item=${query}`);
    await expect(
      page.getByRole("heading", { name: "学習対象が見つかりません" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "学習を記録", exact: true }),
    ).toHaveCount(0);
  }
  await page.goto(`${firstUrl}/roadmap`);
  await activate(
    page.getByRole("button", { name: "革命が起きた原因のメニュー" }),
  );
  await activate(page.getByRole("menuitem", { name: "削除", exact: true }));
  await activate(page.getByRole("button", { name: "削除する", exact: true }));
  await page.goto(itemHref!);
  await expect(
    page.getByRole("heading", { name: "学習対象が見つかりません" }),
  ).toBeVisible();
});
test("item record form remains scoped and savable above a simulated keyboard, including zero completion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await createTheme(page);
  await activate(page.getByRole("link", { name: "ロードマップを見る" }));
  await addItem(page);
  await activate(
    page
      .getByRole("navigation", { name: "項目の学習" })
      .getByRole("link", { name: "理解を深める", exact: true }),
  );
  await activate(page.getByRole("button", { name: "学習を記録", exact: true }));
  await expect(
    page.getByRole("dialog").locator(".target-summary"),
  ).toContainText("革命が起きた原因");
  await page.getByLabel("学習内容").fill("キーボード表示中の項目メモ");
  await page.evaluate(() => {
    Object.defineProperty(visualViewport!, "height", {
      configurable: true,
      get: () => 320,
    });
    Object.defineProperty(visualViewport!, "offsetTop", {
      configurable: true,
      get: () => 60,
    });
    visualViewport!.dispatchEvent(new Event("resize"));
  });
  await expect(page.getByRole("dialog")).toHaveCSS("height", "320px");
  await page.getByLabel("完成度").fill("0");
  const box = await page
    .getByRole("button", { name: "学習を保存" })
    .boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(380);
  await activate(page.getByRole("button", { name: "学習を保存" }));
  await page.reload();
  await expect(
    page.getByText("キーボード表示中の項目メモ", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".completion-summary strong")).toHaveText("0%");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
