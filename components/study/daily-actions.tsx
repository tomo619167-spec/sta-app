import Link from "next/link";
import { PenLine, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { learningHref } from "@/lib/learning-context";
export function DailyActions({
  themeId,
  itemId,
  fromTheme = false,
}: {
  themeId: string;
  itemId?: string;
  fromTheme?: boolean;
}) {
  return (
    <nav
      className="daily-actions"
      aria-label={itemId === undefined ? "テーマ全体の学習" : "項目の学習"}
    >
      <Button asChild variant="outline">
        <Link href={learningHref(themeId, "output", itemId, fromTheme)}>
          <PenLine />
          <span>自分の言葉で説明する</span>
        </Link>
      </Button>
      <Button asChild variant="outline">
        <Link href={learningHref(themeId, "deepen", itemId, fromTheme)}>
          <Lightbulb />
          <span>理解を深める</span>
        </Link>
      </Button>
    </nav>
  );
}
