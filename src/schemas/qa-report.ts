const qaScoreSchema = {
  type: "object",
  additionalProperties: false,
  required: ["score", "reason"],
  properties: {
    score: { type: "number", minimum: 1, maximum: 5 },
    reason: { type: "string", minLength: 1 },
  },
} as const;

export const qaReportSchemaName = "qa_report_artifact";

export const qaReportJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "artifact_type",
    "version",
    "inputs",
    "scores",
    "checks",
    "issues",
    "revision_guidance",
    "overall_pass",
  ],
  properties: {
    artifact_type: { type: "string", const: "qa_report" },
    version: { type: "string", minLength: 1 },
    inputs: {
      type: "object",
      additionalProperties: false,
      required: ["note_id"],
      properties: {
        note_id: { type: "string", minLength: 1 },
      },
    },
    scores: {
      type: "object",
      additionalProperties: false,
      required: [
        "hook_strength",
        "low_explainer_tone",
        "spoken_naturalness",
        "emotion_curve",
        "eleven_prompt_naturalness",
      ],
      properties: {
        hook_strength: qaScoreSchema,
        low_explainer_tone: qaScoreSchema,
        spoken_naturalness: qaScoreSchema,
        emotion_curve: qaScoreSchema,
        eleven_prompt_naturalness: qaScoreSchema,
      },
    },
    checks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "status"],
        properties: {
          name: { type: "string", minLength: 1 },
          status: { type: "string", enum: ["pass", "fail"] },
        },
      },
    },
    issues: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["severity", "stage", "message"],
        properties: {
          severity: { type: "string", enum: ["low", "medium", "high"] },
          stage: {
            type: "string",
            enum: ["brief", "spoken-script", "eleven-v3-prompt", "qa"],
          },
          message: { type: "string", minLength: 1 },
        },
      },
    },
    revision_guidance: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["stage", "action"],
        properties: {
          stage: {
            type: "string",
            enum: ["brief", "spoken-script", "eleven-v3-prompt", "qa"],
          },
          action: { type: "string", minLength: 1 },
        },
      },
    },
    overall_pass: { type: "boolean" },
  },
} as const;
