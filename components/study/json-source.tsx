"use client";
export function JSONSource({
  value,
  onChange,
  example,
  version = 1,
}: {
  value: string;
  onChange: (value: string) => void;
  example: unknown;
  version?: 1 | 2 | 3;
}) {
  return (
    <>
      <div>
        <label htmlFor="import-json-source">JSON</label>
        <textarea
          id="import-json-source"
          className="json-source"
          rows={12}
          maxLength={100000}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="外部AIが生成したJSONを貼り付け"
        />
      </div>
      <details className="json-format">
        <summary>受け付けるJSON形式（version {version}）</summary>
        <pre>{JSON.stringify(example, null, 2)}</pre>
      </details>
    </>
  );
}
