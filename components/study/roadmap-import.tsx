"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Theme } from "@/lib/model";
import {
  assertRoadmapContext,
  findRoadmapDuplicates,
  parseRoadmapJSON,
  roadmapExample,
  ROADMAP_MAX_JSON_LENGTH,
  type RoadmapDocument,
} from "@/lib/roadmap-json";
import { studyRepository } from "@/lib/storage";
import { EditorDialog } from "./editor-dialog";
import { useStudy } from "./provider";
export function RoadmapImport({
  theme,
  subject,
  open,
  onClose,
  onImported,
}: {
  theme: Theme;
  subject: string;
  open: boolean;
  onClose: () => void;
  onImported: (count: number) => void;
}) {
  const { items, refresh } = useStudy();
  const [source, setSource] = useState("");
  const [document, setDocument] = useState<RoadmapDocument>();
  const [allowDuplicates, setAllowDuplicates] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      setSource("");
      setDocument(undefined);
      setAllowDuplicates(false);
      setError("");
    }
    wasOpen.current = open;
  }, [open]);
  const duplicates = document
    ? findRoadmapDuplicates(
        document.items,
        items.filter((item) => item.themeId === theme.id),
      )
    : [];
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    setError("");
    if (!document) {
      try {
        const parsed = parseRoadmapJSON(source);
        assertRoadmapContext(parsed, subject, theme.name);
        setDocument(parsed);
        setAllowDuplicates(false);
      } catch (error) {
        setError((error as Error).message);
      }
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
      const added = await studyRepository.importRoadmap(
        theme.id,
        source,
        allowDuplicates,
      );
      await refresh();
      onImported(added.length);
      onClose();
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
  return (
    <EditorDialog
      open={open}
      onClose={onClose}
      title={document ? "取り込む項目を確認" : "JSONを取り込む"}
      onSubmit={submit}
      saveLabel={document ? "項目を追加する" : "プレビュー"}
      busy={busy}
      error={error}
      onBack={
        document
          ? () => {
              setDocument(undefined);
              setAllowDuplicates(false);
              setError("");
            }
          : undefined
      }
    >
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
          <div>
            <label htmlFor="roadmap-json">JSON</label>
            <textarea
              id="roadmap-json"
              className="json-source"
              rows={12}
              maxLength={ROADMAP_MAX_JSON_LENGTH}
              value={source}
              onChange={(event) => setSource(event.target.value)}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="外部AIが生成したJSONを貼り付け"
            />
          </div>
          <details className="json-format">
            <summary>受け付けるJSON形式（version 1）</summary>
            <pre>
              {JSON.stringify(roadmapExample(subject, theme.name), null, 2)}
            </pre>
          </details>
        </>
      )}
    </EditorDialog>
  );
}
