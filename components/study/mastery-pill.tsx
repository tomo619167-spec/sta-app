"use client";
import { useRef, useState } from "react";
import { DropdownMenu } from "radix-ui";
import { Check, ChevronDown } from "lucide-react";
import type { FourLevel, StudyTarget } from "@/lib/model";
import { latestMastery, masteryLabel, masteryOptions } from "@/lib/ratings";
import { studyRepository } from "@/lib/storage";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useStudy } from "./provider";
import { MasteryHistory } from "./mastery-control";
export function MasteryPill({
  themeId,
  target,
}: {
  themeId: string;
  target: StudyTarget;
}) {
  const { masteryHistory, refresh } = useStudy();
  const current = latestMastery(masteryHistory, target);
  const [open, setOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  async function select(level: FourLevel) {
    if (lock.current) return;
    if (level === current) {
      setOpen(false);
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await studyRepository.setMastery(themeId, target, level);
      await refresh();
      setOpen(false);
    } catch {
      setError("保存できませんでした。もう一度選択してください。");
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  const history = masteryHistory.filter(
    (entry) => entry.targetType === target.type && entry.targetId === target.id,
  );
  return (
    <>
      <DropdownMenu.Root
        open={open}
        onOpenChange={(value) => {
          if (!busy) {
            setOpen(value);
            if (value) setError("");
          }
        }}
      >
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className="mastery-pill"
            data-level={current ?? "unrated"}
            aria-label="項目の習得度を変更"
            disabled={busy}
          >
            <strong>{masteryLabel(current)}</strong>
            <ChevronDown size={14} aria-hidden="true" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="action-menu mastery-menu"
            align="end"
            sideOffset={6}
            collisionPadding={12}
            aria-label="習得度を選択"
          >
            <DropdownMenu.RadioGroup
              value={current === undefined ? "" : String(current)}
            >
              {masteryOptions.map((option) => (
                <DropdownMenu.RadioItem
                  key={option.level}
                  value={String(option.level)}
                  disabled={busy}
                  aria-label={option.label}
                  onSelect={(event) => {
                    event.preventDefault();
                    void select(option.level);
                  }}
                >
                  <span className="mastery-menu-check" aria-hidden="true">
                    {current === option.level && <Check size={16} />}
                  </span>
                  <span>
                    <strong>{option.label}</strong>
                    <small>{option.criterion}</small>
                  </span>
                </DropdownMenu.RadioItem>
              ))}
            </DropdownMenu.RadioGroup>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <DropdownMenu.Separator className="mastery-menu-separator" />
            <DropdownMenu.Item
              disabled={busy}
              onSelect={() => setHistoryOpen(true)}
            >
              変更の履歴
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent>
          <DialogTitle>習得度の履歴</DialogTitle>
          <DialogDescription className="sr-only">
            この項目の習得度の変更履歴
          </DialogDescription>
          <MasteryHistory history={history} />
        </DialogContent>
      </Dialog>
    </>
  );
}
