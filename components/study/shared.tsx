import Link from "next/link";
import { ArrowUpRight, BookOpen, ArrowLeft } from "lucide-react";
import { type StudyItem } from "@/lib/model";
import { masteryCounts, outputLabel } from "@/lib/ratings";
import type { MasteryChange } from "@/lib/model";
import { MasterySegments } from "./mastery-segments";
import { Button } from "@/components/ui/button";
export function BackLink({
  href = "/",
  children = "ホーム",
}: {
  href?: string;
  children?: React.ReactNode;
}) {
  return (
    <Link href={href} className="back-link">
      <ArrowLeft size={16} />
      {children}
    </Link>
  );
}
export function Progress({
  items,
  label,
  history,
}: {
  items: StudyItem[];
  label: string;
  history: MasteryChange[];
}) {
  return (
    <MasterySegments counts={masteryCounts(items, history)} label={label} />
  );
}
export function EmptyThemes({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="empty-state">
      <BookOpen size={30} strokeWidth={1} />
      <h2>最初の学びを。</h2>
      <Button onClick={onCreate}>
        テーマを追加
        <ArrowUpRight />
      </Button>
    </div>
  );
}
export { RecordList } from "./record-list";
