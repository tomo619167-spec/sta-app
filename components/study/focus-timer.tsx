"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  defaultFocusSettings,
  focusDuration,
  focusElapsed,
  focusRemaining,
  focusTotals,
  noFocusTarget,
  resolveFocusTarget,
  timerDisplay,
  validateFocusSettings,
  type FocusSettings,
  type FocusTarget,
  type FocusMode,
} from "@/lib/focus";
import { themeHref } from "@/lib/learning-context";
import { useStudy } from "./provider";
import { useFocusTimer } from "./focus-provider";
import { SegmentedControl } from "./segmented-control";
import { EditorDialog } from "./editor-dialog";
import { DailyActions } from "./daily-actions";

function FocusSettingsForm({
  settings,
  mode,
  onClose,
}: {
  settings: FocusSettings;
  mode: FocusMode;
  onClose: () => void;
}) {
  const { run, busy } = useFocusTimer();
  const [values, setValues] = useState(settings);
  const [error, setError] = useState("");
  async function save(event: FormEvent) {
    event.preventDefault();
    try {
      validateFocusSettings(values);
      if (await run({ type: "configure", mode, settings: values })) onClose();
      else setError("設定を保存できませんでした。再試行してください。");
    } catch (error) {
      setError((error as Error).message);
    }
  }
  return (
    <EditorDialog
      open
      title="タイマー設定"
      onClose={onClose}
      onSubmit={save}
      busy={busy}
      error={error}
    >
      {(
        [
          ["simpleMinutes", "シンプル（分）"],
          ["focusMinutes", "集中（分）"],
          ["shortBreakMinutes", "短い休憩（分）"],
          ["longBreakMinutes", "長い休憩（分）"],
          ["setsUntilLongBreak", "長い休憩までのセット数"],
        ] as const
      ).map(([key, label]) => (
        <label key={key}>
          {label}
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={key === "setsUntilLongBreak" ? 12 : 180}
            step={1}
            required
            value={Number.isNaN(values[key]) ? "" : values[key]}
            onChange={(event) =>
              setValues((old) => ({
                ...old,
                [key]: event.target.valueAsNumber,
              }))
            }
          />
        </label>
      ))}
      <label className="focus-sound">
        <input
          type="checkbox"
          checked={values.sound}
          onChange={(event) =>
            setValues((old) => ({ ...old, sound: event.target.checked }))
          }
        />
        完了音を鳴らす
      </label>
      <p className="muted">
        音は画面表示中に利用できます。スリープ中・バックグラウンドの音や通知は保証されません。
      </p>
    </EditorDialog>
  );
}
export function FocusTimerScreen({
  initialType = "none",
  initialId = null,
}: {
  initialType?: FocusTarget["type"];
  initialId?: string | null;
}) {
  const { state, now, busy, error, run, prepareSound } = useFocusTimer();
  const { subjects, themes, items, focusSessions } = useStudy();
  const router = useRouter();
  const [selected, setSelected] = useState(`${initialType}:${initialId ?? ""}`);
  const [editing, setEditing] = useState(false);
  const [targetError, setTargetError] = useState("");
  const [starting, setStarting] = useState(false);
  const settings = state?.settings ?? defaultFocusSettings;
  const timer = state?.timer;
  const locked = !!timer;
  const mode = timer?.mode ?? state?.mode ?? "simple";
  const total = focusTotals(focusSessions, now ? new Date(now) : new Date());
  const phaseLabel =
    !timer || timer.phase === "focus"
      ? "集中"
      : timer.phase === "shortBreak"
        ? "短い休憩"
        : "長い休憩";
  const remaining = timer
    ? focusRemaining(timer, now)
    : settings.simpleMinutes * 60;
  const done =
    timer?.status === "finished" ||
    (timer?.mode === "simple" && timer.status === "completed");
  const cycleSessions = timer
    ? focusSessions.filter(
        (entry) =>
          entry.id === timer.sessionId ||
          entry.pomodoroCycleId === timer.timerId,
      )
    : [];
  const cycleSeconds = cycleSessions.reduce(
    (sum, entry) => sum + entry.actualFocusSeconds,
    0,
  );
  const actual = timer ? Math.floor(focusElapsed(timer, now) / 1000) : 0;
  const target = timer?.target ?? noFocusTarget;
  const liveTheme = themes.find((entry) => entry.id === target.themeId);
  const liveItem =
    target.type === "item" &&
    items.find(
      (entry) => entry.id === target.id && entry.themeId === target.themeId,
    );
  const canLearn = liveTheme && (target.type === "theme" || liveItem);
  async function start() {
    setTargetError("");
    setStarting(true);
    try {
      const separator = selected.indexOf(":");
      const candidate = {
        type: selected.slice(0, separator) as FocusTarget["type"],
        id: selected.slice(separator + 1) || null,
      };
      const resolved = resolveFocusTarget(candidate, subjects, themes, items);
      if (settings.sound) prepareSound();
      await run({ type: "start", target: resolved });
    } catch (error) {
      setTargetError((error as Error).message);
    } finally {
      setStarting(false);
    }
  }
  async function finish() {
    if (await run({ type: "dismiss" }))
      router.push(liveTheme ? themeHref(liveTheme.id) : "/");
  }
  return (
    <div className="focus-page">
      <header className="focus-heading">
        <h1>集中タイマー</h1>
        <Button
          variant="ghost"
          size="icon"
          aria-label="タイマー設定"
          disabled={!state || locked || busy}
          onClick={() => setEditing(true)}
        >
          <Settings2 size={20} />
        </Button>
      </header>
      <SegmentedControl
        label="タイマーモード"
        value={mode}
        options={[
          { value: "simple", label: "シンプル" },
          { value: "pomodoro", label: "ポモドーロ" },
        ]}
        disabled={!state || locked || busy}
        onChange={(mode) => void run({ type: "configure", mode, settings })}
      />
      {error && (
        <div role="alert">
          <p>{error}</p>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void run({ type: "tick" })}
          >
            再試行
          </Button>
        </div>
      )}
      {!state && !error && <p role="status">タイマーを開いています…</p>}
      {done ? (
        <section className="focus-completion" aria-label="集中の完了">
          <h2>集中おつかれさまでした</h2>
          <p className="focus-result">{focusDuration(cycleSeconds)}</p>
          <p>{target.name}</p>
          {cycleSessions.length > 0 ? (
            <p className="muted">
              集中時間を保存しました
              {timer.mode === "pomodoro"
                ? ` · ${cycleSessions.length}セット`
                : ""}
            </p>
          ) : (
            <p className="muted">記録を残さず終了しました</p>
          )}
          {canLearn ? (
            <DailyActions
              themeId={liveTheme.id}
              itemId={target.type === "item" ? target.id! : undefined}
            />
          ) : (
            <Button asChild>
              <Link href={liveTheme ? themeHref(liveTheme.id) : "/"}>
                学習項目を選ぶ
              </Link>
            </Button>
          )}
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void finish()}
          >
            終了する
          </Button>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => void run({ type: "dismiss" })}
          >
            もう一度集中する
          </Button>
        </section>
      ) : (
        <>
          <section className="focus-clock" aria-label="タイマー">
            <p>
              {phaseLabel}
              {timer?.status === "paused"
                ? " · 一時停止中"
                : timer?.status === "review"
                  ? " · 途中終了"
                  : timer?.status === "completed"
                    ? " · 完了"
                    : ""}
            </p>
            <div
              className="focus-digits"
              role="timer"
              aria-label="残り時間"
              aria-live="off"
            >
              {timerDisplay(
                timer
                  ? remaining
                  : (mode === "simple"
                      ? settings.simpleMinutes
                      : settings.focusMinutes) * 60,
              )}
            </div>
            {mode === "pomodoro" ? (
              <p className="focus-set">
                {timer
                  ? `集中 ${timer.setIndex}セット目`
                  : `${settings.focusMinutes}分集中 / ${settings.shortBreakMinutes}分休憩`}
                <small>
                  {(timer?.settings ?? settings).setsUntilLongBreak}
                  セットごとに長い休憩
                </small>
              </p>
            ) : (
              !timer && (
                <div
                  className="focus-presets"
                  role="group"
                  aria-label="集中時間"
                >
                  {[15, 25, 45].map((minutes) => (
                    <button
                      type="button"
                      key={minutes}
                      aria-pressed={settings.simpleMinutes === minutes}
                      disabled={!state || busy}
                      onClick={() =>
                        void run({
                          type: "configure",
                          mode,
                          settings: { ...settings, simpleMinutes: minutes },
                        })
                      }
                    >
                      {minutes}分
                    </button>
                  ))}
                  <button
                    type="button"
                    aria-pressed={
                      ![15, 25, 45].includes(settings.simpleMinutes)
                    }
                    disabled={!state || busy}
                    onClick={() => setEditing(true)}
                  >
                    自由設定
                  </button>
                </div>
              )
            )}
          </section>
          <section className="focus-target">
            {timer ? (
              <>
                <span>学習対象</span>
                <p>{target.name}</p>
                <small>
                  {target.subjectName}
                  {target.themeName && target.name !== target.themeName
                    ? ` · ${target.themeName}`
                    : ""}
                </small>
              </>
            ) : (
              <>
                <label htmlFor="focus-target">学習対象</label>
                <select
                  id="focus-target"
                  value={selected}
                  onChange={(event) => setSelected(event.target.value)}
                >
                  <option value="none:">指定しない</option>
                  <optgroup label="科目">
                    {subjects.map((entry) => (
                      <option key={entry.id} value={`subject:${entry.id}`}>
                        {entry.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="学習テーマ">
                    {themes.map((entry) => (
                      <option key={entry.id} value={`theme:${entry.id}`}>
                        {entry.name} ·{" "}
                        {
                          subjects.find(
                            (subject) => subject.id === entry.subjectId,
                          )?.name
                        }
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="学習項目">
                    {items.map((entry) => (
                      <option key={entry.id} value={`item:${entry.id}`}>
                        {entry.title} ·{" "}
                        {
                          themes.find((theme) => theme.id === entry.themeId)
                            ?.name
                        }
                      </option>
                    ))}
                  </optgroup>
                </select>
              </>
            )}
            {targetError && <p role="alert">{targetError}</p>}
          </section>
          <div className="focus-actions">
            {!timer ? (
              <Button
                disabled={!state || busy || starting}
                onClick={() => void start()}
              >
                開始
              </Button>
            ) : timer.status === "review" ? (
              <>
                <p>今回の集中時間：{focusDuration(actual)}</p>
                <Button
                  disabled={busy}
                  onClick={() => void run({ type: "save" })}
                >
                  集中時間を保存
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void run({ type: "discard" })}
                >
                  今回のセットを破棄
                </Button>
                {timer.mode === "pomodoro" && (
                  <small>完了済みの集中セットは保存されています。</small>
                )}
              </>
            ) : timer.status === "completed" ? (
              <>
                <p role="status">
                  {timer.phase === "focus"
                    ? `集中時間 ${focusDuration(actual)} を保存しました。`
                    : "休憩が終わりました。"}
                </p>
                <Button
                  disabled={busy}
                  onClick={() => {
                    if (settings.sound) prepareSound();
                    void run({ type: "next" });
                  }}
                >
                  {timer.phase === "focus"
                    ? timer.setIndex % timer.settings.setsUntilLongBreak === 0
                      ? "長い休憩を開始"
                      : "短い休憩を開始"
                    : "次の集中を開始"}
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void run({ type: "end" })}
                >
                  学習サイクルを終了
                </Button>
              </>
            ) : (
              <>
                <Button
                  disabled={busy}
                  onClick={() => {
                    if (settings.sound) prepareSound();
                    void run({
                      type: timer.status === "paused" ? "resume" : "pause",
                    });
                  }}
                >
                  {timer.status === "paused" ? "再開" : "一時停止"}
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void run({ type: "end" })}
                >
                  終了
                </Button>
              </>
            )}
          </div>
        </>
      )}
      <p className="focus-today">
        今日の集中時間 <strong>{focusDuration(total.today)}</strong>
      </p>
      <Link className="text-link" href="/history">
        学習ノートを見る
      </Link>
      <p className="focus-limit">
        画面を離れても時刻から復元します。バックグラウンド・スリープ中の音や通知は保証されません。
      </p>
      {editing && (
        <FocusSettingsForm
          settings={settings}
          mode={mode}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}
