import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { runGenerateCommand } from "../../src/cli.js";

describe("runGenerateCommand", () => {
  it("writes all mock stage artifacts for a full run", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "note2voice-"));
    const outputDir = path.join(tempRoot, "sample-01");

    const exitCode = await runGenerateCommand({
      command: "generate",
      inputPath: path.resolve("samples/note-01.md"),
      outputDir,
      mock: true,
    });

    expect(exitCode).toBe(0);

    const brief = JSON.parse(
      await readFile(path.join(outputDir, "01-brief.json"), "utf8"),
    ) as {
      artifact_type: string;
      core_message: string;
      body_role: string;
      close_role: string;
      close_action: string;
    };
    const spokenScript = JSON.parse(
      await readFile(path.join(outputDir, "02-spoken-script.json"), "utf8"),
    ) as {
      artifact_type: string;
      sections: Array<{ lines: string[] }>;
    };
    const prompt = JSON.parse(
      await readFile(path.join(outputDir, "03-eleven-v3-prompt.json"), "utf8"),
    ) as {
      artifact_type: string;
      final_prompt: string;
    };
    const qaReport = JSON.parse(
      await readFile(path.join(outputDir, "04-qa-report.json"), "utf8"),
    ) as {
      artifact_type: string;
      overall_pass: boolean;
    };

    expect(brief.artifact_type).toBe("brief");
    expect(brief.core_message.length).toBeGreaterThan(0);
    expect(brief.body_role).toBe("recognition_reframe");
    expect(brief.close_role).toBe("single_soft_action");
    expect(brief.close_action.length).toBeGreaterThan(0);
    expect(spokenScript.artifact_type).toBe("spoken_script");
    expect(spokenScript.sections).toHaveLength(3);
    expect(prompt.artifact_type).toBe("eleven_v3_prompt");
    expect(prompt.final_prompt).toContain("Script:");
    expect(qaReport.artifact_type).toBe("qa_report");
    expect(qaReport.overall_pass).toBe(true);
  });

  it("reruns later stages from an edited brief artifact", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "note2voice-"));
    const outputDir = path.join(tempRoot, "rerun");

    await runGenerateCommand({
      command: "generate",
      inputPath: path.resolve("samples/note-01.md"),
      outputDir,
      stage: "brief",
      mock: true,
    });

    const briefPath = path.join(outputDir, "01-brief.json");
    const brief = JSON.parse(await readFile(briefPath, "utf8")) as {
      core_message: string;
    };
    brief.core_message = "最初の一歩は、一個だけ見える状態を作ること。";
    await writeFile(
      `${briefPath}`,
      `${JSON.stringify(brief, null, 2)}\n`,
      "utf8",
    );

    const exitCode = await runGenerateCommand({
      command: "generate",
      inputPath: path.resolve("samples/note-01.md"),
      outputDir,
      fromStage: "spoken-script",
      mock: true,
    });

    expect(exitCode).toBe(0);

    const prompt = JSON.parse(
      await readFile(path.join(outputDir, "03-eleven-v3-prompt.json"), "utf8"),
    ) as {
      final_prompt: string;
    };

    expect(prompt.final_prompt).toContain("一個だけ見える状態");
  });
});
