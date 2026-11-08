import { RecordDetail } from "@/components/study/record-detail";
export const metadata = { title: "学習記録" };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ai?: string }>;
}) {
  const { id } = await params;
  const { ai } = await searchParams;
  return <RecordDetail id={id} autoAI={ai === "1"} />;
}
