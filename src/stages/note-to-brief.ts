import { readFile } from "node:fs/promises";
import path from "node:path";

import { StageExecutionError } from "../errors.js";
import { generateStructuredStageOutput } from "../openai-client.js";
import { briefJsonSchema, briefSchemaName } from "../schemas/brief.js";
import type { BriefArtifact, SourceNoteArtifact } from "../types.js";

const BRIEF_BODY_MARKER_PATTERNS = [
  /まず/u,
  /次に/u,
  /重要/u,
  /大切/u,
  /ポイント/u,
  /具体的には/u,
  /方法/u,
  /やり方/u,
  /提案/u,
  /おすすめ/u,
  /第一歩/u,
  /最初の一歩/u,
] as const;

const BRIEF_ACTION_PATTERNS = [
  /(?:試してみ|やってみ|してみ|聞いてみ|置いてみ|考えてみ|使ってみ)(?:る|て|ましょう|ませんか|てください)?/u,
  /(?:しましょう|してください|てください|ませんか)\s*。?$/u,
  /(?:勧め|すすめ|提案|おすすめ)/u,
  /(?:するといい|したほうがいい|しておくといい)/u,
] as const;

const BRIEF_STRONG_ADVICE_PATTERNS = [
  /(?:しましょう|してください|てください|ませんか)/u,
  /(?:勧め|すすめ|提案|おすすめ)/u,
  /(?:するといい|したほうがいい|しておくといい)/u,
] as const;

const BRIEF_OBSERVATION_ACTION_EXEMPTION_PATTERNS = [
  /(?:自然|よくある|ことがある|かもしれない|しやすい|だけ|に近い)/u,
  /(?:示す|伝える|共有する)/u,
] as const;

const BRIEF_REPAIR_BANLIST = [
  "まず",
  "次に",
  "重要",
  "大切",
  "ポイント",
  "具体的には",
  "方法",
  "やり方",
  "提案",
  "おすすめ",
  "第一歩",
  "最初の一歩",
] as const;

const BRIEF_REPAIR_EXAMPLES = [
  {
    bad: "まずは1つのことに集中することが重要。",
    better: "頭の中に一度に色んなものが乗りすぎているのかもしれない。",
  },
  {
    bad: "方法としては、小さなタスクから始める。",
    better: "全部を一気に片づけようとすると、余計に止まりやすい。",
  },
  {
    bad: "最初の一歩はこれを試してみること。",
    better: "その一歩は close_action にだけ置いて、body では見立てに留める。",
  },
  {
    bad: "試しに使ってみることが大切です。",
    better: "最初からうまく扱えないのは自然なこと。",
  },
] as const;

const BRIEF_BODY_EXAMPLES_PATH = path.resolve(
  process.cwd(),
  ".agents/skills/eleven-v3-ja-pipeline/references/brief-body-examples.md",
);

let briefBodyExamplesPromise: Promise<string> | undefined;

export interface BriefBodyIssueFinding {
  message: string;
  offendingLines: string[];
}

async function loadBriefBodyExamples(): Promise<string> {
  briefBodyExamplesPromise ??= readFile(BRIEF_BODY_EXAMPLES_PATH, "utf8");
  return briefBodyExamplesPromise;
}

function buildInitialBriefSystemPrompt(): string {
  return [
    "You are building the first stage of a Japanese voice pipeline.",
    "Return only JSON that matches the schema.",
    "Do not jump ahead to spoken_script, ElevenLabs prompting, or QA.",
    "Focus on extracting the core message, listener problem, empathy hook, talking points, and section plan.",
    "Optimize for conversational Japanese, empathy-first framing, and low explainer tone.",
    "The brief must shape downstream delivery.",
    "Set body_role to recognition_reframe.",
    "Set close_role to single_soft_action.",
    "Set close_action to one gentle next step in Japanese.",
    "The body plan must stay mostly in recognition, reframe, and gentle observation.",
    "The body plan must avoid advice-column tone, teaching markers, and multi-step coaching.",
    "The body should contain zero or at most one light suggestion.",
    "Do not leave direct listener instructions in the body such as try this, start with this, place this, use this, or first do this.",
    "The close should carry one soft action only, aligned with close_action.",
    "If body and close compete for the same advice push, move that push into the close.",
    "talking_points should support recognition and reframe, not carry the main action push.",
    "Across body points and talking_points together, allow zero or one light suggestion total; zero is preferred.",
    "Follow the contrastive brief-body examples provided in the user prompt.",
  ].join(" ");
}

async function buildInitialBriefUserPrompt(
  note: SourceNoteArtifact,
): Promise<string> {
  const examples = await loadBriefBodyExamples();

  return [
    "Create a brief artifact from this Japanese note.",
    "The output language must be Japanese except stable field names already defined by the schema.",
    "Shape the brief so spoken_script.body can stay recognition/reframe-heavy and spoken_script.close can stay single-soft-action-heavy.",
    "In section_plan, make body for recognition and reframe, and make close for one gentle next step.",
    "Avoid body points that sound like 'importance of', 'steps', 'how to', or 'first do X'.",
    "In body and talking_points, prefer lines like 'it may be that...' or 'when this happens...' over lines that tell the listener what to do.",
    "Do not let talking_points become a place for the action push. Put that in close_action instead.",
    "Across body points and talking_points together, keep suggestion lines to zero or one total.",
    "Contrastive brief body examples:",
    examples,
    "Source note JSON:",
    JSON.stringify(note, null, 2),
  ].join("\n\n");
}

function isActionLikeLine(value: string): boolean {
  const hasActionLanguage = BRIEF_ACTION_PATTERNS.some((pattern) =>
    pattern.test(value),
  );

  if (!hasActionLanguage) {
    return false;
  }

  const hasStrongAdviceLanguage =
    BRIEF_BODY_MARKER_PATTERNS.some((pattern) => pattern.test(value)) ||
    BRIEF_STRONG_ADVICE_PATTERNS.some((pattern) => pattern.test(value));

  if (hasStrongAdviceLanguage) {
    return true;
  }

  return !BRIEF_OBSERVATION_ACTION_EXEMPTION_PATTERNS.some((pattern) =>
    pattern.test(value),
  );
}

function uniqueNonEmptyLines(lines: string[]): string[] {
  return [...new Set(lines.map((line) => line.trim()).filter(Boolean))];
}

export function findBriefBodyIssueFindings(
  brief: BriefArtifact,
): BriefBodyIssueFinding[] {
  const findings: BriefBodyIssueFinding[] = [];

  if (brief.body_role !== "recognition_reframe") {
    findings.push({
      message: "brief body_role is not recognition_reframe.",
      offendingLines: [`body_role=${brief.body_role}`],
    });
  }

  if (brief.close_role !== "single_soft_action") {
    findings.push({
      message: "brief close_role is not single_soft_action.",
      offendingLines: [`close_role=${brief.close_role}`],
    });
  }

  const bodySection = brief.section_plan.find(
    (section) => section.id === "body",
  );
  const closeSection = brief.section_plan.find(
    (section) => section.id === "close",
  );

  if (!bodySection) {
    findings.push({
      message: "brief body section is missing.",
      offendingLines: [],
    });
    return findings;
  }

  if (!closeSection) {
    findings.push({
      message: "brief close section is missing.",
      offendingLines: [],
    });
    return findings;
  }

  const bodyTexts = [
    bodySection.goal,
    ...bodySection.points,
    ...brief.talking_points,
  ];
  const markerHits = uniqueNonEmptyLines(
    bodyTexts.filter((line) =>
      BRIEF_BODY_MARKER_PATTERNS.some((pattern) => pattern.test(line)),
    ),
  );

  if (markerHits.length > 0) {
    findings.push({
      message:
        "brief body uses teaching markers or method-style framing instead of recognition/reframe.",
      offendingLines: markerHits,
    });
  }

  const actionLikeLines = uniqueNonEmptyLines(
    [...bodySection.points, ...brief.talking_points].filter((line) =>
      isActionLikeLine(line),
    ),
  );

  if (actionLikeLines.length > 1) {
    findings.push({
      message:
        "brief body contains multiple action pushes instead of reserving them for close_action.",
      offendingLines: actionLikeLines,
    });
  }

  if (closeSection.points.length !== 1) {
    findings.push({
      message:
        "brief close section should contain exactly one soft action point.",
      offendingLines: uniqueNonEmptyLines(closeSection.points),
    });
  }

  return findings;
}

export function findBriefBodyIssues(brief: BriefArtifact): string[] {
  return findBriefBodyIssueFindings(brief).map((finding) => finding.message);
}

function formatBriefBodyIssueFindings(
  findings: BriefBodyIssueFinding[],
): string {
  return findings
    .map((finding) => {
      if (finding.offendingLines.length === 0) {
        return finding.message;
      }

      return `${finding.message} Offending lines: ${finding.offendingLines
        .map((line) => `「${line}」`)
        .join(" / ")}.`;
    })
    .join(" ");
}

export async function generateInitialBrief(
  note: SourceNoteArtifact,
): Promise<BriefArtifact> {
  return generateStructuredStageOutput<BriefArtifact>({
    stage: "brief",
    schemaName: briefSchemaName,
    schema: briefJsonSchema as unknown as Record<string, unknown>,
    systemPrompt: buildInitialBriefSystemPrompt(),
    userPrompt: await buildInitialBriefUserPrompt(note),
  });
}

export async function repairBriefBody(
  note: SourceNoteArtifact,
  brief: BriefArtifact,
  issues: string[],
): Promise<BriefArtifact> {
  const examples = await loadBriefBodyExamples();
  const systemPrompt = [
    "You are repairing the brief stage of a Japanese voice pipeline.",
    "Return only JSON that matches the schema.",
    "Preserve the main idea and empathy hook, but rewrite the brief so body and close roles are cleaner.",
    "body_role must stay recognition_reframe.",
    "close_role must stay single_soft_action.",
    "close_action must carry the clearest action push.",
    "The body must stay mostly in recognition, reframe, and gentle observation.",
    "The body must avoid teaching markers and action-heavy phrasing.",
    "The body may contain zero or one light suggestion at most.",
    "Across body points and talking_points together, allow zero or one light suggestion total.",
    "Do not leave direct listener instructions in body or talking_points.",
    "Body and talking_points must not tell the listener to try, start, use, place, or do anything.",
    "The close section must carry one soft action point only.",
    `The body and talking_points are invalid if they contain any of these expressions: ${BRIEF_REPAIR_BANLIST.join(", ")}`,
    "Follow the contrastive brief-body examples provided in the user prompt.",
  ].join(" ");
  const userPrompt = [
    "Repair this brief artifact.",
    "Move action push out of the body and into close_action and the close section.",
    "Across body points and talking_points together, leave zero or one light suggestion total; zero is preferred.",
    "Rewrite body goal, body points, and talking_points so they sound like recognition and reframe instead of advice or method.",
    "If a line sounds like a method, recommendation, or 'first do this', remove it from the body and keep only one soft action in close_action.",
    "Rewrite recommendation lines into observation lines. Prefer 'why this happens' and 'what it feels like' over 'what to do'.",
    "Avoid any body or talking_points line that asks the listener to try, start, use, place, or do something.",
    "Current brief issues:",
    issues.map((issue) => `- ${issue}`).join("\n"),
    "Bad vs better micro examples:",
    BRIEF_REPAIR_EXAMPLES.map(
      ({ bad, better }) => `- Bad: ${bad}\n  Better: ${better}`,
    ).join("\n"),
    "Contrastive brief body examples:",
    examples,
    "Source note JSON:",
    JSON.stringify(note, null, 2),
    "Current brief JSON:",
    JSON.stringify(brief, null, 2),
  ].join("\n\n");

  return generateStructuredStageOutput<BriefArtifact>({
    stage: "brief",
    schemaName: briefSchemaName,
    schema: briefJsonSchema as unknown as Record<string, unknown>,
    systemPrompt,
    userPrompt,
  });
}

export async function runNoteToBriefStage(
  note: SourceNoteArtifact,
): Promise<BriefArtifact> {
  let brief = await generateInitialBrief(note);
  let findings = findBriefBodyIssueFindings(brief);

  if (findings.length === 0) {
    return brief;
  }

  brief = await repairBriefBody(
    note,
    brief,
    findings.map((finding) => finding.message),
  );
  findings = findBriefBodyIssueFindings(brief);

  if (findings.length > 0) {
    throw new StageExecutionError(
      "brief",
      "validation_error",
      `brief body stayed overstructured after repair: ${formatBriefBodyIssueFindings(findings)}`,
    );
  }

  return brief;
}
