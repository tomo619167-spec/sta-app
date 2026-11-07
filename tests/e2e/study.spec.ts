import { expect, test, type Page } from "@playwright/test";
async function createTheme(
  page: Page,
  name = "フランス革命",
  subject = "世界史",
  existing = false,
) {
  await page.getByRole("button", { name: "テーマ", exact: true }).click();
  await page.getByLabel("テーマ名", { exact: true }).fill(name);
  await page.getByLabel("説明").fill("背景と影響");
  await page.getByRole("button", { name: /^科目 / }).click();
  if (existing)
    await page.getByRole("button", { name: subject, exact: true }).click();
  else {
    await page.getByRole("button", { name: "科目を追加", exact: true }).click();
    await page.getByLabel("科目名", { exact: true }).fill(subject);
    await page.getByRole("button", { name: "追加して選択" }).click();
  }
  await expect(page.getByLabel("テーマ名", { exact: true })).toHaveValue(name);
  await expect(page.getByLabel("説明")).toHaveValue("背景と影響");
  await page.getByRole("button", { name: "テーマを作成", exact: true }).click();
  await expect(
    page.getByRole("heading", { name, exact: true, level: 1 }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/themes\//);
}
async function editTheme(page: Page) {
  await page.getByRole("button", { name: "テーマのメニュー" }).click();
  await page.getByRole("menuitem", { name: "編集", exact: true }).click();
}
test("subject selection, rename, duplicate prevention and subject reassignment preserve theme drafts", async ({
  page,
}) => {
  await page.goto("/");
  await createTheme(page);
  await editTheme(page);
  await page.getByLabel("テーマ名", { exact: true }).fill("革命と近代社会");
  await page.getByRole("button", { name: /^科目 / }).click();
  await page.getByRole("button", { name: "世界史のメニュー" }).click();
  await page.getByRole("menuitem", { name: "名称変更" }).click();
  await page.getByLabel("科目名", { exact: true }).fill("歴史");
  await page.getByRole("button", { name: "名称を保存" }).click();
  await page.getByRole("button", { name: "歴史", exact: true }).click();
  await expect(page.getByLabel("テーマ名", { exact: true })).toHaveValue(
    "革命と近代社会",
  );
  await page.getByRole("button", { name: /^科目 / }).click();
  await page.getByRole("button", { name: "科目を追加", exact: true }).click();
  await page.getByLabel("科目名", { exact: true }).fill(" 歴史 ");
  await page.getByRole("button", { name: "追加して選択" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "同じ名前",
  );
  await page.getByLabel("科目名", { exact: true }).fill("経済学");
  await page.getByRole("button", { name: "追加して選択" }).click();
  await expect(page.getByRole("button", { name: "科目 経済学" })).toBeVisible();
  await page.getByRole("button", { name: "変更を保存" }).click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "革命と近代社会", level: 1 }),
  ).toBeVisible();
  await expect(page.locator(".subject-label")).toHaveText("経済学");
  await page
    .getByRole("navigation", { name: "メインナビゲーション" })
    .getByRole("link", { name: "ホーム", exact: true })
    .click();
  await expect(
    page
      .locator(".subject-group")
      .filter({
        has: page.getByRole("heading", { name: "経済学", exact: true }),
      }),
  ).toContainText("革命と近代社会");
  await createTheme(page, "人権宣言", "歴史", true);
  await page.reload();
  await expect(page.locator(".subject-label")).toHaveText("歴史");
});
test("items, records, progress, clear feature buttons and confirmed deletion persist after reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await createTheme(page);
  await page.getByRole("button", { name: "項目を追加" }).click();
  await page.getByLabel("学習項目", { exact: true }).fill("革命が起きた原因");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByRole("checkbox", { name: "革命が起きた原因" }).check();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "100",
  );
  await page
    .getByRole("button", { name: "革命が起きた原因のメニュー" })
    .click();
  await page.getByRole("menuitem", { name: "編集", exact: true }).click();
  await page.getByLabel("学習項目", { exact: true }).fill("身分制と財政難");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByRole("button", { name: "学習を記録", exact: true }).click();
  await page.getByLabel("学習内容").fill("三部会の役割を整理した。");
  await page.getByRole("button", { name: "学習を保存" }).click();
  await expect(page.getByText("三部会の役割を整理した。")).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("checkbox", { name: "身分制と財政難" }),
  ).toBeChecked();
  await expect(page.getByText("三部会の役割を整理した。")).toBeVisible();
  for (const name of [
    "ロードマップ",
    "アウトプット",
    "理解を深める",
    "過去問",
    "集中する",
  ]) {
    await page
      .getByRole("navigation", { name: "学習機能" })
      .getByRole("link", { name: new RegExp(`^${name}`) })
      .click();
    await expect(page.getByText("準備中 · 現在は利用できません")).toBeVisible();
    await page
      .getByRole("link", { name: "テーマに戻る", exact: true })
      .first()
      .click();
  }
  await page.getByRole("button", { name: "テーマのメニュー" }).click();
  await page.getByRole("menuitem", { name: "削除", exact: true }).click();
  await page.getByRole("button", { name: "キャンセル", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "フランス革命", level: 1 }),
  ).toBeVisible();
  await page.getByRole("button", { name: "テーマのメニュー" }).click();
  await page.getByRole("menuitem", { name: "削除", exact: true }).click();
  await page.getByRole("button", { name: "削除する", exact: true }).click();
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
  await page.locator(".theme-row").click();
  await expect(page.getByText("消してはいけない説明")).toBeVisible();
  await expect(page.getByText("旧版の記録")).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "50",
  );
  await page.reload();
  await expect(
    page.getByRole("checkbox", { name: "原因", exact: true }),
  ).toBeChecked();
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
  await save.click();
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
  await page.getByRole("button", { name: "閉じる", exact: true }).click();
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
  await page.getByRole("button", { name: "テーマ", exact: true }).click();
  await page.getByLabel("テーマ名", { exact: true }).fill("保存テスト");
  await page.getByRole("button", { name: /^科目 / }).click();
  await page.getByRole("button", { name: "科目を追加", exact: true }).click();
  await page.getByLabel("科目名", { exact: true }).fill("数学");
  await page.getByRole("button", { name: "追加して選択" }).click();
  await page.getByRole("button", { name: "テーマを作成", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "保存できません",
  );
  await expect(page.getByLabel("テーマ名", { exact: true })).toHaveValue(
    "保存テスト",
  );
  await page.getByRole("button", { name: "閉じる", exact: true }).click();
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
  await page.getByRole("link", { name: "ホームに戻る", exact: true }).click();
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
