import type {
  BriefArtifact,
  ElevenV3PromptArtifact,
  QaReportArtifact,
  QaScore,
  SourceNoteArtifact,
  SpokenScriptArtifact,
} from "./types.js";

function normalizeSentence(value: string): string {
  const trimmed = value.trim().replace(/^[・-]\s*/, "");

  if (!trimmed) {
    return "";
  }

  return /[。！？]$/.test(trimmed) ? trimmed : `${trimmed}。`;
}

function stripEnding(value: string): string {
  return value.trim().replace(/[。！？]+$/g, "");
}

function splitSentences(body: string): string[] {
  const normalizedLines = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const sentences = normalizedLines.flatMap((line) =>
    line
      .split(/(?<=[。！？])/)
      .map((sentence) => normalizeSentence(sentence))
      .filter(Boolean),
  );

  return sentences.length > 0
    ? sentences
    : [normalizeSentence(body)].filter(Boolean);
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function createScore(score: number, reason: string): QaScore {
  return { score, reason };
}

export function createMockBriefArtifact(
  note: SourceNoteArtifact,
): BriefArtifact {
  const sentences = splitSentences(note.body);
  const firstSentence = sentences[0] ?? `${note.title}についてのメモです。`;
  const middleSentence =
    sentences[Math.floor(sentences.length / 2)] ?? firstSentence;
  const lastSentence = sentences[sentences.length - 1] ?? firstSentence;
  const coreMessage = uniqueStrings([middleSentence, lastSentence]).join(" ");
  const listenerProblem = firstSentence;
  const empathyHook = `${stripEnding(firstSentence)}。こういうとき、ありますよね。`;
  const talkingPoints = uniqueStrings([
    stripEnding(firstSentence),
    stripEnding(middleSentence),
    stripEnding(lastSentence),
  ]).slice(0, 3);

  return {
    artifact_type: "brief",
    version: "0.1",
    source_note: {
      id: note.id,
      title: note.title,
    },
    core_message: coreMessage,
    listener_problem: listenerProblem,
    empathy_hook: empathyHook,
    talking_points: talkingPoints,
    section_plan: [
      {
        id: "intro",
        goal: "聞き手の状況を受け止めて、入り口の温度を合わせる",
        points: [stripEnding(firstSentence), stripEnding(empathyHook)],
      },
      {
        id: "body",
        goal: "認識と見立てを中心に、少し見方をずらす",
        points: [stripEnding(middleSentence)],
      },
      {
        id: "close",
        goal: "最後は一つだけ軽い次の一歩に落とす",
        points: [stripEnding(lastSentence)],
      },
    ],
    body_role: "recognition_reframe",
    close_role: "single_soft_action",
    close_action: stripEnding(lastSentence),
    style_targets: ["フランク", "聞き手との距離が近い", "共感から入る"],
    style_avoid: ["講義っぽさ", "説教口調", "タグの多用"],
  };
}

export function createMockSpokenScriptArtifact(
  brief: BriefArtifact,
): SpokenScriptArtifact {
  const introLead = normalizeSentence(brief.empathy_hook);
  const bodyLead = normalizeSentence(
    `でも実際は、${stripEnding(brief.talking_points[1] ?? brief.core_message)}って見方のほうが近いです`,
  );
  const closeLead = normalizeSentence(
    `だから最後は、${stripEnding(brief.core_message)}`,
  );

  return {
    artifact_type: "spoken_script",
    version: "0.1",
    source_brief: {
      id: brief.source_note.id,
    },
    voice_intent: "近い距離感で、責めずに、聞き手の肩の力が少し抜ける話し方",
    sections: [
      {
        id: "intro",
        purpose: "共感から自然に入る",
        lines: [
          introLead,
          normalizeSentence(
            `最初に言いたいのは、${stripEnding(brief.listener_problem)}って感覚は珍しくないということです`,
          ),
        ],
      },
      {
        id: "body",
        purpose: "認識と見立てを中心に、説明しすぎず見方を言い換える",
        lines: [
          bodyLead,
          normalizeSentence(
            `${stripEnding(brief.talking_points[0] ?? brief.core_message)}と決めつけなくて大丈夫です`,
          ),
        ],
      },
      {
        id: "close",
        purpose: "一つだけ軽い次の一歩に落とす",
        lines: [
          closeLead,
          normalizeSentence(
            `${stripEnding(brief.close_action)}くらいからで十分です`,
          ),
        ],
      },
    ],
    closing_takeaway: normalizeSentence(brief.core_message),
    delivery_cautions: [
      "説明しすぎない",
      "一文ごとに切りすぎない",
      "過剰な三点リーダを避ける",
    ],
  };
}

export function createMockElevenV3PromptArtifact(
  script: SpokenScriptArtifact,
): ElevenV3PromptArtifact {
  const scriptText = script.sections
    .flatMap((section) => section.lines)
    .join(" ");

  return {
    artifact_type: "eleven_v3_prompt",
    version: "0.1",
    source_script: {
      id: script.source_brief.id,
    },
    performance_goal:
      "フランクで聞きやすく、共感から入って自然に引き込む日本語ナレーション",
    performance_rules: [
      "冒頭は相手の状況を分かっている感じで入る",
      "説明より話しかける感じを優先する",
      "感情は大げさに振らず、少しずつ温度を上げる",
      "一文ごとに止めすぎず、会話の流れを保つ",
    ],
    avoid_rules: [
      "講義っぽい抑揚",
      "過剰な芝居",
      "不自然な長い間",
      "タグの多用",
      "三点リーダの多用",
    ],
    final_prompt: [
      "Japanese narration.",
      "Sound casual, warm, and engaging.",
      "Start with empathy, not explanation.",
      "Keep the flow conversational and easy to follow.",
      "Avoid lecture-like delivery, exaggerated acting, too many pauses, and excessive tags.",
      `Script: ${scriptText}`,
    ].join(" "),
  };
}

export function createMockQaReportArtifact(
  note: SourceNoteArtifact,
  _brief: BriefArtifact,
  script: SpokenScriptArtifact,
  prompt: ElevenV3PromptArtifact,
): QaReportArtifact {
  const introText = script.sections[0]?.lines.join(" ") ?? "";
  const scriptText = script.sections
    .flatMap((section) => section.lines)
    .join(" ");
  const hookStrength = introText.length > 0 ? 5 : 2;
  const lowExplainerTone = scriptText.includes("まず") ? 3 : 4;
  const spokenNaturalness = scriptText.length > 0 ? 4 : 2;
  const emotionCurve = script.sections.length >= 3 ? 4 : 3;
  const elevenPromptNaturalness = prompt.final_prompt.length > 0 ? 4 : 2;
  const checks = [
    {
      name: "pipeline_stage_separated",
      status: "pass",
    },
    {
      name: "contains_empathy_opening",
      status: introText.includes("ありますよね") ? "pass" : "fail",
    },
    {
      name: "excessive_ellipsis",
      status: scriptText.includes("...") ? "fail" : "pass",
    },
  ] as const;
  const issues = [] as QaReportArtifact["issues"];

  if (lowExplainerTone < 4) {
    issues.push({
      severity: "medium",
      stage: "spoken-script",
      message:
        "script に少し説明口調が残っているので、口語寄りに短くするとよいです。",
    });
  }

  const revisionGuidance = issues.map((issue) => ({
    stage: issue.stage,
    action:
      issue.stage === "spoken-script"
        ? "body の言い回しを一段くだけた口語に寄せる。"
        : "対象 artifact を見直す。",
  }));
  const scores = {
    hook_strength: createScore(
      hookStrength,
      "冒頭で聞き手の状況に寄せる導入を置いている。",
    ),
    low_explainer_tone: createScore(
      lowExplainerTone,
      "説明臭さを抑え、会話のトーンに寄せている。",
    ),
    spoken_naturalness: createScore(
      spokenNaturalness,
      "文の長さと口語感が読み上げに乗せやすい。",
    ),
    emotion_curve: createScore(
      emotionCurve,
      "共感から少し軽くなる着地までの流れがある。",
    ),
    eleven_prompt_naturalness: createScore(
      elevenPromptNaturalness,
      "演出指示は短く、タグ依存もない。",
    ),
  };
  const averageScore =
    (hookStrength +
      lowExplainerTone +
      spokenNaturalness +
      emotionCurve +
      elevenPromptNaturalness) /
    5;
  const overallPass =
    averageScore >= 4 &&
    checks.every((check) => check.status === "pass") &&
    Object.values(scores).every((entry) => entry.score >= 3);

  return {
    artifact_type: "qa_report",
    version: "0.1",
    inputs: {
      note_id: note.id,
    },
    scores,
    checks: [...checks],
    issues,
    revision_guidance: revisionGuidance,
    overall_pass: overallPass,
  };
}
