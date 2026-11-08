export function jsonObject(
  value: unknown,
  path: string,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${path}：オブジェクトで指定してください。`);
  return value as Record<string, unknown>;
}
export function jsonKeys(
  value: Record<string, unknown>,
  allowed: string[],
  path: string,
) {
  const unexpected = Object.keys(value).find((key) => !allowed.includes(key));
  if (unexpected)
    throw new Error(
      `${path}.${unexpected}：未対応の項目です。指定された形式を使用してください。`,
    );
}
export function jsonText(value: unknown, path: string, max: number) {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`${path}：空でない文字列が必要です。`);
  if (value.trim().length > max)
    throw new Error(`${path}：${max}文字以内で指定してください。`);
  return value.trim();
}
export function parseJSONDocument(source: string, max = 100000): unknown {
  if (source.length > max)
    throw new Error(
      `JSON：${max.toLocaleString("ja-JP")}文字以内で貼り付けてください。`,
    );
  if (source.trim().startsWith("```"))
    throw new Error(
      "JSONのみを貼り付けてください。先頭と末尾のコードブロック記号（```）は不要です。",
    );
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(
      `JSONの構文を確認してください。引用符・カンマ・括弧に誤りがあります。${error instanceof Error ? `（${error.message.slice(0, 140)}）` : ""}`,
    );
  }
}
export function jsonList(value: unknown, path: string, min = 0, max = 12) {
  if (!Array.isArray(value) || value.length < min || value.length > max)
    throw new Error(`${path}：${min}〜${max}件の配列で指定してください。`);
  return value.map((entry, index) =>
    jsonText(entry, `${path}[${index}]`, 2000),
  );
}
