"use client";
import { Button } from "@/components/ui/button";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="empty-state">
      <h1>画面を開けませんでした</h1>
      <p>再試行して、学びの続きを開いてください。</p>
      <Button onClick={reset}>再試行</Button>
    </div>
  );
}
