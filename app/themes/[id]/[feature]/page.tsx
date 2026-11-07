import { FeatureScreen } from "@/components/study/detail";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string; feature: string }>;
}) {
  const { id, feature } = await params;
  return <FeatureScreen id={id} slug={feature} />;
}
