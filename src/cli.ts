import process from "node:process";
import { pathToFileURL } from "node:url";

import { loadQaReport } from "./artifacts.js";
import { loadLocalEnvFiles } from "./env.js";
import { isStageName } from "./pipeline.js";
import { generateArtifactsFromFile } from "./service.js";
import type {
  CliOptions,
  GenerateCliOptions,
  QaCliOptions,
  StageName,
} from "./types.js";

await loadLocalEnvFiles();

const VALUE_FLAGS = new Set(["--input", "--output", "--stage", "--from"]);
const BOOLEAN_FLAGS = new Set(["--help", "--mock"]);

function parseFlags(args: string[]): Map<string, string | boolean> {
  const flags = new Map<string, string | boolean>();

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];

    if (token === undefined) {
      throw new Error("Unexpected empty argument.");
    }

    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }

    if (BOOLEAN_FLAGS.has(token)) {
      flags.set(token, true);
      continue;
    }

    if (!VALUE_FLAGS.has(token)) {
      throw new Error(`Unknown flag: ${token}`);
    }

    const value = args[index + 1];

    if (typeof value !== "string" || value.startsWith("--")) {
      throw new Error(`Flag ${token} requires a value.`);
    }

    flags.set(token, value);
    index += 1;
  }

  return flags;
}

function getStringFlag(
  flags: Map<string, string | boolean>,
  name: string,
): string | undefined {
  const value = flags.get(name);
  return typeof value === "string" ? value : undefined;
}

export function formatHelp(): string {
  return [
    "Usage:",
    "  npm run cli -- generate --input <path> --output <dir> [--stage <stage> | --from <stage>] [--mock]",
    "  npm run cli -- qa --output <dir>",
    "",
    "Allowed stage values:",
    "  brief",
    "  spoken-script",
    "  eleven-v3-prompt",
    "  qa",
  ].join("\n");
}

export function parseCliArgs(argv: string[]): CliOptions {
  const [command, ...rest] = argv;

  if (
    !command ||
    command === "help" ||
    command === "--help" ||
    command === "-h"
  ) {
    return { command: "help" };
  }

  const flags = parseFlags(rest);

  if (flags.has("--help")) {
    return { command: "help" };
  }

  if (command === "generate") {
    const inputPath = getStringFlag(flags, "--input");
    const outputDir = getStringFlag(flags, "--output");
    const stageValue = getStringFlag(flags, "--stage");
    const fromValue = getStringFlag(flags, "--from");
    let stage: StageName | undefined;
    let fromStage: StageName | undefined;

    if (!inputPath) {
      throw new Error("generate requires --input.");
    }

    if (!outputDir) {
      throw new Error("generate requires --output.");
    }

    if (stageValue && fromValue) {
      throw new Error("--stage and --from cannot be used together.");
    }

    if (stageValue) {
      if (!isStageName(stageValue)) {
        throw new Error(`Invalid --stage value: ${stageValue}`);
      }

      stage = stageValue;
    }

    if (fromValue) {
      if (!isStageName(fromValue)) {
        throw new Error(`Invalid --from value: ${fromValue}`);
      }

      fromStage = fromValue;
    }

    const options: GenerateCliOptions = {
      command: "generate",
      inputPath,
      outputDir,
      mock: flags.get("--mock") === true,
    };

    if (stage !== undefined) {
      options.stage = stage;
    }

    if (fromStage !== undefined) {
      options.fromStage = fromStage;
    }

    return options;
  }

  if (command === "qa") {
    const outputDir = getStringFlag(flags, "--output");

    if (!outputDir) {
      throw new Error("qa requires --output.");
    }

    const options: QaCliOptions = {
      command: "qa",
      outputDir,
    };

    return options;
  }

  if (command === "generate-samples") {
    throw new Error("generate-samples is planned for a later milestone.");
  }

  throw new Error(`Unknown command: ${command}`);
}

export async function runGenerateCommand(
  options: GenerateCliOptions,
): Promise<number> {
  const result = await generateArtifactsFromFile(options);

  if (result.artifacts.qaReport) {
    return result.artifacts.qaReport.overall_pass ? 0 : 2;
  }

  return 0;
}

export async function runQaCommand(options: QaCliOptions): Promise<number> {
  const qaReport = await loadQaReport(options.outputDir);
  return qaReport.overall_pass ? 0 : 2;
}

export async function runCli(options: CliOptions): Promise<number> {
  switch (options.command) {
    case "help": {
      console.log(formatHelp());
      return 0;
    }
    case "generate": {
      return runGenerateCommand(options);
    }
    case "qa": {
      return runQaCommand(options);
    }
  }
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
  try {
    const options = parseCliArgs(argv);
    return await runCli(options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    return 1;
  }
}

const entryPoint = process.argv[1];

if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  const exitCode = await main();
  process.exitCode = exitCode;
}
