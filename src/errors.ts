import type { StageFailureKind, StageName } from "./types.js";

export class StageExecutionError extends Error {
  stage: StageName;
  kind: StageFailureKind;

  constructor(stage: StageName, kind: StageFailureKind, message: string) {
    super(message);
    this.name = "StageExecutionError";
    this.stage = stage;
    this.kind = kind;
  }
}

export function isStageExecutionError(
  error: unknown,
): error is StageExecutionError {
  return error instanceof StageExecutionError;
}
