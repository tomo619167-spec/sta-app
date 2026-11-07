import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  return (
    <div className="empty-state">
      <span className="eyebrow">PAGE NOT FOUND</span>
      <h1>ページが見つかりません</h1>
      <p>ホームから、学びの続きを。</p>
      <Button asChild>
        <Link href="/">ホームに戻る</Link>
      </Button>
    </div>
  );
}
