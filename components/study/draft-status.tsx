"use client";
import { Button } from "@/components/ui/button";
export function DraftStatus({
  error,
  saving,
  retry,
  disabled = false,
}: {
  error: string;
  saving: boolean;
  retry: () => void;
  disabled?: boolean;
}) {
  return error ? (
    <p role="alert" className="form-error">
      {error}
      <Button type="button" variant="ghost" onClick={retry} disabled={disabled}>
        下書きを再試行
      </Button>
    </p>
  ) : (
    <p role="status" aria-label="下書き状況" className="draft-status">
      {saving ? "下書きを保存中…" : "下書き保存済み"}
    </p>
  );
}
