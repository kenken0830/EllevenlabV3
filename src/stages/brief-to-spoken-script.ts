import { StageExecutionError } from "../errors.js";
import { generateStructuredStageOutput } from "../openai-client.js";
import {
  spokenScriptJsonSchema,
  spokenScriptSchemaName,
} from "../schemas/spoken-script.js";
import { loadSkillReference } from "../skill-references.js";
import type { BriefArtifact, SpokenScriptArtifact } from "../types.js";

const BODY_FORBIDDEN_RULES = [
  {
    pattern: /まず(?:は)?/u,
    message: "body uses 'まず' style structure markers.",
  },
  {
    pattern: /次に/u,
    message: "body uses '次に' style structure markers.",
  },
  {
    pattern: /(?:ここで)?(?:大事|大切)なのは/u,
    message:
      "body uses explicit teaching phrasing like '大事なのは' or '大切なのは'.",
  },
  {
    pattern: /ことが(?:大事|大切)/u,
    message:
      "body turns advice into a moralized lesson with 'ことが大事/大切'.",
  },
  {
    pattern: /(?:第一歩|最初の一歩)/u,
    message:
      "body frames the point as a staged lesson such as '第一歩' or '最初の一歩'.",
  },
  {
    pattern: /(?:おすすめ|お勧め)/u,
    message: "body recommends actions in an advice-column tone.",
  },
  {
    pattern: /(?:ポイント|要するに|つまり|具体的には)/u,
    message: "body uses explicit summary or teaching markers.",
  },
] as const;

const BODY_ADVICE_LINE_PATTERNS = [
  /(?:試してみる|やってみる|してみる)/u,
  /(?:するといい|してみるといい|いいと思います|いいかもしれません)/u,
  /(?:ましょう|いきましょう)/u,
] as const;

const BODY_REPAIR_BANLIST = [
  "まず",
  "まずは",
  "次に",
  "大事",
  "大切",
  "最初の一歩",
  "第一歩",
  "おすすめ",
  "お勧め",
  "ポイント",
  "つまり",
  "要するに",
  "具体的には",
] as const;

const BODY_REPAIR_EXAMPLES = [
  {
    bad: "まずは、試してみることが大切です。",
    better:
      "いきなりちゃんとやろうとしなくてよくて、少し触るくらいで十分です。",
  },
  {
    bad: "それが最初の一歩です。",
    better: "そのくらいだと、意外と動きやすくなります。",
  },
  {
    bad: "ポイントは、完璧を目指さないことです。",
    better: "最初からちゃんとやろうとしすぎないほうが、むしろ続きやすいです。",
  },
] as const;

function buildSpokenSystemPrompt(spokenRules: string): string {
  return [
    "You are building the spoken_script stage of a Japanese voice pipeline.",
    "Return only JSON that matches the schema.",
    "Do not produce an ElevenLabs prompt yet.",
    "The script must sound natural aloud in Japanese and start from empathy instead of explanation.",
    "Hard constraints:",
    "- The first 1 to 2 lines must mirror the listener's felt situation, not define the topic.",
    "- Avoid lecture connectors such as 'まず', '具体的には', '次のステップとして', '重要です', 'お伝えします'.",
    "- Avoid generic public-speaking lines such as '多くの人が...' or topic definitions like 'Xとは'.",
    "- Prefer one person talking to one person.",
    "- If a line sounds polished or seminar-like, loosen it into more speakable Japanese.",
    "- Keep the body moving in short thought units instead of explanation blocks.",
    "- Keep the opening empathy rules intact. Do not let the intro drift into a definition or announcement.",
    "Body-specific constraints:",
    "- The body must not read like seminar notes, an article summary, a coaching list, or an advice column.",
    "- In the body, avoid explicit structure markers such as 'まずは', '次に', 'ポイントは', 'ここで大事なのは', 'つまり'.",
    "- In the body, prefer gentle observation and listener-following language over formal recommendation language.",
    "- Let the body sound like the speaker is staying with the listener's moment and naming what is happening.",
    "- Treat brief.body_role and brief.close_role as binding guidance when they are present.",
    "- Keep the body mostly in recognition, reframe, and gentle observation. Save the clearest action push for the close.",
    "- The body can contain at most one light suggestion; zero is often better.",
    "- If the body offers a next step, arrive there conversationally instead of presenting a lesson or takeaway block.",
    "- If the body feels neatly organized, intentionally loosen it until it sounds like natural spoken Japanese.",
    spokenRules,
  ].join("\n\n");
}

function buildSpokenUserPrompt(brief: BriefArtifact): string {
  return [
    "Turn this brief into a spoken_script artifact.",
    "Keep it conversational, warm, and easy to listen to.",
    "Do not sound like a lecture, article summary, advice column, or presentation script.",
    "The opening should feel like 'ありますよね' or 'こういう日ありますよね' rather than a definition or announcement.",
    "The body should feel like a person continuing the conversation, not switching into a mini seminar.",
    "Honor brief.body_role, brief.close_role, and close_action if they are present in the brief JSON.",
    "Keep the body mostly in diagnosis, recognition, and reframe. Save the clearest action nudge for the close.",
    "Avoid body lines that sound like step-by-step coaching, tidy teaching points, or abstract summary sentences.",
    "If you have to choose, sacrifice neat structure before you sacrifice spoken naturalness.",
    "Brief JSON:",
    JSON.stringify(brief, null, 2),
  ].join("\n\n");
}

export function findSpokenScriptBodyIssues(
  spokenScript: SpokenScriptArtifact,
): string[] {
  if (!Array.isArray(spokenScript.sections)) {
    return [];
  }

  const bodySection = spokenScript.sections.find(
    (section) => section.id === "body" && Array.isArray(section.lines),
  );

  if (!bodySection) {
    return [];
  }

  const bodyText = bodySection.lines.join("\n");
  const issues: string[] = BODY_FORBIDDEN_RULES.filter(({ pattern }) =>
    pattern.test(bodyText),
  ).map(({ message }) => message);
  const adviceLineCount = bodySection.lines.filter((line) =>
    BODY_ADVICE_LINE_PATTERNS.some((pattern) => pattern.test(line)),
  ).length;

  if (adviceLineCount > 1) {
    issues.push(
      "body contains multiple direct recommendation lines instead of staying in recognition and reframe.",
    );
  }

  return [...new Set(issues)];
}

async function generateInitialSpokenScript(
  brief: BriefArtifact,
  spokenRules: string,
): Promise<SpokenScriptArtifact> {
  return generateStructuredStageOutput<SpokenScriptArtifact>({
    stage: "spoken-script",
    schemaName: spokenScriptSchemaName,
    schema: spokenScriptJsonSchema as unknown as Record<string, unknown>,
    systemPrompt: buildSpokenSystemPrompt(spokenRules),
    userPrompt: buildSpokenUserPrompt(brief),
  });
}

async function repairSpokenScriptBody(
  brief: BriefArtifact,
  spokenScript: SpokenScriptArtifact,
  spokenRules: string,
  issues: string[],
  attempt: number,
): Promise<SpokenScriptArtifact> {
  const systemPrompt = [
    "You are repairing the spoken_script stage of a Japanese voice pipeline.",
    "Return only JSON that matches the schema.",
    "Preserve the opening empathy and the overall message, but rewrite the body so it stops sounding like seminar notes or structured advice.",
    "Focus mainly on sections[id=body].",
    "Do not add tags, ellipses, or extra pause symbols.",
    "Do not turn the body into a lesson, list, article summary, or coaching script.",
    "Keep the body mostly in recognition, reframe, and gentle observation. Save the clearest action push for the close.",
    `The body is invalid if it contains any of these expressions: ${BODY_REPAIR_BANLIST.join(", ")}`,
    "Use natural Japanese that sounds like a person talking alongside the listener.",
    spokenRules,
  ].join("\n\n");
  const userPrompt = [
    `Revise this spoken_script artifact. This is repair pass ${attempt}.`,
    "Keep the intro hook and close broadly intact unless a tiny wording adjustment is needed for flow.",
    "Rewrite the body so it feels like a person continuing the conversation in natural Japanese.",
    "The body should mostly stay in recognition and reframe. If there is a clear action push, move it into the close or soften it.",
    "Remove these body issues:",
    issues.map((issue) => `- ${issue}`).join("\n"),
    "Bad vs better body examples:",
    BODY_REPAIR_EXAMPLES.map(
      ({ bad, better }) => `- Bad: ${bad}\n  Better: ${better}`,
    ).join("\n"),
    "Brief JSON:",
    JSON.stringify(brief, null, 2),
    "Current spoken_script JSON:",
    JSON.stringify(spokenScript, null, 2),
  ].join("\n\n");

  return generateStructuredStageOutput<SpokenScriptArtifact>({
    stage: "spoken-script",
    schemaName: spokenScriptSchemaName,
    schema: spokenScriptJsonSchema as unknown as Record<string, unknown>,
    systemPrompt,
    userPrompt,
  });
}

async function refocusSpokenScriptBody(
  brief: BriefArtifact,
  spokenScript: SpokenScriptArtifact,
  spokenRules: string,
  issues: string[],
): Promise<SpokenScriptArtifact> {
  const systemPrompt = [
    "You are doing a final recovery pass for the spoken_script stage of a Japanese voice pipeline.",
    "Return only JSON that matches the schema.",
    "Rewrite sections[id=body] more aggressively if needed.",
    "Keep the intro empathy and the close, but make the body mainly recognition, reframe, and gentle observation.",
    "The body should be 3 to 4 short lines.",
    "The body may contain zero or one light suggestion line. More than one is invalid.",
    "Do not use lecture markers, list markers, or advice-column wording in the body.",
    `The body is invalid if it contains any of these expressions: ${BODY_REPAIR_BANLIST.join(", ")}`,
    spokenRules,
  ].join("\n\n");
  const userPrompt = [
    "The current spoken_script body is still too advice-heavy.",
    "Rewrite sections.body.lines so most lines describe the listener's hesitation, the friction, or a softer reframe.",
    "Move the clear action push out of the body. Leave that work to the close.",
    "Keep the body conversational and sayable out loud.",
    "Current body issues:",
    issues.map((issue) => `- ${issue}`).join("\n"),
    "Brief JSON:",
    JSON.stringify(brief, null, 2),
    "Current spoken_script JSON:",
    JSON.stringify(spokenScript, null, 2),
  ].join("\n\n");

  return generateStructuredStageOutput<SpokenScriptArtifact>({
    stage: "spoken-script",
    schemaName: spokenScriptSchemaName,
    schema: spokenScriptJsonSchema as unknown as Record<string, unknown>,
    systemPrompt,
    userPrompt,
  });
}

export async function runBriefToSpokenScriptStage(
  brief: BriefArtifact,
): Promise<SpokenScriptArtifact> {
  const spokenRules = await loadSkillReference("spoken-japanese-rules.md");
  let spokenScript = await generateInitialSpokenScript(brief, spokenRules);
  let issues = findSpokenScriptBodyIssues(spokenScript);

  for (let attempt = 1; issues.length > 0 && attempt <= 2; attempt += 1) {
    spokenScript = await repairSpokenScriptBody(
      brief,
      spokenScript,
      spokenRules,
      issues,
      attempt,
    );
    issues = findSpokenScriptBodyIssues(spokenScript);
  }

  if (issues.length > 0) {
    spokenScript = await refocusSpokenScriptBody(
      brief,
      spokenScript,
      spokenRules,
      issues,
    );
    issues = findSpokenScriptBodyIssues(spokenScript);
  }

  if (issues.length > 0) {
    throw new StageExecutionError(
      "spoken-script",
      "validation_error",
      `spoken-script body stayed overstructured after repair: ${issues.join(" ")}`,
    );
  }

  return spokenScript;
}
