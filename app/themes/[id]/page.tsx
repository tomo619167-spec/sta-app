import { DetailScreen } from "@/components/study/detail";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ item?: string | string[] }>;
}) {
  const { id } = await params;
  const { item } = await searchParams;
  return (
    <DetailScreen
      id={id}
      initialItemId={Array.isArray(item) ? undefined : item}
    />
  );
}
