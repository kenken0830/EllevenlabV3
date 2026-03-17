import { describe, expect, it } from "vitest";

import { findSpokenScriptBodyIssues } from "../../src/stages/brief-to-spoken-script.js";
import type { SpokenScriptArtifact } from "../../src/types.js";

function buildArtifact(bodyLines: string[]): SpokenScriptArtifact {
  return {
    artifact_type: "spoken_script",
    version: "0.1",
    source_brief: {
      id: "note-01",
    },
    voice_intent: "近い距離で話す",
    sections: [
      {
        id: "intro",
        purpose: "共感から入る",
        lines: ["こういう日、ありますよね。"],
      },
      {
        id: "body",
        purpose: "見方を言い換える",
        lines: bodyLines,
      },
      {
        id: "close",
        purpose: "小さく締める",
        lines: ["少しずつで大丈夫です。"],
      },
    ],
    closing_takeaway: "少しずつで大丈夫です。",
    delivery_cautions: ["説明しすぎない"],
  };
}

describe("findSpokenScriptBodyIssues", () => {
  it("flags overstructured seminar-style body markers", () => {
    const artifact = buildArtifact([
      "まずは、少し試してみることが大切です。",
      "それが最初の一歩になります。",
    ]);

    expect(findSpokenScriptBodyIssues(artifact)).toEqual([
      "body uses 'まず' style structure markers.",
      "body turns advice into a moralized lesson with 'ことが大事/大切'.",
      "body frames the point as a staged lesson such as '第一歩' or '最初の一歩'.",
    ]);
  });

  it("flags body sections that stack multiple recommendation lines", () => {
    const artifact = buildArtifact([
      "気軽に質問してみるのがいいかもしれませんね。",
      "少しずつ試してみるといいと思います。",
    ]);

    expect(findSpokenScriptBodyIssues(artifact)).toEqual([
      "body contains multiple direct recommendation lines instead of staying in recognition and reframe.",
    ]);
  });

  it("allows body lines that continue as conversation", () => {
    const artifact = buildArtifact([
      "止まる日は、やる気の問題というより頭がいっぱいなだけかもしれません。",
      "だから今日は、一個だけ見えれば十分だと思います。",
    ]);

    expect(findSpokenScriptBodyIssues(artifact)).toEqual([]);
  });
});
