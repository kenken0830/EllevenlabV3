import {
  type GenerateCliOptions,
  REQUIRED_PREVIOUS_STAGES,
  STAGE_FILE_NAMES,
  STAGES,
  type StageMode,
  type StageName,
} from "./types.js";

export function isStageName(value: string): value is StageName {
  return (STAGES as readonly string[]).includes(value);
}

export function resolveStageMode(options: GenerateCliOptions): StageMode {
  if (options.stage) {
    return "stage";
  }

  if (options.fromStage) {
    return "from";
  }

  return "all";
}

export function resolveRequestedStages(
  options: GenerateCliOptions,
): StageName[] {
  if (options.stage) {
    return [options.stage];
  }

  if (options.fromStage) {
    const startIndex = STAGES.indexOf(options.fromStage);
    return [...STAGES.slice(startIndex)];
  }

  return [...STAGES];
}

export function getPlannedStageFiles(
  stages: StageName[],
): Partial<Record<StageName, string>> {
  const entries = stages.map(
    (stage) => [stage, STAGE_FILE_NAMES[stage]] as const,
  );
  return Object.fromEntries(entries) as Partial<Record<StageName, string>>;
}

export function getRequiredArtifactFiles(
  options: GenerateCliOptions,
): string[] {
  const requestedStages = resolveRequestedStages(options);
  const firstStage = requestedStages[0];

  if (!firstStage) {
    return [];
  }

  return REQUIRED_PREVIOUS_STAGES[firstStage].map(
    (stage) => STAGE_FILE_NAMES[stage],
  );
}
