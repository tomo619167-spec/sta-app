import { RoadmapManager } from "@/components/study/roadmap-manager";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RoadmapManager themeId={id} />;
}
