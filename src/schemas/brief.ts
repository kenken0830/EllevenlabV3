export const briefSchemaName = "brief_artifact";

export const briefJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "artifact_type",
    "version",
    "source_note",
    "core_message",
    "listener_problem",
    "empathy_hook",
    "talking_points",
    "section_plan",
    "body_role",
    "close_role",
    "close_action",
    "style_targets",
    "style_avoid",
  ],
  properties: {
    artifact_type: { type: "string", const: "brief" },
    version: { type: "string", minLength: 1 },
    source_note: {
      type: "object",
      additionalProperties: false,
      required: ["id", "title"],
      properties: {
        id: { type: "string", minLength: 1 },
        title: { type: "string", minLength: 1 },
      },
    },
    core_message: { type: "string", minLength: 1 },
    listener_problem: { type: "string", minLength: 1 },
    empathy_hook: { type: "string", minLength: 1 },
    talking_points: {
      type: "array",
      minItems: 1,
      items: { type: "string", minLength: 1 },
    },
    section_plan: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "goal", "points"],
        properties: {
          id: { type: "string", enum: ["intro", "body", "close"] },
          goal: { type: "string", minLength: 1 },
          points: {
            type: "array",
            minItems: 1,
            items: { type: "string", minLength: 1 },
          },
        },
      },
    },
    body_role: { type: "string", const: "recognition_reframe" },
    close_role: { type: "string", const: "single_soft_action" },
    close_action: { type: "string", minLength: 1 },
    style_targets: {
      type: "array",
      minItems: 1,
      items: { type: "string", minLength: 1 },
    },
    style_avoid: {
      type: "array",
      minItems: 1,
      items: { type: "string", minLength: 1 },
    },
  },
} as const;
