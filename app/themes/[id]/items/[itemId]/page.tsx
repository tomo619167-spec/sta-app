import { ItemDetail } from "@/components/study/item-detail";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string; itemId: string }>;
}) {
  const { id, itemId } = await params;
  return <ItemDetail themeId={id} itemId={itemId} />;
}
