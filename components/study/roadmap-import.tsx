"use client";
import { JSONSource } from "./json-source";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Theme } from "@/lib/model";
import {
  assertRoadmapContext,
  findRoadmapDuplicates,
  parseRoadmapJSON,
  roadmapExample,
} from "@/lib/roadmap-json";
import { studyRepository } from "@/lib/storage";
import { useStudy } from "./provider";
export function useRoadmapImport({
  theme,
  subject,
  source,
  preview,
  onPreview,
  beforeImport,
  onImported,
}: {
  theme: Theme;
  subject: string;
  source: string;
  preview: boolean;
  onPreview: () => void;
  beforeImport: () => Promise<void>;
  onImported: (count: number) => void;
}) {
  const { items, refresh } = useStudy();
  const [allowDuplicates, setAllowDuplicates] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    setAllowDuplicates(false);
    setError("");
  }, [source, preview]);
  const checked = useMemo(() => {
    if (!preview) return {};
    try {
      const document = parseRoadmapJSON(source);
      assertRoadmapContext(document, subject, theme.name);
      return { document };
    } catch (error) {
      return { error: (error as Error).message };
    }
  }, [source, preview, subject, theme.name]);
  const document = checked.document;
  const duplicates = document
    ? findRoadmapDuplicates(
        document.items,
        items.filter((item) => item.themeId === theme.id),
      )
    : [];
  async function submit() {
    if (lock.current) return;
    setError("");
    if (!preview) {
      try {
        const parsed = parseRoadmapJSON(source);
        assertRoadmapContext(parsed, subject, theme.name);
        setAllowDuplicates(false);
        onPreview();
      } catch (error) {
        setError((error as Error).message);
      }
      return;
    }
    if (!document) {
      setError(checked.error ?? "JSONを確認してください。");
      return;
    }
    if (duplicates.length && !allowDuplicates) {
      setError(
        "重複した項目を確認してください。追加する場合はチェックしてください。",
      );
      return;
    }
    lock.current = true;
    setBusy(true);
    try {
      await beforeImport();
      const added = await studyRepository.importRoadmap(
        theme.id,
        source,
        allowDuplicates,
      );
      await refresh();
      onImported(added.length);
    } catch (error) {
      setError(
        error instanceof Error &&
          /JSON|version|items|subject|theme|同じ名前|科目|テーマ/.test(
            error.message,
          )
          ? error.message
          : "追加できませんでした。既存の項目は変更していません。",
      );
      await refresh();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return {
    document,
    duplicates,
    allowDuplicates,
    setAllowDuplicates,
    busy,
    error: error || checked.error || "",
    submit,
  };
}
export function RoadmapImport({
  theme,
  subject,
  source,
  onSourceChange,
  importer,
}: {
  theme: Theme;
  subject: string;
  source: string;
  onSourceChange: (value: string) => void;
  importer: ReturnType<typeof useRoadmapImport>;
}) {
  const { document, duplicates, allowDuplicates, setAllowDuplicates, busy } =
    importer;
  return (
    <fieldset className="workflow-fields" disabled={busy}>
      {document ? (
        <>
          <div className="target-summary">
            <span>{subject}</span>
            <strong>{theme.name}</strong>
          </div>
          <p className="roadmap-hint">
            {document.items.length}項目を、既存項目の後に追加します。
          </p>
          <ol className="import-preview" aria-label="取り込みプレビュー">
            {document.items.map((item, index) => {
              const duplicate = duplicates.find(
                (entry) => entry.index === index,
              );
              return (
                <li key={index}>
                  <strong>
                    {index + 1}. {item.title}
                  </strong>
                  <p>{item.goal}</p>
                  {duplicate && (
                    <span className="duplicate-label">
                      {duplicate.existing
                        ? "既存項目と重複"
                        : "取り込み内で重複"}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
          {duplicates.length > 0 && (
            <label className="import-duplicate-confirm">
              <input
                type="checkbox"
                checked={allowDuplicates}
                onChange={(event) => setAllowDuplicates(event.target.checked)}
                disabled={busy}
              />
              <span>重複した項目も追加する</span>
            </label>
          )}
        </>
      ) : (
        <>
          <div className="target-summary">
            <span>{subject}</span>
            <strong>{theme.name}</strong>
          </div>
          <JSONSource
            value={source}
            onChange={onSourceChange}
            example={roadmapExample(subject, theme.name)}
          />
        </>
      )}
    </fieldset>
  );
}
