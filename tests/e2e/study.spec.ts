import { expect, test, type Page, type Locator } from "@playwright/test";
import { questionTemplate, type QuestionKind } from "../../lib/learning";
// Mobile projects exercise touch input; desktop keeps ordinary mouse clicks.
async function activate(locator: Locator) {
  if (test.info().project.use.hasTouch) await locator.tap();
  else await locator.click();
}

test("3.6 empty roadmap creation and integrated progress disclosure preserve all management tools and legacy URLs", async ({
  page,
}) => {
  await page.goto("/");
  await createTheme(page);
  const themeUrl = page.url();
  await expect(
    page.getByRole("link", { name: "ロードマップを追加", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".theme-progress-disclosure")).not.toHaveAttribute(
    "open",
  );
  await openRoadmap(page);
  await expect(
    page.getByRole("button", { name: "AIでロードマップを作成", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "JSONを直接取り込む", exact: true }),
  ).toBeVisible();
  await addItem(page, "原因");
  await addItem(page, "影響");
  await openItem(page);
  await changeMastery(page, "説明できる");
  await page.goto(themeUrl);
  const progress = page.locator(".theme-progress-disclosure");
  await activate(
    page.getByText("説明できる・定着した：", { exact: false }).first(),
  );
  await expect(progress).toHaveAttribute("open", "");
  await expect(
    progress.getByRole("region", { name: "テーマ全体の到達目標" }),
  ).toContainText("背景と影響");
  await expect(progress.getByRole("img", { name: /習得状況/ })).toHaveAttribute(
    "aria-label",
    /説明できる 1項目/,
  );
  await expect(page.locator(".items-preview .roadmap-item")).toHaveCount(2);
  await activate(
    progress.getByRole("button", { name: "目標を編集", exact: true }),
  );
  await page
    .getByRole("textbox", { name: "テーマ全体の到達目標", exact: true })
    .fill("変化を比較して説明できる");
  await activate(page.getByRole("button", { name: "保存", exact: true }));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(progress).toContainText("変化を比較して説明できる");
  await activate(progress.locator("summary").first());
  await expect(progress).not.toHaveAttribute("open");
  await expect(page.locator(".items-preview .roadmap-item")).toHaveCount(2);
  await page.goto(themeUrl + "/roadmap");
  await expect(page).toHaveURL(themeUrl);
  await expect(
    page.getByRole("heading", { name: "フランス革命", level: 1 }),
  ).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath("integrated-progress-closed.png"),
  });
});

test("3.6 closing item or theme learning returns to the theme explicitly, restores scroll and protects drafts", async ({
  page,
}) => {
  const { themeUrl } = await setupItems(page, [
    "第一",
    "第二",
    "第三",
    "第四",
    "第五",
  ]);
  await page.goto(themeUrl);
  await activate(
    page.getByRole("button", { name: "すべて表示（5項目）", exact: true }),
  );
  await page
    .getByRole("link", { name: "第五", exact: true })
    .scrollIntoViewIfNeeded();
  const y = await page.evaluate(() => scrollY);
  await openItem(page, "第五");
  await begin(page, "output");
  await page
    .getByLabel("アウトプット本文", { exact: true })
    .fill("閉じても残す説明");
  await activate(page.getByRole("button", { name: "閉じる", exact: true }));
  await expect(page).toHaveURL(themeUrl);
  await expect(page.locator(".items-preview .roadmap-item")).toHaveCount(5);
  await expect
    .poll(async () => Math.abs((await page.evaluate(() => scrollY)) - y))
    .toBeLessThan(96);
  await openItem(page, "第五");
  await begin(page, "output");
  await expect(
    page.getByLabel("アウトプット本文", { exact: true }),
  ).toHaveValue("閉じても残す説明");
  await activate(page.getByRole("button", { name: "閉じる", exact: true }));
  await expect(page).toHaveURL(themeUrl);
  await begin(page, "deepen");
  await page
    .getByLabel("自分の問い", { exact: true })
    .fill("テーマ全体への問い");
  await activate(page.getByRole("button", { name: "閉じる", exact: true }));
  await expect(page).toHaveURL(themeUrl);
  await begin(page, "deepen");
  await expect(page.getByLabel("自分の問い", { exact: true })).toHaveValue(
    "テーマ全体への問い",
  );
  await activate(page.getByRole("button", { name: "問いを保存", exact: true }));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await activate(
    page.getByRole("link", { name: "テーマ詳細へ戻る", exact: true }),
  );
  await expect(page).toHaveURL(themeUrl);
});

test("3.6 all explanation modes share JSON import and persist mode and source across closing and reopening", async ({
  page,
}) => {
  // Three complete AI round trips with reloads need a longer WebKit rendering budget.
  test.slow();
  await clipboard(page);
  const { themeUrl } = await setupItems(page, ["需要と供給"]);
  const editorUrl = page.url();
  for (const [index, label] of ["簡単", "標準", "面白おかしく"].entries()) {
    await page.goto(editorUrl);
    await openItem(page, "需要と供給");
    await begin(page, "deepen");
    await activate(
      page.getByRole("button", { name: "プロンプトを確認", exact: true }),
    );
    const styles = page.getByRole("group", { name: "説明スタイル" });
    await expect(
      styles.getByRole("button", { name: "簡単", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await activate(styles.getByRole("button", { name: label, exact: true }));
    const { prompt, document } = await feedbackJSON(page);
    expect(prompt).toContain("説明スタイル：" + label);
    expect(prompt).toContain("需要と供給とは？");
    expect(document.version).toBe(3);
    await activate(
      page.getByRole("button", { name: "プロンプトをコピー", exact: true }),
    );
    await expect(page.getByRole("status", { name: "コピー状況" })).toHaveText(
      "コピーしました",
    );
    await activate(
      page.getByRole("button", { name: "結果を貼り付ける", exact: true }),
    );
    document.explanation = label + "モードの説明";
    await page
      .getByLabel("JSON", { exact: true })
      .fill(JSON.stringify(document));
    await waitForDraft(page);
    await activate(page.getByRole("button", { name: "閉じる", exact: true }));
    await expect(page).toHaveURL(themeUrl);
    await openItem(page, "需要と供給");
    await begin(page, "deepen");
    await expect(page.getByLabel("JSON", { exact: true })).toHaveValue(
      JSON.stringify(document),
    );
    await activate(page.getByRole("button", { name: "戻る", exact: true }));
    await expect(
      styles.getByRole("button", { name: label, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(
      styles.getByRole("button", { name: label, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await activate(
      page.getByRole("button", { name: "結果を貼り付ける", exact: true }),
    );
    await activate(
      page.getByRole("button", { name: "プレビュー", exact: true }),
    );
    await expect(page.locator(".feedback-body")).toContainText(
      label + "モードの説明",
    );
    await activate(
      page.getByRole("button", { name: "フィードバックを保存", exact: true }),
    );
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(await rows(page, "learning-feedback")).toHaveLength(index + 1);
    await activate(
      page.getByRole("link", { name: "学習項目一覧へ戻る", exact: true }),
    );
  }
});

test("3.6 recent record filters use activity, work instantly, and filter before the preview limit", async ({
  page,
}) => {
  const { themeUrl } = await setupItems(page);
  for (let i = 0; i < 3; i++) {
    await page.goto(themeUrl);
    await begin(page, "output");
    await finishOutput(page, "理解を深めるという文字を含む説明" + i);
  }
  await page.goto(themeUrl);
  await begin(page, "deepen");
  await page
    .getByLabel("自分の問い", { exact: true })
    .fill("自分の言葉で説明とは？");
  await activate(page.getByRole("button", { name: "問いを保存", exact: true }));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto(themeUrl);
  const all = await rows(page, "records");
  const scope = page.getByRole("region", { name: "最近の学習記録" });
  await expect(scope.locator(".record-list li")).toHaveCount(3);
  await activate(scope.getByRole("button", { name: "理解", exact: true }));
  await expect(scope.locator(".record-list li")).toHaveCount(1);
  await expect(scope.locator(".record-kind")).toHaveText("理解を深める");
  await activate(scope.getByRole("button", { name: "説明", exact: true }));
  await expect(scope.locator(".record-list li")).toHaveCount(3);
  await expect(scope.locator(".record-kind")).toHaveText([
    "自分の言葉で説明",
    "自分の言葉で説明",
    "自分の言葉で説明",
  ]);
  await expect(page).toHaveURL(themeUrl);
  expect(await rows(page, "records")).toEqual(all);
  await activate(scope.getByRole("link", { name: "すべて見る", exact: true }));
  await expect(
    page.getByRole("heading", { name: "学習ノート", level: 1 }),
  ).toBeVisible();
  const url = page.url();
  const filter = page.getByRole("group", { name: "ノートの絞り込み" });
  await activate(filter.getByRole("button", { name: "理解", exact: true }));
  await expect(page.locator(".notebook-record")).toHaveCount(1);
  await activate(filter.getByRole("button", { name: "説明", exact: true }));
  await expect(page.locator(".notebook-record")).toHaveCount(3);
  await expect(page).toHaveURL(url);
  expect(await rows(page, "records")).toEqual(all);
});

test("3.6 notebook reads multiple long records and AI inline, preserves target scope, and edits or deletes without leaving", async ({
  page,
}) => {
  await clipboard(page);
  const { themeUrl } = await setupItems(page);
  const itemUrl = await openItem(page);
  await begin(page, "output");
  await page.getByLabel("タイトル", { exact: true }).fill("説明記録A");
  const long = "長い説明を自分の言葉で振り返る。\n".repeat(300);
  await finishOutput(page, long, "一部できた");
  await page.goto(itemUrl);
  await begin(page, "deepen");
  await page
    .getByLabel("自分の問い", { exact: true })
    .fill("原因の背景をどう考える？");
  await activate(page.getByRole("button", { name: "問いを保存", exact: true }));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto(themeUrl);
  await openItem(page, "影響");
  await begin(page, "output");
  await finishOutput(page, "別項目の記録");
  await page.goto(itemUrl);
  await activate(page.getByRole("link", { name: "すべて見る", exact: true }));
  await expect(
    page.getByRole("heading", { name: "学習ノート", level: 1 }),
  ).toBeVisible();
  const notebookUrl = page.url();
  await expect(page.locator(".notebook-record")).toHaveCount(2);
  await expect(page.locator(".notebook-record-body")).toHaveCount(0);
  const output = page
    .locator(".notebook-record")
    .filter({ has: page.locator(".notebook-title", { hasText: "説明記録A" }) });
  const question = page.locator(".notebook-record").filter({
    has: page.locator(".notebook-title", {
      hasText: "原因の背景をどう考える？",
    }),
  });
  await activate(output.locator("summary").first());
  await activate(question.locator("summary").first());
  await expect(page.locator(".notebook-record[open]")).toHaveCount(2);
  await expect(output.locator(".record-full-text")).toHaveText(long.trim());
  await expect(output.locator(".record-evaluation")).toContainText(
    "一部できた",
  );
  await expect(question.locator(".deepening-content")).toContainText(
    "原因の背景をどう考える？",
  );
  await activate(
    question.getByRole("button", { name: "外部AIに相談", exact: true }),
  );
  const { document } = await feedbackJSON(page);
  document.explanation = "ノート内で読むAIの参考情報";
  await activate(
    page.getByRole("button", { name: "結果を貼り付ける", exact: true }),
  );
  await page.getByLabel("JSON", { exact: true }).fill(JSON.stringify(document));
  await activate(page.getByRole("button", { name: "プレビュー", exact: true }));
  await activate(
    page.getByRole("button", { name: "フィードバックを保存", exact: true }),
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(notebookUrl);
  await expect(question.locator(".feedback-entry")).toContainText(
    document.explanation,
  );
  await page.setViewportSize({ width: 320, height: 640 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: test.info().outputPath("learning-notebook.png"),
  });
  await activate(
    output.getByRole("button", { name: "記録を編集", exact: true }),
  );
  await page
    .getByLabel("アウトプット本文", { exact: true })
    .fill("編集した説明");
  await activate(page.getByRole("button", { name: "説明を保存", exact: true }));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(output.locator(".record-full-text")).toHaveText("編集した説明");
  await expect(page).toHaveURL(notebookUrl);
  await activate(
    question.getByRole("button", { name: "記録のメニュー", exact: true }),
  );
  await activate(page.getByRole("menuitem", { name: "削除", exact: true }));
  await activate(page.getByRole("button", { name: "削除する", exact: true }));
  await expect(page.locator(".notebook-record")).toHaveCount(1);
  await expect(page).toHaveURL(notebookUrl);
  await activate(
    page.getByRole("link", { name: "学習項目に戻る", exact: true }),
  );
  await expect(page).toHaveURL(itemUrl);
});

async function setupItems(page: Page, names = ["原因", "影響"]) {
  await page.goto("/");
  await createTheme(page);
  const themeUrl = page.url();
  await openRoadmap(page);
  for (const name of names) await addItem(page, name);
  return { themeUrl, roadmapUrl: page.url() };
}
async function openItem(page: Page, name = "原因") {
  await activate(page.getByRole("link", { name, exact: true }));
  await expect(
    page.getByRole("heading", { name, level: 1, exact: true }),
  ).toBeVisible();
  return page.url();
}
async function begin(page: Page, activity: "output" | "deepen") {
  await activate(
    page.getByRole("link", {
      name: activity === "output" ? "自分の言葉で説明する" : "理解を深める",
      exact: true,
    }),
  );
  await expect(page.getByRole("dialog")).toBeVisible();
}
async function finishOutput(page: Page, note: string, rating?: string) {
  await page.getByLabel("アウトプット本文", { exact: true }).fill(note);
  if (rating)
    await activate(page.getByRole("radio", { name: rating, exact: true }));
  await activate(page.getByRole("button", { name: "説明を保存", exact: true }));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "保存後の操作" }),
  ).toBeVisible();
}
async function rows(page: Page, store: string) {
  return page.evaluate(
    (name) =>
      new Promise<Record<string, unknown>[]>((resolve, reject) => {
        const request = indexedDB.open("yohaku-study");
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(name);
          const read = tx.objectStore(name).getAll();
          tx.oncomplete = () => {
            db.close();
            resolve(read.result);
          };
          tx.onerror = () => reject(tx.error);
        };
        request.onerror = () => reject(request.error);
      }),
    store,
  );
}
async function feedbackJSON(page: Page) {
  const prompt = await page
    .getByLabel("生成したプロンプト", { exact: true })
    .inputValue();
  return { prompt, document: JSON.parse(prompt.split("\n\n").at(-1)!) };
}
async function clipboard(page: Page, denied = false) {
  await page.addInitScript((fail) => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          if (fail) throw new DOMException("Denied", "NotAllowedError");
          (window as Window & { copiedText?: string }).copiedText = text;
        },
      },
    });
  }, denied);
}

test("3.6 registered AI close returns to the theme and empty filters or invalid note scopes never alter records", async ({
  page,
}) => {
  const { themeUrl } = await setupItems(page);
  const itemUrl = await openItem(page);
  await begin(page, "output");
  await finishOutput(page, "残す説明");
  await activate(
    page.getByRole("link", { name: "保存した記録・外部AI", exact: true }),
  );
  await activate(
    page.getByRole("button", { name: "外部AIでフィードバック", exact: true }),
  );
  await activate(
    page.getByRole("button", { name: "結果を貼り付ける", exact: true }),
  );
  await page.getByLabel("JSON", { exact: true }).fill("{途中のAI結果");
  await activate(page.getByRole("button", { name: "閉じる", exact: true }));
  await expect(page).toHaveURL(themeUrl);
  const original = await rows(page, "records");
  expect(await rows(page, "feedback-drafts")).toHaveLength(1);
  await openItem(page);
  const recent = page.getByRole("region", { name: "最近の学習記録" });
  await activate(recent.getByRole("button", { name: "理解", exact: true }));
  await expect(
    recent.getByText("該当する記録はありません。", { exact: true }),
  ).toBeVisible();
  await activate(recent.getByRole("link", { name: "すべて見る", exact: true }));
  await activate(
    page
      .getByRole("group", { name: "ノートの絞り込み" })
      .getByRole("button", { name: "理解", exact: true }),
  );
  await expect(page.locator(".learning-notebook .quiet-empty")).toHaveText(
    "該当する記録はありません。",
  );
  await activate(
    page.getByRole("link", { name: "学習項目に戻る", exact: true }),
  );
  await expect(page).toHaveURL(itemUrl);
  const themeId = new URL(themeUrl).pathname.split("/")[2];
  await page.goto("/history?theme=" + themeId + "&item=missing");
  await expect(
    page.getByText("学習対象が見つかりません。", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".notebook-record")).toHaveCount(0);
  expect(await rows(page, "records")).toEqual(original);
});

test("3.5 existing v6 records, legacy reflections, ratings and AI survive browsing and question-only edits", async ({
  page,
}) => {
  const { themeUrl } = await setupItems(page);
  const itemUrl = await openItem(page);
  const itemId = itemUrl.split("/").at(-1)!;
  const themeId = themeUrl.split("/").at(-1)!;
  await page.evaluate(
    ({ themeId, itemId }) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("yohaku-study");
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(
            ["records", "learning-feedback", "mastery-history"],
            "readwrite",
          );
          const date = "2026-11-01T00:00:00.000Z";
          const base = {
            themeId,
            targetType: "item",
            targetId: itemId,
            studiedAt: date,
            createdAt: date,
            updatedAt: date,
          };
          tx.objectStore("records").add({
            ...base,
            id: "legacy-output",
            activity: "output",
            title: "以前の説明",
            note: "旧アウトプット",
            completion: 63,
            outputRating: 2,
          });
          tx.objectStore("records").add({
            ...base,
            id: "legacy-question",
            activity: "deepen",
            note: "昔の問い",
            question: "昔の問い",
            questionKind: "why",
            hypothesis: "以前の仮説",
            unknowns: "以前の不明点",
            insight: "以前の気づき",
          });
          tx.objectStore("learning-feedback").add({
            id: "old-ai",
            themeId,
            recordId: "legacy-output",
            targetType: "item",
            targetId: itemId,
            createdAt: date,
            snapshot: { note: "旧アウトプット", revision: date },
            document: {
              version: 1,
              kind: "output",
              recordId: "legacy-output",
              targetType: "item",
              targetId: itemId,
              revision: date,
              strengths: ["以前のAI評価"],
              missing: [],
              misunderstandings: [],
              advice: [],
              questions: ["次の問い"],
              uncertainty: [],
            },
          });
          tx.objectStore("mastery-history").add({
            themeId,
            targetType: "item",
            targetId: itemId,
            level: 4,
            changedAt: date,
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    { themeId, itemId },
  );
  const stores = [
    "subjects",
    "themes",
    "items",
    "records",
    "learning-feedback",
    "mastery-history",
  ];
  const before = await Promise.all(stores.map((name) => rows(page, name)));
  await page.reload();
  await expect(page.locator(".mastery-control strong")).toHaveText("定着した");
  await expect(page.locator(".record-list")).toContainText("AIフィードバック");
  await page.goto(themeUrl);
  await openRoadmap(page);
  await openItem(page);
  expect(await Promise.all(stores.map((name) => rows(page, name)))).toEqual(
    before,
  );
  await page.goto("/records/legacy-output");
  await expect(page.getByText("旧評価 63%", { exact: true })).toBeVisible();
  await expect(page.locator(".feedback-entry")).toContainText("以前のAI評価");
  await page.goto("/records/legacy-question");
  await activate(page.getByText("自分の考え・気づき", { exact: true }));
  await expect(page.getByText("以前の仮説", { exact: true })).toBeVisible();
  await expect(page.getByText("以前の不明点", { exact: true })).toBeVisible();
  await activate(page.getByRole("button", { name: "記録を編集", exact: true }));
  await expect(page.getByRole("dialog").getByRole("textbox")).toHaveCount(1);
  await page.getByLabel("自分の問い", { exact: true }).fill("編集後の問い");
  await activate(page.getByRole("button", { name: "問いを保存", exact: true }));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const all = await rows(page, "records");
  expect(all.find((entry) => entry.id === "legacy-output")).toEqual(
    before[3].find((entry) => entry.id === "legacy-output"),
  );
  expect(all.find((entry) => entry.id === "legacy-question")).toMatchObject({
    question: "編集後の問い",
    hypothesis: "以前の仮説",
    unknowns: "以前の不明点",
    insight: "以前の気づき",
  });
  expect(await rows(page, "learning-feedback")).toEqual(before[4]);
});

test("3.5 invalid item details and learning URLs return safely without changing the target to a theme", async ({
  page,
}) => {
  const { themeUrl } = await setupItems(page);
  await page.goto(themeUrl + "/items/missing");
  await expect(
    page.getByRole("heading", { name: "学習項目が見つかりません" }),
  ).toBeVisible();
  await activate(
    page.getByRole("link", { name: "学習項目一覧へ戻る", exact: true }),
  );
  await expect(page).toHaveURL(themeUrl);
  await page.goto(themeUrl + "/output?item=missing");
  await expect(
    page.getByRole("heading", { name: "学習対象が見つかりません" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await rows(page, "records")).toHaveLength(0);
});

test("3.5 stale record edits retain the draft until the latest saved explanation is explicitly reloaded", async ({
  page,
}) => {
  await setupItems(page);
  await openItem(page);
  await begin(page, "output");
  await finishOutput(page, "最初の説明");
  await activate(
    page.getByRole("link", { name: "保存した記録・外部AI", exact: true }),
  );
  await expect(page).toHaveURL(/\/records\/[^/]+$/);
  const recordId = page.url().split("/").at(-1)!;
  await activate(page.getByRole("button", { name: "記録を編集", exact: true }));
  await page
    .getByLabel("アウトプット本文", { exact: true })
    .fill("まだ保存していない編集");
  await waitForDraft(page);
  await page.evaluate(
    (id) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("yohaku-study");
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction("records", "readwrite");
          const read = tx.objectStore("records").get(id);
          read.onsuccess = () =>
            tx.objectStore("records").put({
              ...read.result,
              note: "別の画面で保存された説明",
              updatedAt: "2099-01-01T00:00:00.000Z",
            });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    recordId,
  );
  await page.reload();
  await activate(page.getByRole("button", { name: "記録を編集", exact: true }));
  await expect(page.getByRole("alert")).toContainText(
    "別の画面で記録が更新されています",
  );
  await expect(
    page.getByLabel("アウトプット本文", { exact: true }),
  ).toHaveValue("まだ保存していない編集");
  await activate(
    page.getByRole("button", { name: "最新の記録から編集する", exact: true }),
  );
  await activate(page.getByRole("button", { name: "説明を保存", exact: true }));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".record-full-text")).toHaveText(
    "別の画面で保存された説明",
  );
});

test("3.5 lists show correct counts and whole-row links without menus or assessment controls", async ({
  page,
}) => {
  const { themeUrl } = await setupItems(page, [
    "原因",
    "影響",
    "背景",
    "経過",
    "比較",
  ]);
  for (const [name, level] of [
    ["原因", "説明できる"],
    ["影響", "定着した"],
    ["背景", "学習中"],
  ]) {
    await openItem(page, name);
    await changeMastery(page, level);
    await activate(
      page.getByRole("link", { name: "学習項目一覧へ戻る", exact: true }),
    );
    if (name !== "背景") await openRoadmap(page);
  }
  await expect(page).toHaveURL(themeUrl);
  await expect(page.locator(".compact-roadmap-entry")).toContainText(
    "説明できる・定着した：",
  );
  await expect(page.locator(".compact-roadmap-entry strong")).toHaveText(
    "2 / 5",
  );
  await expect(page.locator(".items-preview .roadmap-item")).toHaveCount(4);
  await expect(page.locator(".items-preview .roadmap-item button")).toHaveCount(
    0,
  );
  await expect(page.locator(".items-preview .mastery-control")).toHaveCount(0);
  await activate(
    page.getByRole("button", { name: "すべて表示（5項目）", exact: true }),
  );
  await expect(page.locator(".items-preview .roadmap-item")).toHaveCount(5);
  await page.screenshot({ path: test.info().outputPath("theme-items.png") });
  const itemUrl = await openItem(page, "比較");
  expect(itemUrl).toContain("/items/");
  await page.screenshot({ path: test.info().outputPath("item-detail.png") });
  await expect(
    page.getByRole("navigation", { name: "項目の学習" }).getByRole("link"),
  ).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "この項目を記録" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "この項目の記録" }),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole("navigation", { name: "メインナビゲーション" })
      .getByRole("link"),
  ).toHaveText(["ホーム"]);
  await expect(
    page.getByRole("navigation", { name: "メインナビゲーション" }),
  ).not.toContainText("タイマー");
  await activate(page.getByRole("link", { name: "設定", exact: true }));
  await expect(
    page.getByRole("heading", { name: "設定", level: 1 }),
  ).toBeVisible();
});

test("3.5 item details retain edit, delete, decrease and roadmap reordering without inline menus", async ({
  page,
}) => {
  const { themeUrl, roadmapUrl } = await setupItems(page, [
    "原因",
    "影響",
    "背景",
  ]);
  await openItem(page);
  await changeMastery(page, "定着した");
  await changeMastery(page, "学習中");
  await activate(
    page.getByRole("button", { name: "学習項目のメニュー", exact: true }),
  );
  await activate(page.getByRole("menuitem", { name: "編集", exact: true }));
  await page.getByLabel("学習項目", { exact: true }).fill("革命の原因");
  await page
    .getByRole("textbox", { name: /^到達目標/ })
    .fill("政治・経済の背景を説明できる");
  await activate(page.getByRole("button", { name: "保存", exact: true }));
  await expect(
    page.getByRole("heading", { name: "革命の原因", level: 1 }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".item-detail-goal")).toContainText("政治・経済");
  await expect(page.locator(".mastery-control strong")).toHaveText("学習中");
  await activate(
    page.getByRole("link", { name: "ロードマップを管理", exact: true }),
  );
  await activate(page.getByRole("button", { name: "並び替え", exact: true }));
  await activate(page.getByRole("button", { name: "背景を上へ", exact: true }));
  await activate(
    page.getByRole("button", { name: "並び替え完了", exact: true }),
  );
  await page.reload();
  await expect(page.locator(".item-title-state > span:first-child")).toHaveText(
    ["革命の原因", "背景", "影響"],
  );
  await openItem(page, "革命の原因");
  await activate(
    page.getByRole("button", { name: "学習項目のメニュー", exact: true }),
  );
  await activate(page.getByRole("menuitem", { name: "削除", exact: true }));
  await activate(page.getByRole("button", { name: "キャンセル", exact: true }));
  await expect(
    page.getByRole("heading", { name: "革命の原因", level: 1 }),
  ).toBeVisible();
  await activate(
    page.getByRole("button", { name: "学習項目のメニュー", exact: true }),
  );
  await activate(page.getByRole("menuitem", { name: "削除", exact: true }));
  await activate(page.getByRole("button", { name: "削除する", exact: true }));
  await expect(page).toHaveURL(themeUrl);
  await page.goto(roadmapUrl);
  await expect(page.locator(".item-title-state > span:first-child")).toHaveText(
    ["背景", "影響"],
  );
});

test("3.5 item output starts with two taps, restores drafts and keeps mastery separate from session rating", async ({
  page,
}) => {
  const { themeUrl } = await setupItems(page);
  const itemUrl = await openItem(page);
  await changeMastery(page, "学習中");
  await begin(page, "output");
  await expect(
    page.getByRole("dialog", { name: "自分の言葉で説明する" }),
  ).toBeVisible();
  await expect(page.locator(".mastery-control")).toHaveCount(0);
  await expect(page.locator(".completion-summary")).toHaveCount(0);
  await page.getByLabel("タイトル", { exact: true }).fill("最初の説明");
  await page
    .getByLabel("アウトプット本文", { exact: true })
    .fill("覚えていた内容。\n自分の言葉で説明する。");
  await activate(page.getByRole("radio", { name: "十分できた", exact: true }));
  await waitForDraft(page);
  await page.reload();
  await expect(page.getByLabel("タイトル", { exact: true })).toHaveValue(
    "最初の説明",
  );
  await expect(
    page.getByLabel("アウトプット本文", { exact: true }),
  ).toHaveValue(/覚えていた内容/);
  await finishOutput(page, "覚えていた内容。\n自分の言葉で説明する。");
  await expect(
    page.getByRole("link", { name: "同じ項目で続ける", exact: true }),
  ).toHaveAttribute("href", new URL(itemUrl).pathname);
  await activate(
    page.getByRole("link", { name: "学習項目一覧へ戻る", exact: true }),
  );
  await expect(page).toHaveURL(themeUrl);
  await openItem(page);
  await expect(page.locator(".mastery-control strong")).toHaveText("学習中");
  await expect(page.locator(".completion-summary")).toHaveCount(0);
  await expect(page.locator(".record-list")).toContainText("十分できた");
  await activate(page.getByRole("link", { name: "記録を開く", exact: true }));
  await expect(page.locator(".record-full-text")).toContainText(
    "覚えていた内容",
  );
  await page.screenshot({ path: test.info().outputPath("item-record.png") });
});

test("3.5 theme output remains independent, can be unrated, compared, edited and deleted", async ({
  page,
}) => {
  const { themeUrl } = await setupItems(page);
  await page.goto(themeUrl);
  await begin(page, "output");
  await finishOutput(page, "一回目", "一部できた");
  await activate(
    page.getByRole("link", { name: "テーマ詳細へ戻る", exact: true }),
  );
  await begin(page, "output");
  await finishOutput(page, "二回目は未評価");
  const records = await rows(page, "records");
  expect(records).toHaveLength(2);
  expect(
    records.filter((entry) => entry.outputRating === undefined),
  ).toHaveLength(1);
  await activate(
    page.getByRole("link", { name: "保存した記録・外部AI", exact: true }),
  );
  await activate(page.getByText("過去のアウトプットと比べる", { exact: true }));
  await expect(
    page.getByRole("region", { name: "比較する本文" }),
  ).toContainText("一回目");
  await expect(page.getByRole("list", { name: "完成度の履歴" })).toContainText(
    "一部できた",
  );
  await activate(page.getByRole("button", { name: "記録を編集", exact: true }));
  await page
    .getByLabel("アウトプット本文", { exact: true })
    .fill("編集した説明");
  await activate(page.getByRole("button", { name: "説明を保存", exact: true }));
  await expect(
    page.getByRole("region", { name: "保存後の操作" }),
  ).toBeVisible();
  await expect(page.locator(".record-full-text")).toHaveText("編集した説明");
  await activate(
    page.getByRole("button", { name: "記録のメニュー", exact: true }),
  );
  await activate(page.getByRole("menuitem", { name: "削除", exact: true }));
  await activate(page.getByRole("button", { name: "削除する", exact: true }));
  await expect(page).toHaveURL(/\/history/);
  expect(await rows(page, "records")).toHaveLength(1);
});

test("3.5 six question templates use one editable input and saving is independent of AI", async ({
  page,
}) => {
  const { themeUrl } = await setupItems(page);
  await openItem(page);
  await begin(page, "deepen");
  await expect(page.locator(".mastery-control")).toHaveCount(0);
  await expect(page.getByRole("dialog").getByRole("textbox")).toHaveCount(1);
  const question = page.getByLabel("自分の問い", { exact: true });
  for (const [kind, label] of [
    ["definition", "そもそも何？"],
    ["why", "なぜ？"],
    ["how", "どうやって？"],
    ["compare", "何が違う？"],
    ["connect", "何とつながる？"],
    ["whatif", "もし〜だったら？"],
  ]) {
    await activate(page.getByRole("radio", { name: label, exact: true }));
    await expect(question).toHaveValue(
      questionTemplate(kind as QuestionKind, "原因"),
    );
  }
  await question.fill("税負担と背景はどう関係する？");
  await activate(page.getByRole("radio", { name: "なぜ？", exact: true }));
  await expect(question).toHaveValue("税負担と背景はどう関係する？");
  await activate(
    page.getByRole("button", {
      name: "文章を残して種類だけ変える",
      exact: true,
    }),
  );
  await waitForDraft(page);
  await page.reload();
  await expect(question).toHaveValue("税負担と背景はどう関係する？");
  await expect(
    page.getByRole("button", { name: "学習を保存", exact: true }),
  ).toHaveCount(0);
  await activate(page.getByRole("button", { name: "問いを保存", exact: true }));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await rows(page, "records")).toHaveLength(1);
  expect(await rows(page, "learning-feedback")).toHaveLength(0);
  await activate(
    page.getByRole("link", { name: "学習項目一覧へ戻る", exact: true }),
  );
  await expect(page).toHaveURL(themeUrl);
});

test("3.5 unsaved question AI copies, resumes and imports JSON atomically with clear next steps", async ({
  page,
}) => {
  await clipboard(page);
  const { themeUrl } = await setupItems(page, ["需要と供給"]);
  await openItem(page, "需要と供給");
  await begin(page, "deepen");
  await activate(
    page.getByRole("button", { name: "プロンプトを確認", exact: true }),
  );
  const { prompt, document } = await feedbackJSON(page);
  expect(prompt).toContain("需要と供給とは？");
  expect(prompt).toContain("簡潔な定義");
  expect(await rows(page, "records")).toHaveLength(0);
  await activate(
    page.getByRole("button", { name: "プロンプトをコピー", exact: true }),
  );
  await expect(page.getByRole("status", { name: "コピー状況" })).toHaveText(
    "コピーしました",
  );
  await expect(page.getByLabel("JSON", { exact: true })).toHaveCount(0);
  await activate(
    page.getByRole("button", { name: "結果を貼り付ける", exact: true }),
  );
  await page.getByLabel("JSON", { exact: true }).fill("{");
  await activate(page.getByRole("button", { name: "プレビュー", exact: true }));
  await expect(page.getByRole("alert")).toContainText("構文");
  document.explanation = "<img src=x onerror=alert(1)>も文字として扱う";
  await page.getByLabel("JSON", { exact: true }).fill(JSON.stringify(document));
  await activate(page.getByRole("button", { name: "プレビュー", exact: true }));
  await waitForDraft(page);
  await page.reload();
  await expect(page.locator(".feedback-body")).toContainText(
    document.explanation,
  );
  await expect(page.locator(".feedback-body img")).toHaveCount(0);
  expect(await rows(page, "records")).toHaveLength(0);
  await activate(
    page.getByRole("button", { name: "フィードバックを保存", exact: true }),
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await rows(page, "records")).toHaveLength(1);
  expect(await rows(page, "learning-feedback")).toHaveLength(1);
  expect(await rows(page, "learning-drafts")).toHaveLength(0);
  await expect(
    page.getByRole("link", { name: "同じ項目で続ける", exact: true }),
  ).toBeVisible();
  await activate(
    page.getByRole("link", { name: "学習項目一覧へ戻る", exact: true }),
  );
  await expect(page).toHaveURL(themeUrl);
  await openItem(page, "需要と供給");
  await expect(page.locator(".record-list")).toContainText("AIフィードバック");
  await activate(page.getByRole("link", { name: "すべて見る", exact: true }));
  await expect(
    page.getByRole("heading", { name: "学習ノート", level: 1 }),
  ).toBeVisible();
  await activate(
    page
      .getByRole("group", { name: "ノートの絞り込み" })
      .getByRole("button", { name: "理解", exact: true }),
  );
  await expect(page.locator(".notebook-record")).toHaveCount(1);
});

test("3.5 cancel and failed AI registration keep drafts and let the question be saved on its own", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const add = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (
      ...args: Parameters<IDBObjectStore["add"]>
    ) {
      if (this.name === "learning-feedback")
        throw new DOMException("Quota", "QuotaExceededError");
      return add.apply(this, args);
    };
  });
  await setupItems(page);
  await openItem(page);
  await begin(page, "deepen");
  await activate(
    page.getByRole("button", { name: "プロンプトを確認", exact: true }),
  );
  const { document } = await feedbackJSON(page);
  await activate(
    page.getByRole("button", { name: "結果を貼り付ける", exact: true }),
  );
  await page.getByLabel("JSON", { exact: true }).fill(JSON.stringify(document));
  await activate(page.getByRole("button", { name: "プレビュー", exact: true }));
  await activate(
    page.getByRole("button", { name: "フィードバックを保存", exact: true }),
  );
  await expect(page.getByRole("alert")).toContainText("取り込めません");
  expect(await rows(page, "records")).toHaveLength(0);
  expect(await rows(page, "learning-feedback")).toHaveLength(0);
  await activate(page.getByRole("button", { name: "戻る", exact: true }));
  await activate(page.getByRole("button", { name: "戻る", exact: true }));
  await activate(page.getByRole("button", { name: "戻る", exact: true }));
  await expect(page.getByLabel("自分の問い", { exact: true })).toHaveValue(
    "原因とは？",
  );
  await activate(page.getByRole("button", { name: "問いを保存", exact: true }));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await rows(page, "records")).toHaveLength(1);
  expect(await rows(page, "learning-feedback")).toHaveLength(0);
});

test("3.5 saved output feedback checks identity and supports manual copy without changing ratings", async ({
  page,
}) => {
  await clipboard(page, true);
  const { themeUrl } = await setupItems(page);
  await openItem(page);
  await changeMastery(page, "学習中");
  await begin(page, "output");
  await finishOutput(page, "原因を説明した", "概ねできた");
  await activate(
    page.getByRole("link", { name: "保存した記録・外部AI", exact: true }),
  );
  await activate(
    page.getByRole("button", { name: "外部AIでフィードバック", exact: true }),
  );
  const { document } = await feedbackJSON(page);
  await activate(
    page.getByRole("button", { name: "プロンプトをコピー", exact: true }),
  );
  await expect(page.getByRole("alert")).toContainText("コピーできません");
  await activate(
    page.getByRole("button", { name: "プロンプトを選択", exact: true }),
  );
  await activate(
    page.getByRole("button", { name: "結果を貼り付ける", exact: true }),
  );
  await page
    .getByLabel("JSON", { exact: true })
    .fill(JSON.stringify({ ...document, targetId: "other" }));
  await activate(page.getByRole("button", { name: "プレビュー", exact: true }));
  await expect(page.getByRole("alert")).toContainText("一致しません");
  await page.getByLabel("JSON", { exact: true }).fill(JSON.stringify(document));
  await activate(page.getByRole("button", { name: "プレビュー", exact: true }));
  await activate(
    page.getByRole("button", { name: "フィードバックを保存", exact: true }),
  );
  await expect(
    page.getByRole("region", { name: "保存後の操作" }),
  ).toBeVisible();
  expect((await rows(page, "records"))[0].outputRating).toBe(3);
  expect((await rows(page, "mastery-history"))[0].level).toBe(2);
  await activate(
    page.getByRole("link", { name: "学習項目一覧へ戻る", exact: true }),
  );
  await expect(page).toHaveURL(themeUrl);
});

test("3.5 both editors stay scrollable at 320px above a shrunken and panned keyboard viewport", async ({
  page,
}) => {
  const { themeUrl } = await setupItems(page);
  await page.setViewportSize({ width: 320, height: 640 });
  for (const activity of ["output", "deepen"] as const) {
    await page.goto(themeUrl);
    await begin(page, activity);
    await page.evaluate(() => {
      Object.defineProperty(visualViewport!, "height", {
        configurable: true,
        get: () => 320,
      });
      Object.defineProperty(visualViewport!, "offsetTop", {
        configurable: true,
        get: () => 50,
      });
      visualViewport!.dispatchEvent(new Event("resize"));
    });
    await expect(page.getByRole("dialog")).toHaveCSS("height", "320px");
    await page
      .getByLabel(activity === "output" ? "アウトプット本文" : "自分の問い", {
        exact: true,
      })
      .fill("覚えていること\n".repeat(activity === "output" ? 100 : 10));
    const save = page.getByRole("button", {
      name: activity === "output" ? "説明を保存" : "問いを保存",
      exact: true,
    });
    await expect(save).toBeInViewport();
    const box = (await save.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(370);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: test.info().outputPath(`keyboard-${activity}.png`),
    });
    await activate(save);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
});
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
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await activate(page.locator(".theme-progress-disclosure > summary"));
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
  await page
    .getByRole("textbox", { name: "学習項目", exact: true })
    .fill(title);
  await page
    .getByRole("textbox", { name: /^到達目標/ })
    .fill("自分の言葉で説明できる");
  await activate(page.getByRole("button", { name: "保存", exact: true }));
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function changeMastery(
  page: Page,
  label: string,
  scope: "theme" | "item" = "item",
) {
  const control = page
    .getByRole("button", {
      name:
        scope === "theme" ? "テーマ全体の習得度を変更" : "項目の習得度を変更",
      exact: true,
    })
    .last();
  if (scope === "theme" && (await control.count()) === 0) {
    await activate(
      page.getByRole("button", { name: "テーマのメニュー", exact: true }),
    );
    await activate(
      page.getByRole("menuitem", { name: "習得度を変更", exact: true }),
    );
  } else await activate(control);
  await activate(page.getByRole("radio", { name: label, exact: true }));
  await activate(
    page.getByRole("button", { name: "習得度を保存", exact: true }),
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

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

test("theme mastery badge is read-only while its menu edits the existing history above a simulated keyboard", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await createTheme(page);
  await expect(page.locator(".detail-intro > .mastery-badge")).toHaveText(
    "未評価",
  );
  await expect(
    page.getByRole("button", { name: "学習項目", exact: true }),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole("region", { name: "学習項目", exact: true })
      .getByRole("link", { name: "ロードマップを追加", exact: true }),
  ).toBeInViewport();
  await changeMastery(page, "定着した", "theme");
  await expect(page.locator(".detail-intro > .mastery-badge")).toHaveText(
    "定着した",
  );
  await activate(
    page.getByRole("button", { name: "テーマのメニュー", exact: true }),
  );
  await activate(
    page.getByRole("menuitem", { name: "習得度を変更", exact: true }),
  );
  await expect(
    page.getByRole("radio", { name: "定着した", exact: true }),
  ).toBeChecked();
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
  await activate(page.getByRole("radio", { name: "学習中", exact: true }));
  const save = page.getByRole("button", { name: "習得度を保存", exact: true });
  const box = await save.boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(380);
  await activate(save);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".detail-intro > .mastery-badge")).toHaveText(
    "学習中",
  );
  await activate(
    page.getByRole("button", { name: "テーマのメニュー", exact: true }),
  );
  await activate(
    page.getByRole("menuitem", { name: "習得度を変更", exact: true }),
  );
  await expect(
    page.getByRole("region", { name: "習得度の履歴" }).locator("li strong"),
  ).toHaveText(["学習中", "定着した"]);
});

function roadmapJSON(items: { title: string; goal: string }[]) {
  return JSON.stringify({
    version: 1,
    subject: "世界史",
    theme: "フランス革命",
    items,
  });
}
async function openRoadmap(page: Page) {
  const action = page.getByRole("link", {
    name: "ロードマップを追加",
    exact: true,
  });
  if (await action.count()) await activate(action);
  else
    await activate(
      page.getByRole("link", { name: "ロードマップを編集", exact: true }),
    );
  await expect(
    page.getByRole("heading", { name: "ロードマップを編集", level: 1 }),
  ).toBeVisible();
}

test("Phase 2 fixed prompt copies the matching JSON schema and previews an append before saving above a keyboard", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          (window as Window & { copiedRoadmap?: string }).copiedRoadmap = value;
        },
      },
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await createTheme(page);
  await openRoadmap(page);
  await addItem(page, "既存の項目");
  await activate(
    page.getByRole("button", { name: "AIでロードマップを作成", exact: true }),
  );
  await expect(page.getByLabel("科目", { exact: true })).toHaveValue("世界史");
  await expect(page.getByLabel("学習テーマ", { exact: true })).toHaveValue(
    "フランス革命",
  );
  await page
    .getByLabel("生成用の到達目標", { exact: true })
    .fill("変化を説明できる");
  await page
    .getByLabel("学習レベル", { exact: true })
    .selectOption("university");
  await page.getByLabel("補足情報").fill("初学者・定期試験対策");
  await activate(
    page.getByRole("button", { name: "プロンプトを確認", exact: true }),
  );
  await expect(
    page.getByLabel("生成したプロンプト", { exact: true }),
  ).toContainText('"version": 1');
  await activate(
    page.getByRole("button", { name: "プロンプトをコピー", exact: true }),
  );
  await expect(page.getByRole("status", { name: "コピー状況" })).toHaveText(
    "コピーしました",
  );
  const copied = await page.evaluate(
    () => (window as Window & { copiedRoadmap?: string }).copiedRoadmap!,
  );
  expect(copied).toContain("初学者・定期試験対策");
  expect(copied).toContain("大学");
  const generated = JSON.parse(copied.split("\n\n").at(-1)!);
  expect(Object.keys(generated)).toEqual([
    "version",
    "subject",
    "theme",
    "items",
  ]);
  await expect(
    page.getByLabel("生成したプロンプト", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "JSON", exact: true }),
  ).toHaveCount(0);
  await activate(
    page.getByRole("button", { name: "JSONの貼り付けへ進む", exact: true }),
  );
  await page
    .getByRole("textbox", { name: "JSON", exact: true })
    .fill(JSON.stringify(generated));
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
  await activate(page.getByRole("button", { name: "プレビュー", exact: true }));
  await expect(
    page.getByRole("list", { name: "取り込みプレビュー" }),
  ).toContainText(generated.items[0].title);
  await expect(page.locator(".roadmap-item")).toHaveCount(1);
  const save = page.getByRole("button", {
    name: "項目を追加する",
    exact: true,
  });
  const box = await save.boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(380);
  await activate(save);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".item-title-state > span:first-child")).toHaveText(
    ["既存の項目", generated.items[0].title],
  );
  await expect(page.locator(".roadmap-item .mastery-badge")).toHaveText([
    "未評価",
    "未評価",
  ]);
});

test("Phase 2 JSON syntax, context and duplicates are explicit and never replace an existing item", async ({
  page,
}) => {
  await page.goto("/");
  await createTheme(page);
  await openRoadmap(page);
  await addItem(page, "既存の項目");
  await activate(
    page.getByRole("button", { name: "JSONを直接取り込む", exact: true }),
  );
  const source = page.getByRole("textbox", { name: "JSON", exact: true });
  for (const [value, message] of [
    ["{", "構文"],
    [JSON.stringify({ version: 2 }), "version"],
    [roadmapJSON([{ title: "原因", goal: "" }]), "items[0].goal"],
    [
      roadmapJSON([{ title: "原因", goal: "説明" }]).replace("世界史", "数学"),
      "subject",
    ],
  ]) {
    await source.fill(value);
    await activate(
      page.getByRole("button", { name: "プレビュー", exact: true }),
    );
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
      message,
    );
    await expect(page.locator(".roadmap-item")).toHaveCount(1);
  }
  await source.fill(
    roadmapJSON([
      { title: "既存の項目", goal: "別の目標" },
      { title: "影響", goal: "変化を説明できる" },
      { title: "影響", goal: "変化を比較できる" },
    ]),
  );
  await activate(page.getByRole("button", { name: "プレビュー", exact: true }));
  await expect(page.getByText("既存項目と重複", { exact: true })).toBeVisible();
  await expect(
    page.getByText("取り込み内で重複", { exact: true }),
  ).toBeVisible();
  await activate(
    page.getByRole("button", { name: "項目を追加する", exact: true }),
  );
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "重複",
  );
  await expect(page.locator(".roadmap-item")).toHaveCount(1);
  await activate(
    page.getByRole("checkbox", { name: "重複した項目も追加する", exact: true }),
  );
  await activate(
    page.getByRole("button", { name: "項目を追加する", exact: true }),
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".item-title-state > span:first-child")).toHaveText(
    ["既存の項目", "既存の項目", "影響", "影響"],
  );
  await page.reload();
  await activate(
    page.getByRole("link", { name: "既存の項目", exact: true }).first(),
  );
  await expect(page.locator(".item-detail-goal")).toContainText(
    "自分の言葉で説明できる",
  );
});

test("Phase 2 failed batch import leaves no partial rows and clipboard denial keeps a selectable prompt", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const add = IDBObjectStore.prototype.add;
    let count = 0;
    IDBObjectStore.prototype.add = function (
      ...args: Parameters<IDBObjectStore["add"]>
    ) {
      if (
        this.name === "items" &&
        String((args[0] as { title?: string }).title).startsWith("取込") &&
        ++count === 2
      )
        throw new DOMException("Quota", "QuotaExceededError");
      return add.apply(this, args);
    };
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new DOMException("Denied", "NotAllowedError");
        },
      },
    });
  });
  await page.goto("/");
  await createTheme(page);
  await openRoadmap(page);
  await addItem(page, "残す項目");
  await activate(
    page.getByRole("button", { name: "JSONを直接取り込む", exact: true }),
  );
  await page.getByRole("textbox", { name: "JSON", exact: true }).fill(
    roadmapJSON([
      { title: "取込A", goal: "目標A" },
      { title: "取込B", goal: "目標B" },
    ]),
  );
  await activate(page.getByRole("button", { name: "プレビュー", exact: true }));
  await activate(
    page.getByRole("button", { name: "項目を追加する", exact: true }),
  );
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "既存の項目は変更していません",
  );
  await expect(
    page.getByRole("list", { name: "取り込みプレビュー" }),
  ).toContainText("取込A");
  await activate(page.getByRole("button", { name: "閉じる", exact: true }));
  await expect(
    page.getByRole("heading", { name: "フランス革命", level: 1 }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".item-title-state > span:first-child")).toHaveText(
    ["残す項目"],
  );
  await openRoadmap(page);
  await activate(
    page.getByRole("button", { name: "AIでロードマップを作成", exact: true }),
  );
  // The unfinished import resumes; Back returns to prompt conditions without losing JSON.
  await activate(page.getByRole("button", { name: "戻る", exact: true }));
  await activate(page.getByRole("button", { name: "戻る", exact: true }));
  await activate(
    page.getByRole("button", { name: "プロンプトを確認", exact: true }),
  );
  await activate(
    page.getByRole("button", { name: "プロンプトをコピー", exact: true }),
  );
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "コピーできませんでした",
  );
  await expect(
    page.getByLabel("生成したプロンプト", { exact: true }),
  ).toHaveValue(/version/);
  await activate(
    page.getByRole("button", { name: "プロンプトを選択", exact: true }),
  );
  const selection = await page
    .getByLabel("生成したプロンプト", { exact: true })
    .evaluate((node: HTMLTextAreaElement) => ({
      start: node.selectionStart,
      end: node.selectionEnd,
      length: node.value.length,
    }));
  expect(selection.start).toBe(0);
  expect(selection.end).toBe(selection.length);
});

async function waitForDraft(page: Page) {
  await expect(page.getByRole("status", { name: "下書き状況" })).toHaveText(
    "下書き保存済み",
  );
}
async function expectNoDraft(page: Page, themeId: string) {
  expect(
    await page.evaluate(
      async (id) =>
        new Promise<unknown>((resolve, reject) => {
          const request = indexedDB.open("yohaku-study");
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction("roadmap-drafts");
            const read = tx.objectStore("roadmap-drafts").get(id);
            read.onsuccess = () => resolve(read.result ?? null);
            tx.oncomplete = () => db.close();
          };
        }),
      themeId,
    ),
  ).toBeNull();
}
test("unified AI workflow restores conditions, copied prompt, JSON and preview after leaving the app or reloading, then clears the draft on registration", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async () => {} },
    }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await createTheme(page);
  await openRoadmap(page);
  const roadmapUrl = page.url();
  const themeId = new URL(roadmapUrl).pathname.split("/")[2];
  await addItem(page, "既存項目");
  await activate(
    page.getByRole("button", { name: "AIでロードマップを作成", exact: true }),
  );
  await page
    .getByLabel("生成用の到達目標", { exact: true })
    .fill("原因と結果のつながりを説明できる");
  await page
    .getByLabel("学習レベル", { exact: true })
    .selectOption("university");
  await page.getByLabel("補足情報").fill("初学者向けに");
  await waitForDraft(page);
  await page.reload();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByLabel("生成用の到達目標", { exact: true }),
  ).toHaveValue("原因と結果のつながりを説明できる");
  await expect(page.getByLabel("学習レベル", { exact: true })).toHaveValue(
    "university",
  );
  await expect(page.getByLabel("補足情報")).toHaveValue("初学者向けに");
  await activate(
    page.getByRole("button", { name: "プロンプトを確認", exact: true }),
  );
  const prompt = await page
    .getByLabel("生成したプロンプト", { exact: true })
    .inputValue();
  await activate(
    page.getByRole("button", { name: "プロンプトをコピー", exact: true }),
  );
  await expect(page.getByRole("status", { name: "コピー状況" })).toHaveText(
    "コピーしました",
  );
  await expect(
    page.locator('.workflow-steps [aria-current="step"]'),
  ).toContainText("外部AIで生成");
  await expect(
    page.getByRole("textbox", { name: "JSON", exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: test.info().outputPath("ai-roadmap-copied.png"),
  });
  await waitForDraft(page);
  await page.goto("about:blank");
  await page.goBack();
  await page.reload();
  await expect(
    page.getByLabel("生成したプロンプト", { exact: true }),
  ).toHaveValue(prompt);
  await expect(page.getByRole("status", { name: "コピー状況" })).toHaveText(
    "コピーしました",
  );
  await activate(
    page.getByRole("button", { name: "JSONの貼り付けへ進む", exact: true }),
  );
  await page
    .getByRole("textbox", { name: "JSON", exact: true })
    .fill("{ unfinished JSON");
  await waitForDraft(page);
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "JSON", exact: true }),
  ).toHaveValue("{ unfinished JSON");
  await expect(
    page.locator('.workflow-steps [aria-current="step"]'),
  ).toContainText("JSON登録");
  const source = roadmapJSON([
    { title: "革命の背景", goal: "身分制度と税負担の関係を説明できる" },
  ]);
  await page.getByRole("textbox", { name: "JSON", exact: true }).fill(source);
  await activate(page.getByRole("button", { name: "プレビュー", exact: true }));
  await waitForDraft(page);
  await page.reload();
  await expect(
    page.getByRole("list", { name: "取り込みプレビュー" }),
  ).toContainText("革命の背景");
  await page.screenshot({
    path: test.info().outputPath("ai-roadmap-preview.png"),
  });
  await activate(page.getByRole("button", { name: "戻る", exact: true }));
  await expect(
    page.getByRole("textbox", { name: "JSON", exact: true }),
  ).toHaveValue(source);
  await activate(page.getByRole("button", { name: "戻る", exact: true }));
  await expect(
    page.getByLabel("生成したプロンプト", { exact: true }),
  ).toHaveValue(prompt);
  await activate(page.getByRole("button", { name: "戻る", exact: true }));
  await expect(page.getByLabel("補足情報")).toHaveValue("初学者向けに");
  await activate(
    page.getByRole("button", { name: "プロンプトを確認", exact: true }),
  );
  await activate(
    page.getByRole("button", { name: "JSONの貼り付けへ進む", exact: true }),
  );
  await activate(page.getByRole("button", { name: "プレビュー", exact: true }));
  await activate(
    page.getByRole("button", { name: "項目を追加する", exact: true }),
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expectNoDraft(page, themeId);
  await page.reload();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".item-title-state > span:first-child")).toHaveText(
    ["既存項目", "革命の背景"],
  );
  await expect(
    page.getByRole("region", { name: "テーマ全体の到達目標" }),
  ).toContainText("背景と影響");
  await activate(
    page.getByRole("button", { name: "AIでロードマップを作成", exact: true }),
  );
  await expect(page.getByLabel("補足情報")).toHaveValue("");
  await expect(
    page.getByLabel("生成用の到達目標", { exact: true }),
  ).toHaveValue("背景と影響");
});
test("direct JSON entry, cancellation and theme-specific drafts stay isolated; preview restoration requires fresh duplicate approval", async ({
  page,
}) => {
  await page.goto("/");
  await createTheme(page);
  const firstTheme = page.url();
  await openRoadmap(page);
  const firstRoadmap = page.url();
  await addItem(page, "残す項目");
  await activate(
    page.getByRole("button", { name: "JSONを直接取り込む", exact: true }),
  );
  const source = roadmapJSON([
    { title: "残す項目", goal: "重複でも元データは変えない" },
  ]);
  await page.getByRole("textbox", { name: "JSON", exact: true }).fill(source);
  await activate(page.getByRole("button", { name: "プレビュー", exact: true }));
  await activate(
    page.getByRole("checkbox", { name: "重複した項目も追加する", exact: true }),
  );
  await waitForDraft(page);
  await page.reload();
  await expect(
    page.getByRole("list", { name: "取り込みプレビュー" }),
  ).toContainText("残す項目");
  await expect(
    page.getByRole("checkbox", { name: "重複した項目も追加する", exact: true }),
  ).not.toBeChecked();
  await activate(page.getByRole("button", { name: "閉じる", exact: true }));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // Read the persisted active flag before navigating away.
  await expect
    .poll(async () =>
      page.evaluate(
        async () =>
          new Promise<boolean>((resolve) => {
            const r = indexedDB.open("yohaku-study");
            r.onsuccess = () => {
              const db = r.result;
              const tx = db.transaction("roadmap-drafts");
              const q = tx.objectStore("roadmap-drafts").getAll();
              q.onsuccess = () =>
                resolve(q.result.every((v: { active: boolean }) => !v.active));
              tx.oncomplete = () => db.close();
            };
          }),
      ),
    )
    .toBe(true);
  await page.reload();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/");
  await createTheme(page, "微分", "数学");
  await openRoadmap(page);
  const secondRoadmap = page.url();
  await activate(
    page.getByRole("button", { name: "AIでロードマップを作成", exact: true }),
  );
  await expect(page.getByLabel("科目", { exact: true })).toHaveValue("数学");
  await page.getByLabel("補足情報").fill("数学だけのメモ");
  await waitForDraft(page);
  await page.goto(firstRoadmap);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await activate(
    page.getByRole("button", { name: "AIでロードマップを作成", exact: true }),
  );
  await expect(
    page.getByRole("list", { name: "取り込みプレビュー" }),
  ).toContainText("残す項目");
  await activate(page.getByRole("button", { name: "戻る", exact: true }));
  await expect(
    page.getByRole("textbox", { name: "JSON", exact: true }),
  ).toHaveValue(source);
  await waitForDraft(page);
  await page.goto(secondRoadmap);
  await expect(page.getByLabel("補足情報")).toHaveValue("数学だけのメモ");
  await page.goto(firstTheme);
  await expect(page.locator(".item-title-state > span:first-child")).toHaveText(
    ["残す項目"],
  );
});
test("draft write failures retain input and retry without importing or changing learning items", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (
      ...args: Parameters<IDBObjectStore["put"]>
    ) {
      if (
        this.name === "roadmap-drafts" &&
        (window as Window & { failDraft?: boolean }).failDraft
      )
        throw new DOMException("Quota", "QuotaExceededError");
      return put.apply(this, args);
    };
  });
  await page.goto("/");
  await createTheme(page);
  await openRoadmap(page);
  await addItem(page, "変更しない項目");
  await activate(
    page.getByRole("button", { name: "JSONを直接取り込む", exact: true }),
  );
  await waitForDraft(page);
  await page.evaluate(() => {
    (window as Window & { failDraft?: boolean }).failDraft = true;
  });
  await page
    .getByRole("textbox", { name: "JSON", exact: true })
    .fill("{ 下書きエラーでも残す");
  await expect(page.getByRole("alert")).toContainText("下書きを保存できません");
  await expect(
    page.getByRole("textbox", { name: "JSON", exact: true }),
  ).toHaveValue("{ 下書きエラーでも残す");
  await page.evaluate(() => {
    (window as Window & { failDraft?: boolean }).failDraft = false;
  });
  await activate(
    page.getByRole("button", { name: "下書きを再試行", exact: true }),
  );
  await waitForDraft(page);
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "JSON", exact: true }),
  ).toHaveValue("{ 下書きエラーでも残す");
  await expect(page.locator(".item-title-state > span:first-child")).toHaveText(
    ["変更しない項目"],
  );
});
