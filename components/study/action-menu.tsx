"use client";
import { DropdownMenu } from "radix-ui";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
export function ActionMenu({
  label,
  onEdit,
  onDelete,
  editLabel = "編集",
}: {
  label: string;
  editLabel?: string;
  onEdit: () => void;
  onDelete?: () => void;
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
