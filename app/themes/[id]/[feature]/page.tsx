import { FeatureScreen } from "@/components/study/detail";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; feature: string }>;
  searchParams: Promise<{ item?: string | string[] }>;
}) {
  const { id, feature } = await params;
  const { item } = await searchParams;
  return (
    <FeatureScreen
      id={id}
      slug={feature}
      itemId={Array.isArray(item) ? "" : item}
    />
  );
}
