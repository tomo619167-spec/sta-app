import { SubjectExamsScreen } from "@/components/study/subject-exams";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ theme?: string | string[] }>;
}) {
  const { id } = await params;
  const { theme } = await searchParams;
  return (
    <SubjectExamsScreen
      subjectId={id}
      themeId={Array.isArray(theme) ? "" : theme}
    />
  );
}
