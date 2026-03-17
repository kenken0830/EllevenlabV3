export const spokenScriptSchemaName = "spoken_script_artifact";

export const spokenScriptJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "artifact_type",
    "version",
    "source_brief",
    "voice_intent",
    "sections",
    "closing_takeaway",
    "delivery_cautions",
  ],
  properties: {
    artifact_type: { type: "string", const: "spoken_script" },
    version: { type: "string", minLength: 1 },
    source_brief: {
      type: "object",
      additionalProperties: false,
      required: ["id"],
      properties: {
        id: { type: "string", minLength: 1 },
      },
    },
    voice_intent: { type: "string", minLength: 1 },
    sections: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "purpose", "lines"],
        properties: {
          id: { type: "string", enum: ["intro", "body", "close"] },
          purpose: { type: "string", minLength: 1 },
          lines: {
            type: "array",
            minItems: 1,
            items: { type: "string", minLength: 1 },
          },
        },
      },
    },
    closing_takeaway: { type: "string", minLength: 1 },
    delivery_cautions: {
      type: "array",
      minItems: 1,
      items: { type: "string", minLength: 1 },
    },
  },
} as const;
