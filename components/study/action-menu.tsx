"use client";
import { DropdownMenu } from "radix-ui";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
export function ActionMenu({
  label,
  onEdit,
  onDelete,
  onIcon,
  editLabel = "編集",
}: {
  label: string;
  editLabel?: string;
  onEdit: () => void;
  onDelete?: () => void;
  onIcon?: () => void;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label={label}>
          <MoreHorizontal />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="action-menu"
          sideOffset={5}
          align="end"
          collisionPadding={12}
        >
          <DropdownMenu.Item onSelect={onEdit}>{editLabel}</DropdownMenu.Item>
          {onIcon && (
            <DropdownMenu.Item onSelect={onIcon}>
              アイコンを変更
            </DropdownMenu.Item>
          )}
          {onDelete && (
            <DropdownMenu.Item className="danger" onSelect={onDelete}>
              削除
            </DropdownMenu.Item>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
