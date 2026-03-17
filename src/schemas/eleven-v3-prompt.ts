export const elevenV3PromptSchemaName = "eleven_v3_prompt_artifact";

export const elevenV3PromptJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "artifact_type",
    "version",
    "source_script",
    "performance_goal",
    "performance_rules",
    "avoid_rules",
    "final_prompt",
  ],
  properties: {
    artifact_type: { type: "string", const: "eleven_v3_prompt" },
    version: { type: "string", minLength: 1 },
    source_script: {
      type: "object",
      additionalProperties: false,
      required: ["id"],
      properties: {
        id: { type: "string", minLength: 1 },
      },
    },
    performance_goal: { type: "string", minLength: 1 },
    performance_rules: {
      type: "array",
      minItems: 1,
      items: { type: "string", minLength: 1 },
    },
    avoid_rules: {
      type: "array",
      minItems: 1,
      items: { type: "string", minLength: 1 },
    },
    final_prompt: { type: "string", minLength: 1 },
  },
} as const;
