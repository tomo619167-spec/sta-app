import { expect, test, type Locator, type Page } from "@playwright/test";
import { drawingPatterns } from "../../components/study/focus-notebook/drawing-pattern";
const epoch = Date.parse("2026-11-15T09:00:00Z");
const art = (page: Page) => page.locator(".focus-notebook svg");
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
async function setup(
  page: Page,
  mode: "simple" | "pomodoro" = "simple",
  fixed = true,
) {
  if (fixed) await page.clock.setFixedTime(new Date(epoch));
  await page.goto("/timer");
  await expect(
    page.getByRole("button", { name: "開始", exact: true }),
  ).toBeEnabled();
  if (mode === "pomodoro")
    await activate(
      page.getByRole("button", { name: "ポモドーロ", exact: true }),
    );
  await activate(
    page.getByRole("button", { name: "タイマー設定", exact: true }),
  );
  for (const label of ["シンプル（分）", "集中（分）", "短い休憩（分）"])
    await page.getByLabel(label, { exact: true }).fill("1");
  await activate(page.getByRole("button", { name: "保存", exact: true }));
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function advance(page: Page, ms: number) {
  await page.clock.setFixedTime(new Date(epoch + ms));
}
async function progress(page: Page, value: number) {
  await art(page).scrollIntoViewIfNeeded();
  await expect
    .poll(async () => Number(await art(page).getAttribute("data-progress")))
    .toBeCloseTo(value, 4);
}
async function snapshot(page: Page) {
  return art(page).evaluate((svg) => ({
    id: svg.getAttribute("data-page-id"),
    pattern: svg.getAttribute("data-pattern"),
    progress: Number(svg.getAttribute("data-progress")),
    pen: svg.querySelector("[data-notebook-pencil]")!.getAttribute("transform"),
    ink: Array.from(svg.querySelectorAll("[data-notebook-stroke]")).map(
      (path) => path.getAttribute("stroke-dashoffset"),
    ),
  }));
}
async function assertTip(page: Page) {
  const sample = await art(page).evaluate((svg) => {
    const paths = Array.from(
      svg.querySelectorAll<SVGPathElement>("[data-notebook-stroke]"),
    );
    const index = Number(svg.getAttribute("data-stroke-index"));
    const fraction = Number(svg.getAttribute("data-stroke-fraction"));
    const lift = Number(svg.getAttribute("data-pen-lift"));
    const point = paths[index].getPointAtLength(
      paths[index].getTotalLength() * fraction,
    );
    if (lift > 0 && paths[index + 1]) {
      const next = paths[index + 1].getPointAtLength(0);
      point.x += (next.x - point.x) * lift;
      point.y += (next.y - point.y) * lift;
    }
    const transform = svg
      .querySelector<SVGGElement>("[data-notebook-pencil]")!
      .transform.baseVal.consolidate()!.matrix;
    return {
      distance: Math.hypot(point.x - transform.e, point.y - transform.f),
      ink: Number(paths[index].getAttribute("stroke-dashoffset")),
      fraction,
      lift,
    };
  });
  expect(sample.distance).toBeLessThan(0.05);
  expect(sample.ink).toBeCloseTo(1 - sample.fraction, 5);
}

test("notebook is blank before start, tracks the pen tip, pauses, resumes and restores a partial page without writing animation data", async ({
  page,
}) => {
  await setup(page);
  await progress(page, 0);
  await page.screenshot({ path: test.info().outputPath("idle-notebook.png") });
  const blank = await snapshot(page);
  expect(blank.ink.every((value) => Number(value) === 1)).toBe(true);
  await expect(page.locator(".focus-notebook")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
  await activate(page.getByRole("button", { name: "開始", exact: true }));
  await progress(page, 0);
  const initial = await snapshot(page);
  expect(initial.id).not.toBe("blank");
  const before = await rows(page, "focus-state");
  for (const ms of [7000, 14000, 22000]) {
    await advance(page, ms);
    await progress(page, ms / 60000);
    await assertTip(page);
  }
  await expect(page.getByRole("timer", { name: "残り時間" })).toHaveText(
    "00:38",
  );
  await page.screenshot({
    path: test.info().outputPath("running-notebook.png"),
  });
  expect(await rows(page, "focus-state")).toEqual(before);
  expect(await rows(page, "focus-sessions")).toHaveLength(0);
  await activate(page.getByRole("button", { name: "一時停止", exact: true }));
  await progress(page, 22 / 60);
  const paused = await snapshot(page);
  await advance(page, 40000);
  await progress(page, 22 / 60);
  expect(await snapshot(page)).toEqual(paused);
  await page.reload();
  await progress(page, 22 / 60);
  expect(await snapshot(page)).toEqual(paused);
  await activate(page.getByRole("button", { name: "再開", exact: true }));
  await advance(page, 48000);
  await progress(page, 0.5);
  await assertTip(page);
  await activate(page.getByRole("button", { name: "終了", exact: true }));
  await progress(page, 0.5);
  await activate(
    page.getByRole("button", { name: "集中時間を保存", exact: true }),
  );
  await progress(page, 0.5);
  await expect(page.locator(".focus-result")).toHaveText("0分30秒");
  expect((await rows(page, "focus-sessions"))[0].actualFocusSeconds).toBe(30);
  const partial = await snapshot(page);
  await advance(page, 900000);
  await page.reload();
  await progress(page, 0.5);
  expect(await snapshot(page)).toEqual(partial);
  await page.screenshot({
    path: test.info().outputPath("partial-notebook.png"),
  });
});

test("simple completion finishes every stroke, displays the check and keeps one completed record after reload", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date(epoch));
  await page.goto("/timer");
  await activate(page.getByRole("button", { name: "15分", exact: true }));
  await activate(page.getByRole("button", { name: "開始", exact: true }));
  await progress(page, 0);
  const initial = await snapshot(page);
  await advance(page, 905000);
  await progress(page, 1);
  await expect(page.locator(".focus-completion")).toContainText(
    "集中おつかれさまでした",
  );
  const finished = await snapshot(page);
  expect(finished.id).toBe(initial.id);
  expect(finished.ink.every((value) => Number(value) === 0)).toBe(true);
  await expect(page.locator("[data-notebook-check]")).toHaveCSS(
    "visibility",
    "visible",
  );
  await assertTip(page);
  const records = await rows(page, "focus-sessions");
  expect(records).toHaveLength(1);
  expect(records[0].actualFocusSeconds).toBe(900);
  await page.reload();
  await progress(page, 1);
  expect(await snapshot(page)).toEqual(finished);
  expect(await rows(page, "focus-sessions")).toEqual(records);
  await page.screenshot({
    path: test.info().outputPath("complete-notebook.png"),
  });
});

test("pomodoro holds a completed page during rest, starts a fresh set page and preserves a discarded partial drawing", async ({
  page,
}) => {
  await setup(page, "pomodoro");
  await activate(page.getByRole("button", { name: "開始", exact: true }));
  await progress(page, 0);
  const first = await snapshot(page);
  await advance(page, 60000);
  await progress(page, 1);
  await activate(
    page.getByRole("button", { name: "短い休憩を開始", exact: true }),
  );
  await progress(page, 1);
  const rest = await snapshot(page);
  expect(rest.id).toBe(first.id);
  await advance(page, 90000);
  await progress(page, 1);
  expect(await snapshot(page)).toEqual(rest);
  await page.reload();
  await progress(page, 1);
  expect(await snapshot(page)).toEqual(rest);
  await advance(page, 120000);
  await expect(
    page.getByRole("button", { name: "次の集中を開始", exact: true }),
  ).toBeVisible();
  await activate(
    page.getByRole("button", { name: "次の集中を開始", exact: true }),
  );
  await progress(page, 0);
  const next = await snapshot(page);
  expect(next.id).not.toBe(first.id);
  await expect(page.locator(".notebook-page-number")).toHaveText("SET 02");
  expect(next.ink.every((value) => Number(value) === 1)).toBe(true);
  await advance(page, 135000);
  await progress(page, 0.25);
  await activate(page.getByRole("button", { name: "終了", exact: true }));
  await activate(
    page.getByRole("button", { name: "今回のセットを破棄", exact: true }),
  );
  await progress(page, 0.25);
  const partial = await snapshot(page);
  await page.reload();
  await progress(page, 0.25);
  expect(await snapshot(page)).toEqual(partial);
  expect(await rows(page, "focus-sessions")).toHaveLength(1);
});

test("reduced motion parks the pencil, updates static ink and can change live without modifying the timer", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await setup(page);
  await activate(page.getByRole("button", { name: "開始", exact: true }));
  await progress(page, 0);
  await expect(art(page)).toHaveAttribute("data-reduced-motion", "true");
  const initial = await snapshot(page);
  const state = await rows(page, "focus-state");
  await advance(page, 15000);
  await progress(page, 0.25);
  expect((await snapshot(page)).pen).toBe(initial.pen);
  await advance(page, 30000);
  await progress(page, 0.5);
  const mid = await snapshot(page);
  expect(mid.pen).toBe(initial.pen);
  expect(mid.ink).not.toEqual(initial.ink);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(art(page)).toHaveAttribute("data-reduced-motion", "false");
  await progress(page, 0.5);
  await assertTip(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(art(page)).toHaveAttribute("data-reduced-motion", "true");
  expect((await snapshot(page)).pen).toBe(initial.pen);
  expect(await rows(page, "focus-state")).toEqual(state);
  await expect(page.getByRole("timer", { name: "残り時間" })).toHaveText(
    "00:30",
  );
});

test("hidden or offscreen notebooks stop painting and catch up from the timer when visible", async ({
  page,
}) => {
  await setup(page);
  await activate(page.getByRole("button", { name: "開始", exact: true }));
  await advance(page, 6000);
  await progress(page, 0.1);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const hidden = await snapshot(page);
  await advance(page, 20000);
  await page.waitForTimeout(650);
  expect(await snapshot(page)).toEqual(hidden);
  await page.evaluate(() => {
    Reflect.deleteProperty(document, "hidden");
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await progress(page, 1 / 3);
  await page.setViewportSize({ width: 320, height: 400 });
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  await expect(art(page)).not.toBeInViewport();
  await page.waitForTimeout(100);
  const offscreen = await snapshot(page);
  await advance(page, 25000);
  await page.waitForTimeout(650);
  expect(await snapshot(page)).toEqual(offscreen);
  await progress(page, 25 / 60);
  await assertTip(page);
  expect(await rows(page, "focus-sessions")).toHaveLength(0);
});

test("missing SVG geometry keeps timer controls and saved records usable at 320px", async ({
  page,
}) => {
  await page.addInitScript(() => {
    SVGPathElement.prototype.getTotalLength = function () {
      throw new Error("SVG geometry unavailable");
    };
  });
  await page.setViewportSize({ width: 320, height: 640 });
  await setup(page);
  await activate(page.getByRole("button", { name: "開始", exact: true }));
  await advance(page, 15000);
  await progress(page, 0.25);
  await expect(page.locator("[data-notebook-pencil]")).toHaveCSS(
    "visibility",
    "hidden",
  );
  await expect(page.getByRole("timer", { name: "残り時間" })).toHaveText(
    "00:45",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await activate(page.getByRole("button", { name: "終了", exact: true }));
  await activate(
    page.getByRole("button", { name: "集中時間を保存", exact: true }),
  );
  await expect(page.locator(".focus-result")).toHaveText("0分15秒");
  expect(await rows(page, "focus-sessions")).toHaveLength(1);
});

test("foreground ink advances between timer renders and every pattern keeps its pencil inside the responsive drawing area", async ({
  page,
}) => {
  await setup(page, "simple", false);
  await activate(page.getByRole("button", { name: "開始", exact: true }));
  await art(page).scrollIntoViewIfNeeded();
  const changes = await art(page).evaluate(async (svg) => {
    let changes = 0;
    const observer = new MutationObserver((entries) => {
      changes += entries.filter(
        (entry) => entry.attributeName === "stroke-dashoffset",
      ).length;
    });
    observer.observe(svg, { subtree: true, attributes: true });
    await new Promise((resolve) => setTimeout(resolve, 450));
    observer.disconnect();
    return changes;
  });
  expect(changes).toBeGreaterThan(1);
  expect(changes).toBeLessThan(40);
  const bounds = await page.evaluate((patterns) => {
    const root = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    document.body.append(root);
    let safe = true;
    for (const pattern of patterns)
      for (const d of pattern.strokes) {
        const path = document.createElementNS(
          root.namespaceURI,
          "path",
        ) as SVGPathElement;
        path.setAttribute("d", d);
        root.append(path);
        const length = path.getTotalLength();
        for (let i = 0; i <= 40; i++) {
          const point = path.getPointAtLength((length * i) / 40);
          if (
            point.x < 0 ||
            point.x + 32 > 360 ||
            point.y - 36 < -12 ||
            point.y > 176
          )
            safe = false;
        }
        path.remove();
      }
    root.remove();
    return safe;
  }, drawingPatterns);
  expect(bounds).toBe(true);
});
