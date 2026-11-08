import type { Theme } from "./model";
import {
  learningLevels,
  ROADMAP_MAX_JSON_LENGTH,
  type RoadmapPromptInput,
} from "./roadmap-json";
export type RoadmapDraftStep = "conditions" | "prompt" | "json" | "preview";
export interface RoadmapDraft {
  version: 1;
  themeId: string;
  active: boolean;
  step: RoadmapDraftStep;
  goal: string;
  level: RoadmapPromptInput["level"];
  notes: string;
  prompt: string;
  copied: boolean;
  source: string;
}
export function newRoadmapDraft(
  theme: Pick<Theme, "id" | "description">,
): RoadmapDraft {
  return {
    version: 1,
    themeId: theme.id,
    active: false,
    step: "conditions",
    goal: theme.description,
    level: "high-school",
    notes: "",
    prompt: "",
    copied: false,
    source: "",
  };
}
export function validateRoadmapDraft(draft: RoadmapDraft): RoadmapDraft {
  if (
    draft.version !== 1 ||
    typeof draft.themeId !== "string" ||
    !draft.themeId ||
    typeof draft.active !== "boolean" ||
    typeof draft.copied !== "boolean" ||
    !["conditions", "prompt", "json", "preview"].includes(draft.step) ||
    !Object.hasOwn(learningLevels, draft.level)
  )
    throw new Error("下書きの形式を確認してください。");
  for (const [key, max] of [
    ["goal", 1000],
    ["notes", 2000],
    ["prompt", 20000],
    ["source", ROADMAP_MAX_JSON_LENGTH],
  ] as const)
    if (typeof draft[key] !== "string" || draft[key].length > max)
      throw new Error("下書きの入力が上限を超えています。");
  // Only persist workflow data, never imported objects, IDs or ratings.
  return {
    version: 1,
    themeId: draft.themeId,
    active: draft.active,
    step: draft.step,
    goal: draft.goal,
    level: draft.level,
    notes: draft.notes,
    prompt: draft.prompt,
    copied: draft.copied,
    source: draft.source,
  };
}
