import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StageName } from "../../src/types.js";

const generateStructuredStageOutput = vi.fn();

vi.mock("../../src/openai-client.js", () => ({
  generateStructuredStageOutput,
}));

function buildRealStageArtifact(stage: StageName) {
  switch (stage) {
    case "brief":
      return {
        artifact_type: "brief",
        version: "0.1",
        source_note: {
          id: "note-01",
          title: "タスクが多すぎて動けない日の話",
        },
        core_message: "最初の一歩は、1個だけ見える状態を作ること。",
        listener_problem: "やることが多い日に頭が止まることがある。",
        empathy_hook: "やることが多すぎて止まる日、ありますよね。",
        talking_points: [
          "頭の中の負荷が高いだけかもしれない",
          "全部やる前に1個だけ見える状態を作る",
        ],
        section_plan: [
          {
            id: "intro",
            goal: "共感から入る",
            points: ["止まる日、ありますよね"],
          },
          {
            id: "body",
            goal: "見方を言い換える",
            points: ["負荷が高いだけかもしれない"],
          },
          {
            id: "close",
            goal: "小さく締める",
            points: ["1個だけ見える状態を作る"],
          },
        ],
        body_role: "recognition_reframe",
        close_role: "single_soft_action",
        close_action: "1個だけ見える状態を作る",
        style_targets: ["フランク", "共感", "自然な口語"],
        style_avoid: ["講義っぽさ", "硬い書き言葉"],
      };
    case "spoken-script":
      return {
        artifact_type: "spoken_script",
        version: "0.1",
        source_brief: {
          id: "note-01",
        },
        voice_intent: "近い距離感で、責めずに、少し楽になる話し方",
        sections: [
          {
            id: "intro",
            purpose: "共感から入る",
            lines: [
              "やることが多すぎて止まる日って、ありますよね。",
              "まず言いたいのは、それは珍しくないってことです。",
            ],
          },
          {
            id: "body",
            purpose: "説明しすぎずに見方を変える",
            lines: [
              "実際は、やる気がないというより頭の中の負荷が高いだけ、ということも多いです。",
              "だから全部を片づけようとしなくて大丈夫です。",
            ],
          },
          {
            id: "close",
            purpose: "小さな次の一歩に落とす",
            lines: [
              "最初の一歩は、1個だけ見える状態を作ることです。",
              "それだけでも少し動きやすくなります。",
            ],
          },
        ],
        closing_takeaway: "最初の一歩は、1個だけ見える状態を作ることです。",
        delivery_cautions: [
          "説明しすぎない",
          "止めすぎない",
          "タグを増やしすぎない",
        ],
      };
    case "eleven-v3-prompt":
      return {
        artifact_type: "eleven_v3_prompt",
        version: "0.1",
        source_script: {
          id: "note-01",
        },
        performance_goal:
          "フランクで聞きやすく、共感から入る日本語ナレーション",
        performance_rules: [
          "冒頭は相手の状況に寄せる",
          "説明より話しかける感じを優先する",
        ],
        avoid_rules: ["講義っぽい抑揚", "過剰な間", "タグの多用"],
        final_prompt:
          "Japanese narration. Sound warm and conversational. Start with empathy, not explanation. Script: やることが多すぎて止まる日って、ありますよね。 最初の一歩は、1個だけ見える状態を作ることです。",
      };
    case "qa":
      return {
        artifact_type: "qa_report",
        version: "0.1",
        inputs: {
          note_id: "note-01",
        },
        scores: {
          hook_strength: { score: 4, reason: "共感から入っている。" },
          low_explainer_tone: { score: 4, reason: "説明臭さを抑えている。" },
          spoken_naturalness: { score: 4, reason: "口語として自然。" },
          emotion_curve: { score: 4, reason: "温度の流れがある。" },
          eleven_prompt_naturalness: { score: 4, reason: "prompt が実用的。" },
        },
        checks: [
          { name: "pipeline_stage_separated", status: "pass" },
          { name: "contains_empathy_opening", status: "pass" },
        ],
        issues: [],
        revision_guidance: [],
        overall_pass: true,
      };
  }
}

describe("real mode generation", () => {
  beforeEach(() => {
    vi.resetModules();
    generateStructuredStageOutput.mockReset();
    generateStructuredStageOutput.mockImplementation(async ({ stage }) =>
      buildRealStageArtifact(stage),
    );
  });

  it("writes all real stage artifacts when server-side structured outputs succeed", async () => {
    const { runGenerateCommand } = await import("../../src/cli.js");
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "note2voice-real-"));
    const outputDir = path.join(tempRoot, "sample-real");

    const exitCode = await runGenerateCommand({
      command: "generate",
      inputPath: path.resolve("samples/note-01.md"),
      outputDir,
      mock: false,
    });

    expect(exitCode).toBe(0);
    expect(generateStructuredStageOutput).toHaveBeenCalledTimes(4);

    const prompt = JSON.parse(
      await readFile(path.join(outputDir, "03-eleven-v3-prompt.json"), "utf8"),
    );
    const manifest = JSON.parse(
      await readFile(path.join(outputDir, "manifest.json"), "utf8"),
    );

    expect(prompt.final_prompt.length).toBeGreaterThan(0);
    expect(manifest.execution_mode).toBe("real");
    expect(manifest.status).toBe("completed");
    expect(manifest.stage_results["eleven-v3-prompt"].status).toBe("completed");
  });

  it("stops on schema validation failure and records the failed stage in manifest", async () => {
    const { runGenerateCommand } = await import("../../src/cli.js");
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "note2voice-real-"));
    const outputDir = path.join(tempRoot, "validation-fail");

    generateStructuredStageOutput.mockImplementation(async ({ stage }) => {
      if (stage === "spoken-script") {
        return {
          artifact_type: "spoken_script",
          version: "0.1",
          source_brief: { id: "note-01" },
        };
      }

      return buildRealStageArtifact(stage);
    });

    await expect(
      runGenerateCommand({
        command: "generate",
        inputPath: path.resolve("samples/note-01.md"),
        outputDir,
        mock: false,
      }),
    ).rejects.toThrow(/voice_intent/);

    const manifest = JSON.parse(
      await readFile(path.join(outputDir, "manifest.json"), "utf8"),
    );

    expect(manifest.status).toBe("failed");
    expect(manifest.failed_stage).toBe("spoken-script");
    expect(manifest.error.kind).toBe("validation_error");
  });
});
