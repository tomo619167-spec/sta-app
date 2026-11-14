import { test, expect, type Page, type Locator } from "@playwright/test";
const originTime = Date.parse("2026-11-14T09:00:00Z");
async function activate(locator: Locator) {
  if (test.info().project.use.hasTouch) await locator.tap();
  else await locator.click();
}
async function rows(page: Page, store: string) {
  return page.evaluate(
    (store) =>
      new Promise<Record<string, unknown>[]>((resolve, reject) => {
        const request = indexedDB.open("yohaku-study");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(store);
          const get = tx.objectStore(store).getAll();
          get.onsuccess = () => resolve(get.result);
          tx.oncomplete = () => db.close();
        };
      }),
    store,
  );
}
async function seed(page: Page) {
  await page.clock.setFixedTime(new Date(originTime));
  await page.goto("/timer");
  await expect(
    page.getByRole("button", { name: "開始", exact: true }),
  ).toBeEnabled();
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("yohaku-study");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(
            ["subjects", "themes", "items"],
            "readwrite",
          );
          const date = new Date().toISOString();
          tx.objectStore("subjects").put({
            id: "focus-subject",
            name: "世界史",
            normalizedName: "世界史",
            createdAt: date,
            updatedAt: date,
          });
          tx.objectStore("themes").put({
            id: "focus-theme",
            name: "フランス革命",
            subject: "世界史",
            subjectId: "focus-subject",
            description: "原因を説明する",
            roadmap: [],
            lastStudiedAt: null,
            createdAt: date,
            updatedAt: date,
          });
          tx.objectStore("items").put({
            id: "focus-item",
            themeId: "focus-theme",
            title: "革命の原因",
            goal: "背景を自分の言葉で説明する",
            completed: false,
            position: 0,
            createdAt: date,
            updatedAt: date,
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onabort = () => reject(tx.error);
        };
      }),
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "開始", exact: true }),
  ).toBeEnabled();
}
async function minuteSettings(
  page: Page,
  mode: "simple" | "pomodoro" = "simple",
) {
  if (mode === "pomodoro")
    await activate(
      page.getByRole("button", { name: "ポモドーロ", exact: true }),
    );
  await activate(
    page.getByRole("button", { name: "タイマー設定", exact: true }),
  );
  await expect(page.getByLabel("完了音を鳴らす")).not.toBeChecked();
  await page.getByLabel("シンプル（分）", { exact: true }).fill("1");
  await page.getByLabel("集中（分）", { exact: true }).fill("1");
  await page.getByLabel("短い休憩（分）", { exact: true }).fill("1");
  await page.getByLabel("長い休憩（分）", { exact: true }).fill("2");
  await activate(page.getByRole("button", { name: "保存", exact: true }));
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function setTime(page: Page, offset: number) {
  await page.clock.setFixedTime(new Date(originTime + offset));
}
const remaining = (page: Page) => page.getByRole("timer", { name: "残り時間" });

test("simple presets, custom settings, pause, resume, tabs, reload, interruption, notebook and deletion preserve actual time", async ({
  page,
}) => {
  await seed(page);
  await expect(remaining(page)).toHaveText("25:00");
  for (const minutes of [15, 45, 25]) {
    await activate(
      page.getByRole("button", { name: `${minutes}分`, exact: true }),
    );
    await expect(remaining(page)).toHaveText(`${minutes}:00`);
  }
  await minuteSettings(page);
  await activate(
    page.getByRole("button", { name: "タイマー設定", exact: true }),
  );
  await activate(page.locator("label.focus-sound"));
  await expect(page.getByLabel("完了音を鳴らす")).toBeChecked();
  const soundLabel = page.locator("label.focus-sound");
  expect((await soundLabel.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await activate(page.getByRole("button", { name: "保存", exact: true }));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(remaining(page)).toHaveText("01:00");
  expect((await rows(page, "focus-state"))[0].settings).toMatchObject({
    sound: true,
  });
  await activate(
    page.getByRole("button", { name: "タイマー設定", exact: true }),
  );
  await expect(page.getByLabel("完了音を鳴らす")).toBeChecked();
  await activate(page.locator("label.focus-sound"));
  await expect(page.getByLabel("完了音を鳴らす")).not.toBeChecked();
  await activate(page.getByRole("button", { name: "保存", exact: true }));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await activate(page.getByRole("button", { name: "開始", exact: true }));
  await setTime(page, 10000);
  await expect(remaining(page)).toHaveText("00:50");
  await activate(page.getByRole("button", { name: "一時停止", exact: true }));
  await setTime(page, 40000);
  await expect(remaining(page)).toHaveText("00:50");
  const nav = page.getByRole("navigation", { name: "メインナビゲーション" });
  await activate(nav.getByRole("link", { name: "ホーム", exact: true }));
  await expect(page).toHaveURL("/");
  await activate(nav.getByRole("link", { name: "タイマー", exact: true }));
  await expect(page).toHaveURL("/timer");
  await page.reload();
  await expect(remaining(page)).toHaveText("00:50");
  await activate(page.getByRole("button", { name: "再開", exact: true }));
  await setTime(page, 45000);
  await expect(remaining(page)).toHaveText("00:45");
  await activate(page.getByRole("button", { name: "終了", exact: true }));
  await expect(page.locator(".focus-actions")).toContainText("15秒");
  expect(await rows(page, "focus-sessions")).toHaveLength(0);
  await activate(
    page.getByRole("button", { name: "集中時間を保存", exact: true }),
  );
  await expect(page.getByRole("region", { name: "集中の完了" })).toContainText(
    "15秒",
  );
  await expect(
    page.getByRole("link", { name: "学習項目を選ぶ", exact: true }),
  ).toBeVisible();
  const [record] = await rows(page, "focus-sessions");
  expect(record.actualFocusSeconds).toBe(15);
  expect(record.plannedFocusSeconds).toBe(60);
  expect(record.status).toBe("interrupted");
  await page.reload();
  await expect(page.locator(".focus-result")).toHaveText("0分15秒");
  await activate(
    page.getByRole("link", { name: "学習ノートを見る", exact: true }),
  );
  await activate(
    page
      .getByRole("group", { name: "ノートの絞り込み" })
      .getByRole("button", { name: "集中", exact: true }),
  );
  const note = page.locator(".focus-note");
  await expect(note).toHaveCount(1);
  await activate(note.locator("summary"));
  await expect(note).toContainText("予定時間1分");
  await expect(note).toContainText("実績時間0分15秒");
  await activate(
    note.getByRole("button", { name: "集中記録を削除", exact: true }),
  );
  await activate(note.getByRole("button", { name: "削除する", exact: true }));
  await expect(note).toHaveCount(0);
  expect(await rows(page, "focus-sessions")).toHaveLength(0);
  await page.goto("/timer");
  await expect(page.locator(".focus-today")).toContainText("0分");
});

test("pomodoro completes four sets, waits for manual breaks, excludes rests and returns to existing item learning and notes", async ({
  page,
}) => {
  await seed(page);
  await minuteSettings(page, "pomodoro");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "ポモドーロ", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goto("/themes/focus-theme/items/focus-item");
  await activate(
    page.getByRole("link", { name: "この項目に集中する", exact: true }),
  );
  await expect(page.getByLabel("学習対象", { exact: true })).toHaveValue(
    "item:focus-item",
  );
  await activate(page.getByRole("button", { name: "開始", exact: true }));
  await expect(
    page.getByRole("button", { name: "シンプル", exact: true }),
  ).toBeDisabled();
  let time = 0;
  for (let set = 1; set <= 4; set++) {
    time += 60000;
    await setTime(page, time);
    await expect(
      page.getByRole("button", {
        name: set === 4 ? "長い休憩を開始" : "短い休憩を開始",
        exact: true,
      }),
    ).toBeVisible();
    expect(await rows(page, "focus-sessions")).toHaveLength(set);
    time += 120000;
    await setTime(page, time);
    expect(await rows(page, "focus-sessions")).toHaveLength(set);
    if (set < 4) {
      await activate(
        page.getByRole("button", { name: "短い休憩を開始", exact: true }),
      );
      await expect(page.locator(".focus-clock")).toContainText("短い休憩");
      time += 60000;
      await setTime(page, time);
      await expect(
        page.getByRole("button", { name: "次の集中を開始", exact: true }),
      ).toBeVisible();
      expect(await rows(page, "focus-sessions")).toHaveLength(set);
      await activate(
        page.getByRole("button", { name: "次の集中を開始", exact: true }),
      );
    }
  }
  await activate(
    page.getByRole("button", { name: "長い休憩を開始", exact: true }),
  );
  await expect(remaining(page)).toHaveText("02:00");
  await activate(page.getByRole("button", { name: "終了", exact: true }));
  await expect(page.locator(".focus-result")).toHaveText("4分");
  await expect(
    page.getByRole("link", { name: "自分の言葉で説明する", exact: true }),
  ).toHaveAttribute("href", "/themes/focus-theme/output?item=focus-item");
  await expect(
    page.getByRole("link", { name: "理解を深める", exact: true }),
  ).toHaveAttribute("href", "/themes/focus-theme/deepen?item=focus-item");
  await activate(
    page.getByRole("link", { name: "自分の言葉で説明する", exact: true }),
  );
  await page
    .getByLabel("アウトプット本文", { exact: true })
    .fill("集中して学んだ原因を説明する");
  await activate(page.getByRole("button", { name: "説明を保存", exact: true }));
  await page.goto("/history?theme=focus-theme&item=focus-item");
  await expect(page.locator(".notebook-record")).toHaveCount(5);
  const filters = page.getByRole("group", { name: "ノートの絞り込み" });
  await activate(filters.getByRole("button", { name: "集中", exact: true }));
  await expect(page.locator(".focus-note")).toHaveCount(4);
  await activate(page.locator(".focus-note summary").nth(0));
  await activate(page.locator(".focus-note summary").nth(1));
  await expect(page.locator(".focus-note[open]")).toHaveCount(2);
  await expect(page.locator(".focus-note[open]").first()).toContainText(
    "セット",
  );
  await activate(filters.getByRole("button", { name: "説明", exact: true }));
  await expect(page.locator(".notebook-record")).toHaveCount(1);
  await activate(filters.getByRole("button", { name: "理解", exact: true }));
  await expect(
    page.getByText("該当する記録はありません。", { exact: true }),
  ).toBeVisible();
});

test("running completion restores from timestamps after reload and two tabs cannot duplicate a finished session", async ({
  page,
  context,
}) => {
  await seed(page);
  await minuteSettings(page);
  await page
    .getByLabel("学習対象", { exact: true })
    .selectOption("theme:focus-theme");
  await activate(page.getByRole("button", { name: "開始", exact: true }));
  await setTime(page, 20000);
  await page.reload();
  await expect(remaining(page)).toHaveText("00:40");
  const other = await context.newPage();
  await other.clock.setFixedTime(new Date(originTime + 20000));
  await other.goto("/timer");
  await expect(remaining(other)).toHaveText("00:40");
  await Promise.all([setTime(page, 90000), setTime(other, 90000)]);
  await expect(page.locator(".focus-result")).toHaveText("1分");
  await expect(other.locator(".focus-result")).toHaveText("1分");
  expect(await rows(page, "focus-sessions")).toHaveLength(1);
  await other.close();
  await page.reload();
  await expect(page.locator(".focus-result")).toHaveText("1分");
  expect(await rows(page, "focus-sessions")).toHaveLength(1);
  await activate(page.getByRole("link", { name: "理解を深める", exact: true }));
  await expect(
    page.getByRole("textbox", { name: "自分の問い", exact: true }),
  ).toHaveValue("フランス革命とは？");
});

test("all target levels are optional and partial discard preserves existing learning data", async ({
  page,
}) => {
  await seed(page);
  await minuteSettings(page);
  const before = await rows(page, "themes");
  for (const value of [
    "none:",
    "subject:focus-subject",
    "theme:focus-theme",
    "item:focus-item",
  ]) {
    await page.getByLabel("学習対象", { exact: true }).selectOption(value);
    await activate(page.getByRole("button", { name: "開始", exact: true }));
    await setTime(page, 10000);
    await activate(page.getByRole("button", { name: "終了", exact: true }));
    await activate(
      page.getByRole("button", { name: "今回のセットを破棄", exact: true }),
    );
    await expect(page.locator(".focus-completion")).toContainText(
      "記録を残さず終了しました",
    );
    expect(await rows(page, "focus-sessions")).toHaveLength(0);
    await activate(
      page.getByRole("button", { name: "もう一度集中する", exact: true }),
    );
    await setTime(page, 0);
  }
  expect(await rows(page, "themes")).toEqual(before);
});

test("320px layout and offline countdown remain usable; quota failure is visible and retry saves atomically", async ({
  page,
  context,
}) => {
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (
      ...args: Parameters<IDBObjectStore["put"]>
    ) {
      if (
        this.name === "focus-state" &&
        (window as Window & { failFocus?: boolean }).failFocus
      )
        throw new DOMException("Quota", "QuotaExceededError");
      return put.apply(this, args);
    };
  });
  await page.setViewportSize({ width: 320, height: 640 });
  await seed(page);
  await minuteSettings(page);
  await page
    .getByLabel("学習対象", { exact: true })
    .selectOption("item:focus-item");
  await activate(page.getByRole("button", { name: "開始", exact: true }));
  await context.setOffline(true);
  await setTime(page, 15000);
  await expect(remaining(page)).toHaveText("00:45");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: test.info().outputPath("focus-mobile.png") });
  await page.evaluate(() => {
    (window as Window & { failFocus?: boolean }).failFocus = true;
  });
  await setTime(page, 70000);
  await expect(page.locator(".focus-page [role=alert]")).toContainText(
    "保存できませんでした",
  );
  expect(await rows(page, "focus-sessions")).toHaveLength(0);
  await page.evaluate(() => {
    (window as Window & { failFocus?: boolean }).failFocus = false;
  });
  await activate(page.getByRole("button", { name: "再試行", exact: true }));
  await expect(page.locator(".focus-result")).toHaveText("1分");
  expect(await rows(page, "focus-sessions")).toHaveLength(1);
  await context.setOffline(false);
  await page.goto("/themes/focus-theme/items/focus-item");
  await expect(
    page.getByRole("region", { name: "最近の学習記録" }),
  ).toContainText("集中時間");
  await activate(page.getByRole("link", { name: "すべて見る", exact: true }));
  await expect(page).toHaveURL("/history?theme=focus-theme&item=focus-item");
  await activate(page.locator(".focus-note summary"));
  await expect(page.locator(".focus-note")).toContainText("世界史");
});
