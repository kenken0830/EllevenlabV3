import { generateStructuredStageOutput } from "../openai-client.js";
import {
  elevenV3PromptJsonSchema,
  elevenV3PromptSchemaName,
} from "../schemas/eleven-v3-prompt.js";
import { loadSkillReference } from "../skill-references.js";
import type { ElevenV3PromptArtifact, SpokenScriptArtifact } from "../types.js";

export async function runSpokenScriptToElevenPromptStage(
  spokenScript: SpokenScriptArtifact,
): Promise<ElevenV3PromptArtifact> {
  const elevenRules = await loadSkillReference("eleven-v3-rules.md");
  const systemPrompt = [
    "You are building the eleven_v3_prompt stage of a Japanese voice pipeline.",
    "Return only JSON that matches the schema.",
    "Do not use SSML break tags.",
    "Make final_prompt directly paste-ready for ElevenLabs v3.",
    "Hard constraints for final_prompt:",
    "- final_prompt should be mostly the actual spoken text, not an explanation of performance.",
    "- Prefer 1 to 3 short paragraphs at most.",
    "- Do not put every sentence on its own line.",
    "- Remove lecture connectors such as 'まず', '具体的には', '次のステップとして', '重要です' unless unavoidable.",
    "- Tighten the flow so the reader does not over-pause after every sentence.",
    "- If a line sounds too polished, slightly loosen it.",
    elevenRules,
  ].join("\n\n");
  const userPrompt = [
    "Turn this spoken_script into an eleven_v3_prompt artifact.",
    "Keep the output natural, warm, and practical for ElevenLabs v3.",
    "The final_prompt should sound like one creator talking to one person, not a presenter reading notes.",
    "Reduce explainer tone, reduce over-signaled pauses, and keep the flow conversational.",
    "If the spoken_script still feels structured, rewrite for speakability inside final_prompt rather than copying it mechanically.",
    "Spoken script JSON:",
    JSON.stringify(spokenScript, null, 2),
  ].join("\n\n");

  return generateStructuredStageOutput<ElevenV3PromptArtifact>({
    stage: "eleven-v3-prompt",
    schemaName: elevenV3PromptSchemaName,
    schema: elevenV3PromptJsonSchema as unknown as Record<string, unknown>,
    systemPrompt,
    userPrompt,
  });
}
