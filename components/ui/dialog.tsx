"use client";
import * as React from "react";
import { Dialog as Primitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
export const Dialog = Primitive.Root;
export const DialogTitle = Primitive.Title;
export const DialogDescription = Primitive.Description;
/** Observe the visible area: iOS can pan it without resizing the layout viewport. */
function VisibleViewport() {
  const marker = React.useRef<HTMLSpanElement>(null);
  React.useLayoutEffect(() => {
    const root = marker.current?.parentElement;
    if (!root) return;
    let frame = 0;
    const update = () => {
      const viewport = window.visualViewport;
      root.style.setProperty(
        "--visible-height",
        `${viewport?.height ?? window.innerHeight}px`,
      );
      root.style.setProperty("--visible-top", `${viewport?.offsetTop ?? 0}px`);
      root.style.setProperty(
        "--visible-left",
        `${viewport?.offsetLeft ?? 0}px`,
      );
      root.style.setProperty(
        "--visible-width",
        `${viewport?.width ?? window.innerWidth}px`,
      );
      const input = document.activeElement;
      const scroll = root.querySelector<HTMLElement>(".editor-scroll");
      if (
        scroll &&
        input instanceof HTMLElement &&
        scroll.contains(input) &&
        input.matches("input, textarea, select")
      ) {
        const field = input.getBoundingClientRect();
        const area = scroll.getBoundingClientRect();
        if (field.bottom > area.bottom - 12)
          scroll.scrollTop += field.bottom - area.bottom + 12;
        else if (field.top < area.top + 12)
          scroll.scrollTop -= area.top - field.top + 12;
      }
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    window.visualViewport?.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("scroll", schedule);
    window.addEventListener("resize", schedule);
    root.addEventListener("focusin", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.visualViewport?.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      root.removeEventListener("focusin", schedule);
    };
  }, []);
  return <span hidden ref={marker} />;
}
export function DialogContent({
  children,
  className,
  editor = false,
  hideClose = false,
  ...props
}: React.ComponentProps<typeof Primitive.Content> & {
  editor?: boolean;
  hideClose?: boolean;
}) {
  return (
    <Primitive.Portal>
      <Primitive.Overlay className="dialog-overlay" />
      <Primitive.Content
        className={cn("dialog-content", editor && "editor-dialog", className)}
        {...props}
      >
        <VisibleViewport />
        {children}
        {!hideClose && (
          <Primitive.Close className="dialog-close" aria-label="閉じる">
            <X size={18} />
          </Primitive.Close>
        )}
      </Primitive.Content>
    </Primitive.Portal>
  );
}
