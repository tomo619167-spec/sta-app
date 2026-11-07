"use client";
import * as React from "react";
import { Dialog as Primitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
export const Dialog = Primitive.Root;
export const DialogTitle = Primitive.Title;
export const DialogDescription = Primitive.Description;
export function DialogContent({
  children,
  className,
  ...props
}: React.ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Overlay className="fixed inset-0 z-50 bg-[#292b24]/35 backdrop-blur-[2px]" />
      <Primitive.Content
        className={cn(
          "dialog-content fixed z-50 w-[calc(100%-2rem)] max-w-md rounded-lg border border-border bg-background p-6 shadow-xl",
          className,
        )}
        {...props}
      >
        {children}
        <Primitive.Close
          className="absolute right-3 top-3 flex size-11 items-center justify-center rounded-md hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
          aria-label="閉じる"
        >
          <X className="size-4" />
        </Primitive.Close>
      </Primitive.Content>
    </Primitive.Portal>
  );
}
