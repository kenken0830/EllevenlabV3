import { describe, expect, it } from "vitest";

import {
  findBriefBodyIssueFindings,
  findBriefBodyIssues,
} from "../../src/stages/note-to-brief.js";
import type { BriefArtifact } from "../../src/types.js";

function buildBrief(
  overrides: Partial<BriefArtifact> = {},
  bodyPoints = ["頭の中の負荷が高くなっているだけかもしれない。"],
): BriefArtifact {
  return {
    artifact_type: "brief",
    version: "0.1",
    source_note: {
      id: "note-01",
      title: "sample",
    },
    core_message: "まずは小さく始めるのではなく、見方を変えること。",
    listener_problem: "止まってしまう。",
    empathy_hook: "こういう日、ありますよね。",
    talking_points: ["止まるのはやる気不足ではなく負荷の問題かもしれない。"],
    section_plan: [
      {
        id: "intro",
        goal: "共感から入る",
        points: ["止まる日ってありますよね。"],
      },
      {
        id: "body",
        goal: "認識と再フレーム",
        points: bodyPoints,
      },
      {
        id: "close",
        goal: "次の一歩を一つだけ置く",
        points: ["一個だけ見える状態を作ってみる。"],
      },
    ],
    body_role: "recognition_reframe",
    close_role: "single_soft_action",
    close_action: "一個だけ見える状態を作ってみる。",
    style_targets: ["会話調"],
    style_avoid: ["講義調"],
    ...overrides,
  };
}

describe("findBriefBodyIssues", () => {
  it("flags teaching markers and multiple action pushes in brief body", () => {
    const brief = buildBrief(
      {
        talking_points: [
          "まずは一度試してみることが大切です。",
          "最初の一歩は質問してみることです。",
        ],
      },
      ["具体的には、雑に聞いてみる方法を考える。"],
    );

    expect(findBriefBodyIssues(brief)).toEqual([
      "brief body uses teaching markers or method-style framing instead of recognition/reframe.",
      "brief body contains multiple action pushes instead of reserving them for close_action.",
    ]);
  });

  it("returns offending lines for validation messages", () => {
    const brief = buildBrief(
      {
        talking_points: [
          "まずは一度試してみることが大切です。",
          "最初の一歩は質問してみることです。",
        ],
      },
      ["具体的には、雑に聞いてみる方法を考える。"],
    );

    expect(findBriefBodyIssueFindings(brief)).toEqual([
      {
        message:
          "brief body uses teaching markers or method-style framing instead of recognition/reframe.",
        offendingLines: [
          "具体的には、雑に聞いてみる方法を考える。",
          "まずは一度試してみることが大切です。",
          "最初の一歩は質問してみることです。",
        ],
      },
      {
        message:
          "brief body contains multiple action pushes instead of reserving them for close_action.",
        offendingLines: [
          "具体的には、雑に聞いてみる方法を考える。",
          "まずは一度試してみることが大切です。",
          "最初の一歩は質問してみることです。",
        ],
      },
    ]);
  });

  it("does not count observational mentions of actions as multiple pushes", () => {
    const brief = buildBrief(
      {
        talking_points: [
          "最初から完璧に使えないのは自然なことです。",
          "試しに使ってみることが大切です。",
        ],
      },
      ["雑に聞いてみることが自然な日もある。"],
    );

    expect(findBriefBodyIssues(brief)).toEqual([
      "brief body uses teaching markers or method-style framing instead of recognition/reframe.",
    ]);
  });

  it("flags close sections that carry more than one action point", () => {
    const brief = buildBrief({
      section_plan: [
        {
          id: "intro",
          goal: "共感から入る",
          points: ["止まる日ってありますよね。"],
        },
        {
          id: "body",
          goal: "認識と再フレーム",
          points: ["頭の中の負荷が高くなっているだけかもしれない。"],
        },
        {
          id: "close",
          goal: "次の一歩を一つだけ置く",
          points: ["一個だけ見える状態を作ってみる。", "深呼吸もしてみる。"],
        },
      ],
    });

    expect(findBriefBodyIssues(brief)).toEqual([
      "brief close section should contain exactly one soft action point.",
    ]);
  });

  it("accepts recognition/reframe-heavy brief bodies", () => {
    const brief = buildBrief({
      talking_points: [
        "止まるのはやる気不足ではなく、頭の中の負荷の影響かもしれない。",
        "全部をまとめて抱えている感覚が強いのかもしれない。",
      ],
    });

    expect(findBriefBodyIssues(brief)).toEqual([]);
  });
});
