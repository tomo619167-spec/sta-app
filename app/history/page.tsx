import { HistoryScreen } from "@/components/study/history";
export const metadata = { title: "学習ノート" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    theme?: string | string[];
    item?: string | string[];
  }>;
}) {
  const { theme, item } = await searchParams;
  return (
    <HistoryScreen
      key={`${theme ?? ""}:${item ?? ""}`}
      initialTheme={Array.isArray(theme) ? "invalid-scope" : theme}
      initialItem={Array.isArray(item) ? "invalid-scope" : item}
    />
  );
}
