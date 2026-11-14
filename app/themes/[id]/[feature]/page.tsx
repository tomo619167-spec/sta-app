import { FeatureScreen } from "@/components/study/detail";
import { redirect } from "next/navigation";
import { themeHref } from "@/lib/learning-context";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; feature: string }>;
  searchParams: Promise<{ item?: string | string[]; from?: string | string[] }>;
}) {
  const { id, feature } = await params;
  const { item, from } = await searchParams;
  if (feature === "roadmap")
    redirect(themeHref(id, typeof item === "string" ? item : undefined));
  return (
    <FeatureScreen
      id={id}
      slug={feature}
      itemId={Array.isArray(item) ? "" : item}
      fromTheme={from === "theme"}
    />
  );
}
