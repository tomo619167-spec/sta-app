import { FocusTimerScreen } from "@/components/study/focus-timer";
import type { FocusTargetType } from "@/lib/focus";
export const metadata = { title: "集中タイマー" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; target?: string }>;
}) {
  const { type, target } = await searchParams;
  const valid =
    typeof type === "string" &&
    ["subject", "theme", "item"].includes(type) &&
    typeof target === "string";
  return (
    <FocusTimerScreen
      key={valid ? `${type}:${target}` : "none"}
      initialType={valid ? (type as FocusTargetType) : "none"}
      initialId={valid ? target : null}
    />
  );
}
