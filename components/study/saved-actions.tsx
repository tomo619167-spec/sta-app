import Link from "next/link";
import { Button } from "@/components/ui/button";
import { studyReturnHref, themeHref } from "@/lib/learning-context";
import type { StudyTarget } from "@/lib/model";
export function SavedActions({
  themeId,
  target,
  children,
}: {
  themeId: string;
  target: StudyTarget;
  children?: React.ReactNode;
}) {
  return (
    <section className="saved-actions" aria-label="保存後の操作">
      <p role="status">保存しました</p>
      <Button asChild>
        <Link href={themeHref(themeId)} scroll={false}>
          {target.type === "item" ? "学習項目一覧へ戻る" : "テーマ詳細へ戻る"}
        </Link>
      </Button>
      {target.type === "item" && (
        <Button asChild variant="outline">
          <Link href={studyReturnHref(themeId, target)}>
            {target.type === "item" ? "同じ項目で続ける" : "テーマ全体で続ける"}
          </Link>
        </Button>
      )}
      {children}
    </section>
  );
}
