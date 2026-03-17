import OpenAI from "openai";

import { StageExecutionError } from "./errors.js";
import type { StageName } from "./types.js";

const DEFAULT_OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
let cachedClient: OpenAI | undefined;

export interface StructuredStageRequest {
  stage: StageName;
  schemaName: string;
  schema: Record<string, unknown>;
  systemPrompt: string;
  userPrompt: string;
}

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set.");
  }

  cachedClient ??= new OpenAI({ apiKey });
  return cachedClient;
}

export async function generateStructuredStageOutput<T>(
  request: StructuredStageRequest,
): Promise<T> {
  try {
    const client = getClient();
    const completion = await client.chat.completions.create({
      model: DEFAULT_OPENAI_MODEL,
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content: request.systemPrompt,
        },
        {
          role: "user",
          content: request.userPrompt,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: request.schemaName,
          strict: true,
          schema: request.schema,
        },
      },
    });
    const choice = completion.choices[0];

    if (!choice) {
      throw new StageExecutionError(
        request.stage,
        "runtime_error",
        "OpenAI returned no choices.",
      );
    }

    if (choice.message.refusal) {
      throw new StageExecutionError(
        request.stage,
        "refusal",
        choice.message.refusal,
      );
    }

    const content = choice.message.content;

    if (!content) {
      throw new StageExecutionError(
        request.stage,
        "runtime_error",
        "OpenAI returned an empty response.",
      );
    }

    try {
      return JSON.parse(content) as T;
    } catch {
      throw new StageExecutionError(
        request.stage,
        "runtime_error",
        "OpenAI returned invalid JSON.",
      );
    }
  } catch (error) {
    if (error instanceof StageExecutionError) {
      throw error;
    }

    const message =
      error instanceof Error ? error.message : "OpenAI request failed.";
    const kind = message.includes("OPENAI_API_KEY")
      ? "configuration_error"
      : "runtime_error";

    throw new StageExecutionError(request.stage, kind, message);
  }
}
