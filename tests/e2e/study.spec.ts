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
  await page
    .getByRole("textbox", { name: /^学習目標・説明/ })
    .fill("背景と影響");
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
  await expect(
    page.getByRole("textbox", { name: /^学習目標・説明/ }),
  ).toHaveValue("背景と影響");
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
  await expect(page.getByRole("dialog")).toHaveCount(0);
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
  await changeMastery(page, "定着した");
  await expect(
    page.getByRole("img", { name: /フランス革命の習得状況/ }),
  ).toHaveAttribute("aria-label", /定着した 1項目/);
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
  await expect(page.locator(".mastery-control strong")).toHaveText("定着した");
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
  await expect(
    page.getByRole("img", { name: /旧版のテーマの習得状況/ }),
  ).toHaveAttribute("aria-label", /未評価 2項目/);
  await page.reload();
  await activate(page.getByRole("link", { name: "ロードマップを見る" }));
  await activate(page.getByRole("button", { name: "原因", exact: true }));
  await activate(page.getByRole("button", { name: "影響", exact: true }));
  await expect(page.getByText("旧版：習得済み", { exact: true })).toHaveCount(
    1,
  );
  await expect(page.locator(".mastery-control strong")).toHaveText([
    "未評価",
    "未評価",
  ]);
});
test("full-screen editor follows a shrunken and panned visual viewport and keeps Save usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await createTheme(page);
  await editTheme(page);
  await page.getByRole("textbox", { name: /^学習目標・説明/ }).focus();
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
  await page
    .getByRole("textbox", { name: /^学習目標・説明/ })
    .fill("キーボード表示領域で保存");
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
  await page
    .getByRole("textbox", { name: /^学習目標・説明/ })
    .fill("a".repeat(1000));
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
async function changeMastery(
  page: Page,
  label: string,
  scope: "theme" | "item" = "item",
) {
  await activate(
    page
      .getByRole("button", {
        name:
          scope === "theme" ? "テーマ全体の習得度を変更" : "項目の習得度を変更",
        exact: true,
      })
      .last(),
  );
  await activate(page.getByRole("radio", { name: label, exact: true }));
  await activate(
    page.getByRole("button", { name: "習得度を保存", exact: true }),
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function saveLearning(page: Page, note: string, rating?: string) {
  await activate(page.getByRole("button", { name: "学習を記録", exact: true }));
  await page.getByLabel("学習内容").fill(note);
  if (rating !== undefined)
    await activate(page.getByRole("radio", { name: rating, exact: true }));
  await activate(page.getByRole("button", { name: "学習を保存" }));
  await expect(page.getByText(note, { exact: true })).toBeVisible();
}
test("TRACE Note displays four independent stages and keeps v4 data unchanged on reload", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/TRACE Note/);
  await createTheme(page);
  const themeUrl = page.url();
  await activate(page.getByRole("link", { name: "ロードマップを見る" }));
  for (const [index, label] of [
    "未着手",
    "学習中",
    "説明できる",
    "定着した",
  ].entries()) {
    await addItem(page, `項目${index + 1}`);
    await changeMastery(page, label);
  }
  await addItem(page, "未評価の項目");
  for (const state of ["1", "2", "3", "4", "unrated"])
    await expect(page.locator(`[data-learning-state="${state}"]`)).toHaveCount(
      1,
    );
  await expect(
    page.getByRole("img", { name: /フランス革命の習得状況/ }),
  ).toHaveAttribute(
    "aria-label",
    /未着手 1項目、学習中 1項目、説明できる 1項目、定着した 1項目、未評価 1項目/,
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
  const summary = page.getByRole("region", { name: "学習の軌跡" });
  await expect(summary.locator("dd")).toHaveText(["1", "1", "0"]);
  await expect(summary.locator(".summary-total strong")).toHaveText("1");
  await page.reload();
  await expect(
    page.getByRole("img", { name: /すべての学習項目の習得状況/ }),
  ).toHaveAttribute("aria-label", /定着した 1項目/);
  await page.goto(`${themeUrl}/roadmap`);
  await expect(page.locator('[data-learning-state="2"]')).toContainText(
    "項目2",
  );
  expect(await snapshot()).toEqual(before);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await activate(page.getByRole("button", { name: "項目2", exact: true }));
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
    page.getByRole("img", { name: /数学の習得状況/ }),
  ).toHaveAttribute("aria-label", /定着した 0項目/);
  await expect(
    page.locator('.subject-heading [data-subject-icon="math"]'),
  ).toHaveCount(1);
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
  await saveLearning(page, "テーマ全体の理解を整理", "一部できた");
  await expect(page.locator(".completion-summary strong")).toHaveText(
    "一部できた",
  );
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
  await expect(page.locator(".completion-summary strong")).toHaveText("未評価");
  await saveLearning(page, "項目の原因を説明", "十分できた");
  await expect(
    page.getByText("テーマ全体の理解を整理", { exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".completion-summary strong")).toHaveText(
    "十分できた",
  );
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
  await expect(
    page.getByRole("img", { name: /フランス革命の習得状況/ }),
  ).toHaveAttribute("aria-label", /未評価 1項目/);
  await activate(
    page
      .getByRole("navigation", { name: "項目の学習" })
      .getByRole("link", { name: "理解を深める", exact: true }),
  );
  await expect(
    page.getByRole("heading", { name: "理解を深める", level: 1 }),
  ).toBeVisible();
  await expect(page.locator(".completion-summary")).toHaveCount(0);
  await saveLearning(page, "なぜ財政難になったか考えた");
  await expect(
    page.getByText("項目の原因を説明", { exact: true }),
  ).toBeVisible();
  await page.goto(themeUrl);
  await activate(
    page
      .getByRole("navigation", { name: "テーマ全体の学習" })
      .getByRole("link", { name: "理解を深める", exact: true }),
  );
  await expect(page.locator(".completion-summary")).toHaveCount(0);
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
test("item record form remains scoped and savable above a simulated keyboard, including an optional four-level rating", async ({
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
      .getByRole("link", { name: "アウトプット", exact: true }),
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
  await activate(page.getByRole("radio", { name: "まだ難しい", exact: true }));
  const box = await page
    .getByRole("button", { name: "学習を保存" })
    .boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(380);
  await activate(page.getByRole("button", { name: "学習を保存" }));
  await page.reload();
  await expect(
    page.getByText("キーボード表示中の項目メモ", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".completion-summary strong")).toHaveText(
    "まだ難しい",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("subject icons can be overridden and are not replaced by rename or reload", async ({
  page,
}) => {
  await page.goto("/");
  await createTheme(page, "微分", "数学Ⅰ");
  await activate(page.getByRole("link", { name: "TRACE Note ホーム" }));
  await expect(
    page.locator('.subject-heading [data-subject-icon="math"]'),
  ).toHaveCount(1);
  await activate(page.getByRole("button", { name: "科目の管理", exact: true }));
  await activate(
    page.getByRole("menuitem", { name: "科目を管理", exact: true }),
  );
  await activate(
    page.getByRole("button", { name: "数学Iのメニュー", exact: true }),
  );
  await activate(
    page.getByRole("menuitem", { name: "アイコンを変更", exact: true }),
  );
  await activate(page.getByRole("radio", { name: "葉", exact: true }));
  await activate(
    page.getByRole("button", { name: "アイコンを保存", exact: true }),
  );
  await activate(
    page.getByRole("button", { name: "数学Iのメニュー", exact: true }),
  );
  await activate(page.getByRole("menuitem", { name: "名称変更", exact: true }));
  await page.getByLabel("科目名", { exact: true }).fill("英語");
  await activate(page.getByRole("button", { name: "保存", exact: true }));
  await activate(
    page.getByRole("button", { name: "閉じる", exact: true }).last(),
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "英語", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('.subject-heading [data-subject-icon="biology"]'),
  ).toHaveCount(1);
  await activate(page.getByRole("button", { name: "科目の管理", exact: true }));
  await activate(
    page.getByRole("menuitem", { name: "科目を管理", exact: true }),
  );
  await activate(
    page.getByRole("button", { name: "英語のメニュー", exact: true }),
  );
  await activate(
    page.getByRole("menuitem", { name: "アイコンを変更", exact: true }),
  );
  await activate(page.getByRole("radio", { name: "自動", exact: true }));
  await activate(
    page.getByRole("button", { name: "アイコンを保存", exact: true }),
  );
  await activate(
    page.getByRole("button", { name: "閉じる", exact: true }).last(),
  );
  await expect(
    page.locator('.subject-heading [data-subject-icon="language"]'),
  ).toHaveCount(1);
});
test("output history is session-specific and independent of theme and item mastery, including a decrease", async ({
  page,
}) => {
  await page.goto("/");
  await createTheme(page);
  const themeUrl = page.url();
  await changeMastery(page, "説明できる", "theme");
  await activate(
    page
      .getByRole("navigation", { name: "テーマ全体の学習" })
      .getByRole("link", { name: "アウトプット", exact: true }),
  );
  await saveLearning(page, "テーマのアウトプット", "一部できた");
  await expect(page.locator(".mastery-control strong")).toHaveText(
    "説明できる",
  );
  await page.goto(`${themeUrl}/roadmap`);
  await addItem(page);
  await changeMastery(page, "定着した");
  await activate(
    page
      .getByRole("navigation", { name: "項目の学習" })
      .getByRole("link", { name: "アウトプット", exact: true }),
  );
  await expect(page).toHaveURL(/\/output\?item=/);
  const itemUrl = page.url();
  for (const [note, rating] of [
    ["初回", "まだ難しい"],
    ["復習後", "十分できた"],
    ["未評価の回", undefined],
  ]) {
    await saveLearning(page, note!, rating);
  }
  await expect(page.locator(".completion-summary strong")).toHaveText("未評価");
  await expect(page.locator(".mastery-control strong")).toHaveText("定着した");
  for (const [note, rating] of [
    ["初回", "まだ難しい"],
    ["復習後", "十分できた"],
    ["未評価の回", "未評価"],
  ]) {
    await expect(
      page
        .locator(".record-list li")
        .filter({ has: page.getByText(note, { exact: true }) }),
    ).toContainText(`アウトプット完成度 · ${rating}`);
  }
  await changeMastery(page, "学習中");
  await activate(
    page.getByRole("button", { name: "項目の習得度を変更", exact: true }),
  );
  await expect(
    page.getByRole("region", { name: "習得度の履歴" }).locator("li strong"),
  ).toHaveText(["学習中", "定着した"]);
  await activate(page.getByRole("button", { name: "閉じる", exact: true }));
  await page.reload();
  await expect(page.locator(".mastery-control strong")).toHaveText("学習中");
  await page.goto(`${themeUrl}/output`);
  await expect(page.locator(".mastery-control strong")).toHaveText(
    "説明できる",
  );
  await expect(page.locator(".completion-summary strong")).toHaveText(
    "一部できた",
  );
  await page.goto(itemUrl);
  await activate(page.getByRole("button", { name: "学習を記録", exact: true }));
  await expect(page.getByRole("spinbutton")).toHaveCount(0);
  await activate(page.getByRole("radio", { name: "概ねできた", exact: true }));
  await activate(
    page.getByRole("button", { name: "未評価で保存", exact: true }),
  );
  await expect(
    page.getByRole("radio", { name: "概ねできた", exact: true }),
  ).not.toBeChecked();
});
test("v3 percentages and all original stores survive a real browser v4 upgrade without automatic ratings", async ({
  page,
}) => {
  await page.route("**/__seed-v3", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>v3 fixture</title>",
    }),
  );
  await page.goto("/__seed-v3");
  const original = await page.evaluate(
    async () =>
      new Promise<Record<string, unknown[]>>((resolve, reject) => {
        const request = indexedDB.open("yohaku-study", 3);
        request.onupgradeneeded = () => {
          const db = request.result;
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
          const records = db.createObjectStore("records", { keyPath: "id" });
          records.createIndex("by-theme", "themeId");
          records.createIndex("by-target", ["targetType", "targetId"]);
          db.createObjectStore("legacy-themes-v1", { keyPath: "id" });
          db.createObjectStore("legacy-records-v2", {
            keyPath: "id",
          }).createIndex("by-theme", "themeId");
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = async () => {
          const db = request.result;
          const now = "2026-11-01T00:00:00.000Z";
          const subject = {
            id: "s",
            name: "線形代数",
            normalizedName: "線形代数",
            createdAt: now,
            updatedAt: now,
          };
          const theme = {
            id: "t",
            subjectId: "s",
            subject: "線形代数",
            name: "行列",
            description: "旧目標",
            roadmap: [],
            createdAt: now,
            updatedAt: now,
            lastStudiedAt: now,
          };
          const item = {
            id: "i",
            themeId: "t",
            title: "逆行列",
            goal: "旧到達目標",
            completed: true,
            position: 0,
            createdAt: now,
            updatedAt: now,
          };
          const record = {
            id: "r0",
            themeId: "t",
            targetType: "theme",
            targetId: "t",
            activity: "output",
            note: "旧ゼロ評価",
            completion: 0,
            studiedAt: now,
          };
          const old: Record<string, unknown[]> = {
            subjects: [subject],
            themes: [theme],
            items: [item],
            records: [
              record,
              {
                ...record,
                id: "r100",
                targetType: "item",
                targetId: "i",
                note: "旧満点評価",
                completion: 100,
              },
            ],
            "legacy-themes-v1": [{ ...theme, id: "original" }],
            "legacy-records-v2": [{ ...record, id: "backup" }],
          };
          const tx = db.transaction(Object.keys(old), "readwrite");
          for (const [store, rows] of Object.entries(old))
            for (const row of rows) tx.objectStore(store).add(row);
          tx.oncomplete = () => {
            db.close();
            resolve(old);
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  await page.goto("/");
  await expect(
    page.locator('.subject-heading [data-subject-icon="math"]'),
  ).toHaveCount(1);
  await page.goto("/themes/t/output");
  await expect(page.getByText("旧評価 0%", { exact: true })).toBeVisible();
  await expect(page.locator(".mastery-control strong")).toHaveText("未評価");
  await expect(page.locator(".completion-summary strong")).toHaveText("未評価");
  await page.goto("/themes/t/output?item=i");
  await expect(page.getByText("旧評価 100%", { exact: true })).toBeVisible();
  await expect(page.locator(".mastery-control strong")).toHaveText("未評価");
  await page.reload();
  const after = await page.evaluate(
    async () =>
      new Promise<{ version: number; rows: Record<string, unknown[]> }>(
        (resolve, reject) => {
          const request = indexedDB.open("yohaku-study");
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const db = request.result;
            const rows: Record<string, unknown[]> = {};
            const tx = db.transaction(Array.from(db.objectStoreNames));
            for (const store of Array.from(db.objectStoreNames)) {
              const read = tx.objectStore(store).getAll();
              read.onsuccess = () => {
                rows[store] = read.result;
              };
            }
            tx.oncomplete = () => {
              const version = db.version;
              db.close();
              resolve({ version, rows });
            };
            tx.onerror = () => reject(tx.error);
          };
        },
      ),
  );
  expect(after.version).toBe(4);
  for (const [store, rows] of Object.entries(original))
    expect(after.rows[store]).toEqual(rows);
  expect(after.rows["mastery-history"]).toEqual([]);
});
