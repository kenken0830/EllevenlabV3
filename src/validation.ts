import {
  Ajv2020,
  type ErrorObject,
  type ValidateFunction,
} from "ajv/dist/2020.js";

import { StageExecutionError } from "./errors.js";
import { briefJsonSchema } from "./schemas/brief.js";
import { elevenV3PromptJsonSchema } from "./schemas/eleven-v3-prompt.js";
import { qaReportJsonSchema } from "./schemas/qa-report.js";
import { spokenScriptJsonSchema } from "./schemas/spoken-script.js";
import type { StageName } from "./types.js";

const ajv = new Ajv2020({ allErrors: true, strict: false });

const validators: Record<StageName, ValidateFunction> = {
  brief: ajv.compile(briefJsonSchema),
  "spoken-script": ajv.compile(spokenScriptJsonSchema),
  "eleven-v3-prompt": ajv.compile(elevenV3PromptJsonSchema),
  qa: ajv.compile(qaReportJsonSchema),
};

function formatValidationErrors(
  errors: ErrorObject[] | null | undefined,
): string {
  if (!errors || errors.length === 0) {
    return "Schema validation failed.";
  }

  return errors
    .map((error) => {
      const instancePath = error.instancePath || "/";
      return `${instancePath} ${error.message ?? "is invalid"}`.trim();
    })
    .join("; ");
}

export function validateStageArtifact(
  stage: StageName,
  artifact: unknown,
): void {
  const validator = validators[stage];
  const valid = validator(artifact);

  if (!valid) {
    throw new StageExecutionError(
      stage,
      "validation_error",
      formatValidationErrors(validator.errors),
    );
  }
}
