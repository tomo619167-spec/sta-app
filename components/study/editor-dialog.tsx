"use client";
import { ArrowLeft, X } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
export function EditorDialog({
  open,
  onClose,
  title,
  onSubmit,
  saveLabel = "保存",
  busy = false,
  error,
  onBack,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  onSubmit: (e: FormEvent) => void;
  saveLabel?: string;
  busy?: boolean;
  error?: string;
  onBack?: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !busy) onClose();
      }}
    >
      <DialogContent editor hideClose>
        <form className="editor-layout" onSubmit={onSubmit}>
          <header className="editor-header">
            {onBack && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onBack}
                disabled={busy}
                aria-label="戻る"
              >
                <ArrowLeft />
              </Button>
            )}
            <DialogTitle>{title}</DialogTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              disabled={busy}
              aria-label="閉じる"
            >
              <X />
            </Button>
          </header>
          <DialogDescription className="sr-only">
            {title}の入力画面
          </DialogDescription>
          <div className="editor-scroll">
            <div className="form-stack">
              {children}
              {error && (
                <p role="alert" className="form-error">
                  {error}
                </p>
              )}
            </div>
          </div>
          <footer className="editor-footer">
            {footer ?? (
              <Button type="submit" disabled={busy}>
                {busy ? "保存中…" : saveLabel}
              </Button>
            )}
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}
