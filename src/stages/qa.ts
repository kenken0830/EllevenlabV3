import { generateStructuredStageOutput } from "../openai-client.js";
import {
  qaReportJsonSchema,
  qaReportSchemaName,
} from "../schemas/qa-report.js";
import { loadSkillReference } from "../skill-references.js";
import type {
  BriefArtifact,
  ElevenV3PromptArtifact,
  QaReportArtifact,
  SourceNoteArtifact,
  SpokenScriptArtifact,
} from "../types.js";

export async function runQaStage(
  note: SourceNoteArtifact,
  brief: BriefArtifact,
  spokenScript: SpokenScriptArtifact,
  elevenPrompt: ElevenV3PromptArtifact,
): Promise<QaReportArtifact> {
  const rubric = await loadSkillReference("qa-rubric.md");
  const systemPrompt = [
    "You are building the qa_report stage of a Japanese voice pipeline.",
    "Return only JSON that matches the schema.",
    "Evaluate the chain and point to the stage that should be revised if quality is weak.",
    "Inspect the spoken_script intro and body separately.",
    "Distinguish upstream brief causes from downstream spoken-script causes when the body feels advice-heavy or overstructured.",
    "If brief.section_plan.body or brief.talking_points already frame the body as advice, teaching, importance, or steps, call that a brief issue.",
    "If the brief is aligned with recognition_reframe but spoken_script still adds structured advice, call that a spoken-script issue.",
    "If both are responsible, report both explicitly.",
    "If the spoken_script body sounds overstructured, seminar-like, article-summary-like, or uses explicit teaching markers, you must call that out in checks, issues, and revision_guidance.",
    rubric,
  ].join("\n\n");
  const userPrompt = [
    "Evaluate this 4-stage artifact chain.",
    "Pay special attention to whether the spoken_script body drifts into explanation, teaching structure, or tidy advice instead of staying conversational.",
    "Also decide whether that drift starts in the brief or is introduced later by spoken_script.",
    "Use brief.body_role, brief.close_role, close_action, section_plan, and talking_points when assigning responsibility.",
    "Source note JSON:",
    JSON.stringify(note, null, 2),
    "Brief JSON:",
    JSON.stringify(brief, null, 2),
    "Spoken script JSON:",
    JSON.stringify(spokenScript, null, 2),
    "Eleven prompt JSON:",
    JSON.stringify(elevenPrompt, null, 2),
  ].join("\n\n");

  return generateStructuredStageOutput<QaReportArtifact>({
    stage: "qa",
    schemaName: qaReportSchemaName,
    schema: qaReportJsonSchema as unknown as Record<string, unknown>,
    systemPrompt,
    userPrompt,
  });
}
