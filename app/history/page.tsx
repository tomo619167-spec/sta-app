import { HistoryScreen } from "@/components/study/history";
export const metadata = { title: "学習記録" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ theme?: string }>;
}) {
  const { theme } = await searchParams;
  return <HistoryScreen key={theme ?? ""} initialTheme={theme} />;
}
