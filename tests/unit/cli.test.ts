import { describe, expect, it } from "vitest";

import { formatHelp, parseCliArgs } from "../../src/cli.js";

describe("parseCliArgs", () => {
  it("parses generate arguments", () => {
    const parsed = parseCliArgs([
      "generate",
      "--input",
      "./samples/note-01.md",
      "--output",
      "./artifacts/sample-01",
      "--mock",
    ]);

    expect(parsed).toEqual({
      command: "generate",
      inputPath: "./samples/note-01.md",
      outputDir: "./artifacts/sample-01",
      mock: true,
    });
  });

  it("rejects invalid stage values", () => {
    expect(() =>
      parseCliArgs([
        "generate",
        "--input",
        "./samples/note-01.md",
        "--output",
        "./artifacts/sample-01",
        "--stage",
        "invalid-stage",
      ]),
    ).toThrow("Invalid --stage value");
  });

  it("shows allowed stages in help output", () => {
    expect(formatHelp()).toContain("spoken-script");
    expect(formatHelp()).toContain("eleven-v3-prompt");
  });
});
