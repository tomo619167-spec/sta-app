"use client";
import { useId } from "react";
import type { FourLevel } from "@/lib/model";
import { masteryOptions, outputOptions } from "@/lib/ratings";
export function FourLevelPicker({
  kind,
  value,
  onChange,
  disabled = false,
}: {
  kind: "mastery" | "output";
  value?: FourLevel;
  onChange: (level?: FourLevel) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const options = kind === "mastery" ? masteryOptions : outputOptions;
  return (
    <fieldset className={`rating-picker rating-${kind}`} disabled={disabled}>
      <legend>
        {kind === "mastery" ? "習得度" : "アウトプット完成度"}
        <small>{kind === "mastery" ? "知識の定着" : "今回の説明・任意"}</small>
      </legend>
      <div className="rating-options">
        {options.map((option) => (
          <label
            key={option.level}
            data-level={option.level}
            className={value === option.level ? "selected" : ""}
          >
            <input
              type="radio"
              name={id}
              value={option.level}
              checked={value === option.level}
              onChange={() => onChange(option.level)}
              aria-label={option.label}
            />
            <span className="rating-level" aria-hidden="true">
              {option.level}
            </span>
            <strong>{option.label}</strong>
            <span className="rating-criterion">{option.criterion}</span>
          </label>
        ))}
      </div>
      {kind === "output" && (
        <button
          className="rating-clear"
          type="button"
          onClick={() => onChange(undefined)}
          disabled={disabled}
          aria-pressed={value === undefined}
        >
          未評価で保存
        </button>
      )}
    </fieldset>
  );
}
