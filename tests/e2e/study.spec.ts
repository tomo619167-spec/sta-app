import { expect, test, type Page } from "@playwright/test";
async function createTheme(page: Page, name = "フランス革命") {
  await page.getByRole("button", { name: "テーマを追加" }).click();
  await page.getByLabel("テーマ名").fill(name);
  await page.getByLabel("科目", { exact: false }).fill("世界史");
  await page
    .getByLabel("説明")
    .fill("背景と近代社会への影響を、自分の言葉で説明する。");
  await page.getByRole("button", { name: "テーマを作成", exact: true }).click();
  await expect(
    page.getByRole("heading", { name, exact: true, level: 1 }),
  ).toBeVisible();
}
test("theme lifecycle, records, reload persistence, pending features, and deletion", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByText("まだ白紙の、あなただけのノート。"),
  ).toBeVisible();
  await createTheme(page);
  const detailUrl = page.url();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "0",
  );
  await expect(
    page.getByText("ロードマップ未作成", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "編集", exact: true }).click();
  await page.getByLabel("テーマ名").fill("フランス革命と近代社会");
  await page.getByRole("button", { name: "変更を保存" }).click();
  await expect(
    page.getByRole("heading", { name: "フランス革命と近代社会", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "学習を記録", exact: true }).click();
  await page
    .getByLabel("学習内容")
    .fill("三部会の役割と、身分制の矛盾を整理した。");
  await page.getByRole("button", { name: "学習を保存" }).click();
  await expect(
    page.getByText("三部会の役割と、身分制の矛盾を整理した。"),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "フランス革命と近代社会", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("三部会の役割と、身分制の矛盾を整理した。"),
  ).toBeVisible();
  for (const name of [
    "学習ロードマップ",
    "アウトプット",
    "ポモドーロタイマー",
    "過去問モード",
    "理解を深める",
  ]) {
    await page
      .getByRole("link")
      .filter({ has: page.getByRole("heading", { name, exact: true }) })
      .click();
    await expect(
      page.getByText("準備中 · 現在は利用できません", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "テーマに戻る", exact: true })
      .first()
      .click();
  }
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "記録", exact: true })
    .click();
  await expect(
    page.getByText("三部会の役割と、身分制の矛盾を整理した。"),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "ホーム", exact: true })
    .click();
  await expect(page.locator(".recent-item")).toContainText(
    "フランス革命と近代社会",
  );
  await expect(page.locator(".theme-card")).toContainText(
    "フランス革命と近代社会",
  );
  await page.goto(detailUrl);
  await page.getByRole("button", { name: "テーマを削除", exact: true }).click();
  await page.getByRole("button", { name: "キャンセル", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "フランス革命と近代社会", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "テーマを削除", exact: true }).click();
  await page.getByRole("button", { name: "削除する", exact: true }).click();
  await expect(page).toHaveURL("/");
  await page.reload();
  await expect(page.locator(".theme-card")).toHaveCount(0);
  await page.goto("/history");
  await expect(page.getByText("最初の一歩を、残そう。")).toBeVisible();
  expect(errors).toEqual([]);
});
test("validation, cancel, keyboard dismissal, navigation and missing theme", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "テーマを追加" }).click();
  await page.getByLabel("テーマ名").fill("   ");
  await page.getByLabel("科目").fill("数学");
  await page.getByRole("button", { name: "テーマを作成", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "テーマ名は1〜80文字",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".theme-card")).toHaveCount(0);
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "設定", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "ノートについて。" }),
  ).toBeVisible();
  await page.goto("/themes/missing-theme");
  await expect(
    page.getByRole("heading", { name: "テーマが見つかりません" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "ホームに戻る", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /学びに、\s*余白を。/ }),
  ).toBeVisible();
});
test("long content stays within the viewport and dialogs are usable", async ({
  page,
}) => {
  await page.goto("/");
  await createTheme(page, "学".repeat(80));
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "編集", exact: true }).click();
  const bounds = await page.getByRole("dialog").boundingBox();
  expect(bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.getByRole("button", { name: "キャンセル", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("IndexedDB unavailable shows a recoverable error instead of a false saved state", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", {
      get() {
        throw new DOMException("Storage blocked", "SecurityError");
      },
    });
  });
  await page.goto("/");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "ノートを開けませんでした",
  );
  await expect(page.getByRole("button", { name: "再試行" })).toBeVisible();
  await expect(page.getByRole("button", { name: "テーマを追加" })).toHaveCount(
    0,
  );
});
test("failed writes keep the form input and never claim that a theme was saved", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const originalAdd = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (
      ...args: Parameters<IDBObjectStore["add"]>
    ) {
      if (this.name === "themes")
        throw new DOMException("Test quota failure", "QuotaExceededError");
      return originalAdd.apply(this, args);
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "テーマを追加" }).click();
  await page.getByLabel("テーマ名").fill("保存失敗のテスト");
  await page.getByLabel("科目").fill("数学");
  await page.getByRole("button", { name: "テーマを作成", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "保存できませんでした",
  );
  await expect(page.getByLabel("テーマ名")).toHaveValue("保存失敗のテスト");
  await page.getByRole("button", { name: "キャンセル", exact: true }).click();
  await page.reload();
  await expect(page.locator(".theme-card")).toHaveCount(0);
});
