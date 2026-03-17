import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  ensurePrerequisiteArtifacts,
  loadStageArtifact,
  writeGenerateArtifacts,
  writeManifest,
  writeStageArtifact,
} from "./artifacts.js";
import { StageExecutionError } from "./errors.js";
import {
  createMockBriefArtifact,
  createMockElevenV3PromptArtifact,
  createMockQaReportArtifact,
  createMockSpokenScriptArtifact,
} from "./mock-pipeline.js";
import {
  createSourceNoteArtifact,
  loadSourceNoteArtifact,
  parseNoteContent,
} from "./note.js";
import {
  getRequiredArtifactFiles,
  resolveRequestedStages,
} from "./pipeline.js";
import { runBriefToSpokenScriptStage } from "./stages/brief-to-spoken-script.js";
import { runNoteToBriefStage } from "./stages/note-to-brief.js";
import { runQaStage } from "./stages/qa.js";
import { runSpokenScriptToElevenPromptStage } from "./stages/spoken-script-to-eleven-prompt.js";
import type {
  BriefArtifact,
  ElevenV3PromptArtifact,
  ExecutionMode,
  GenerateCliOptions,
  PipelineArtifactBundle,
  PipelineRunErrorInfo,
  QaReportArtifact,
  RunManifest,
  SourceNoteArtifact,
  SpokenScriptArtifact,
  StageFailureKind,
  StageName,
} from "./types.js";

const INPUT_NOTE_FILE = "input-note.md";
const DEFAULT_ARTIFACTS_DIR = "artifacts";
const DEFAULT_SAMPLES_DIR = "samples";
const INVALID_RUN_NAME_CHARACTERS = new Set([
  "<",
  ">",
  ":",
  '"',
  "/",
  "\\",
  "|",
  "?",
  "*",
]);

export interface GenerateFromTextInput {
  noteContent: string;
  runName?: string;
  stage?: StageName;
  fromStage?: StageName;
  mock?: boolean;
  artifactsRoot?: string;
}

export interface GeneratePipelineResult {
  inputFile: string;
  outputDir: string;
  artifacts: PipelineArtifactBundle;
  writtenStages: StageName[];
}

export interface SampleNoteSummary {
  id: string;
  title: string;
  filePath: string;
  content: string;
}

function resolveExecutionMode(mock: boolean): ExecutionMode {
  return mock ? "mock" : "real";
}

function toStageErrorInfo(error: StageExecutionError): PipelineRunErrorInfo {
  return {
    stage: error.stage,
    kind: error.kind,
    message: error.message,
  };
}

async function markStageLoaded(
  outputDir: string,
  manifest: RunManifest,
  stage: StageName,
): Promise<void> {
  const fileName = manifest.files.planned_stage_files[stage];
  manifest.stage_results[stage] = {
    status: "loaded",
    validated: true,
    ...(fileName ? { file_name: fileName } : {}),
  };
  await writeManifest(outputDir, manifest);
}

async function markStageCompleted(
  outputDir: string,
  manifest: RunManifest,
  stage: StageName,
  mode: ExecutionMode,
  fileName: string,
): Promise<void> {
  manifest.stage_results[stage] = {
    status: "completed",
    file_name: fileName,
    mode,
    validated: true,
  };
  manifest.last_stage_completed = stage;
  await writeManifest(outputDir, manifest);
}

async function markStageFailed(
  outputDir: string,
  manifest: RunManifest,
  stage: StageName,
  kind: StageFailureKind,
  message: string,
  mode: ExecutionMode,
): Promise<void> {
  const fileName = manifest.files.planned_stage_files[stage];
  manifest.status = "failed";
  manifest.failed_stage = stage;
  manifest.error = {
    kind,
    message,
  };
  manifest.stage_results[stage] = {
    status: "failed",
    mode,
    validated: false,
    error_kind: kind,
    error_message: message,
    ...(fileName ? { file_name: fileName } : {}),
  };
  await writeManifest(outputDir, manifest);
}

async function loadExistingStageArtifact<T>(
  outputDir: string,
  manifest: RunManifest,
  stage: StageName,
): Promise<T> {
  const artifact = await loadStageArtifact<T>(outputDir, stage);
  await markStageLoaded(outputDir, manifest, stage);
  return artifact;
}

async function executeStage<T>(
  options: GenerateCliOptions,
  manifest: RunManifest,
  stage: StageName,
  producer: () => Promise<T>,
): Promise<T> {
  const executionMode = resolveExecutionMode(options.mock);

  try {
    const artifact = await producer();
    const fileName = await writeStageArtifact(
      options.outputDir,
      stage,
      artifact,
    );
    await markStageCompleted(
      options.outputDir,
      manifest,
      stage,
      executionMode,
      fileName,
    );
    return artifact;
  } catch (error) {
    if (error instanceof StageExecutionError) {
      await markStageFailed(
        options.outputDir,
        manifest,
        error.stage,
        error.kind,
        error.message,
        executionMode,
      );
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    const stageError = new StageExecutionError(stage, "runtime_error", message);
    await markStageFailed(
      options.outputDir,
      manifest,
      stage,
      stageError.kind,
      stageError.message,
      executionMode,
    );
    throw stageError;
  }
}

async function createBriefArtifact(
  note: SourceNoteArtifact,
  mock: boolean,
): Promise<BriefArtifact> {
  if (mock) {
    return createMockBriefArtifact(note);
  }

  return runNoteToBriefStage(note);
}

async function createSpokenScriptArtifact(
  brief: BriefArtifact,
  mock: boolean,
): Promise<SpokenScriptArtifact> {
  if (mock) {
    return createMockSpokenScriptArtifact(brief);
  }

  return runBriefToSpokenScriptStage(brief);
}

async function createElevenPromptArtifact(
  spokenScript: SpokenScriptArtifact,
  mock: boolean,
): Promise<ElevenV3PromptArtifact> {
  if (mock) {
    return createMockElevenV3PromptArtifact(spokenScript);
  }

  return runSpokenScriptToElevenPromptStage(spokenScript);
}

async function createQaReportArtifact(
  note: SourceNoteArtifact,
  brief: BriefArtifact,
  spokenScript: SpokenScriptArtifact,
  elevenPrompt: ElevenV3PromptArtifact,
  mock: boolean,
): Promise<QaReportArtifact> {
  if (mock) {
    return createMockQaReportArtifact(note, brief, spokenScript, elevenPrompt);
  }

  return runQaStage(note, brief, spokenScript, elevenPrompt);
}

export function sanitizeRunName(input: string | undefined): string {
  const filtered = Array.from((input ?? "").trim())
    .filter((character) => character >= " ")
    .filter((character) => !INVALID_RUN_NAME_CHARACTERS.has(character))
    .join("");
  const normalized = filtered
    .replace(/\s+/g, "-")
    .replace(/\.+$/g, "")
    .replace(/^-+|-+$/g, "");

  if (normalized.length > 0) {
    return normalized.slice(0, 64);
  }

  const stamp = new Date().toISOString().replace(/[.:]/g, "-");
  return `run-${stamp}`;
}

function buildGenerateOptions(
  inputPath: string,
  outputDir: string,
  stage: StageName | undefined,
  fromStage: StageName | undefined,
  mock: boolean,
): GenerateCliOptions {
  const options: GenerateCliOptions = {
    command: "generate",
    inputPath,
    outputDir,
    mock,
  };

  if (stage) {
    options.stage = stage;
  }

  if (fromStage) {
    options.fromStage = fromStage;
  }

  return options;
}

function hasRequestedStage(
  requestedStages: StageName[],
  stage: StageName,
): boolean {
  return requestedStages.includes(stage);
}

async function runRequestedStages(
  options: GenerateCliOptions,
  note: SourceNoteArtifact,
  manifest: RunManifest,
): Promise<{
  artifacts: PipelineArtifactBundle;
  writtenStages: StageName[];
}> {
  const requestedStages = resolveRequestedStages(options);
  const artifacts: PipelineArtifactBundle = {
    sourceNote: note,
    manifest,
  };
  const writtenStages: StageName[] = [];
  let brief: BriefArtifact | undefined;
  let spokenScript: SpokenScriptArtifact | undefined;
  let elevenPrompt: ElevenV3PromptArtifact | undefined;
  let qaReport: QaReportArtifact | undefined;

  if (hasRequestedStage(requestedStages, "brief")) {
    brief = await executeStage(options, manifest, "brief", async () =>
      createBriefArtifact(note, options.mock),
    );
    artifacts.brief = brief;
    writtenStages.push("brief");
  } else if (requestedStages.some((stage) => stage !== "brief")) {
    brief = await loadExistingStageArtifact<BriefArtifact>(
      options.outputDir,
      manifest,
      "brief",
    );
    artifacts.brief = brief;
  }

  if (hasRequestedStage(requestedStages, "spoken-script")) {
    if (!brief) {
      throw new StageExecutionError(
        "spoken-script",
        "runtime_error",
        "brief artifact is required before generating spoken-script.",
      );
    }

    spokenScript = await executeStage(
      options,
      manifest,
      "spoken-script",
      async () => createSpokenScriptArtifact(brief, options.mock),
    );
    artifacts.spokenScript = spokenScript;
    writtenStages.push("spoken-script");
  } else if (
    requestedStages.some(
      (stage) => stage === "eleven-v3-prompt" || stage === "qa",
    )
  ) {
    spokenScript = await loadExistingStageArtifact<SpokenScriptArtifact>(
      options.outputDir,
      manifest,
      "spoken-script",
    );
    artifacts.spokenScript = spokenScript;
  }

  if (hasRequestedStage(requestedStages, "eleven-v3-prompt")) {
    if (!spokenScript) {
      throw new StageExecutionError(
        "eleven-v3-prompt",
        "runtime_error",
        "spoken-script artifact is required before generating eleven-v3-prompt.",
      );
    }

    elevenPrompt = await executeStage(
      options,
      manifest,
      "eleven-v3-prompt",
      async () => createElevenPromptArtifact(spokenScript, options.mock),
    );
    artifacts.elevenV3Prompt = elevenPrompt;
    writtenStages.push("eleven-v3-prompt");
  } else if (hasRequestedStage(requestedStages, "qa")) {
    elevenPrompt = await loadExistingStageArtifact<ElevenV3PromptArtifact>(
      options.outputDir,
      manifest,
      "eleven-v3-prompt",
    );
    artifacts.elevenV3Prompt = elevenPrompt;
  }

  if (hasRequestedStage(requestedStages, "qa")) {
    if (!brief || !spokenScript || !elevenPrompt) {
      throw new StageExecutionError(
        "qa",
        "runtime_error",
        "brief, spoken-script, and eleven-v3-prompt are required before qa.",
      );
    }

    qaReport = await executeStage(options, manifest, "qa", async () =>
      createQaReportArtifact(
        note,
        brief,
        spokenScript,
        elevenPrompt,
        options.mock,
      ),
    );
    artifacts.qaReport = qaReport;
    writtenStages.push("qa");
  }

  return {
    artifacts,
    writtenStages,
  };
}

async function runGeneratePipeline(
  options: GenerateCliOptions,
  note: SourceNoteArtifact,
): Promise<GeneratePipelineResult> {
  await mkdir(options.outputDir, { recursive: true });
  const manifest = await writeGenerateArtifacts(options, note);
  const requestedStages = resolveRequestedStages(options);
  const firstStage = requestedStages[0] ?? "brief";

  try {
    const requiredFiles = getRequiredArtifactFiles(options);

    if (requiredFiles.length > 0) {
      await ensurePrerequisiteArtifacts(options.outputDir, requiredFiles);
    }

    const stageResults = await runRequestedStages(options, note, manifest);
    manifest.status = "completed";
    delete manifest.failed_stage;
    delete manifest.error;
    await writeManifest(options.outputDir, manifest);

    return {
      inputFile: note.source_path,
      outputDir: path.resolve(options.outputDir),
      artifacts: stageResults.artifacts,
      writtenStages: stageResults.writtenStages,
    };
  } catch (error) {
    if (error instanceof StageExecutionError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    const stageError = new StageExecutionError(
      firstStage,
      "runtime_error",
      message,
    );

    if (manifest.status !== "failed") {
      await markStageFailed(
        options.outputDir,
        manifest,
        stageError.stage,
        stageError.kind,
        stageError.message,
        resolveExecutionMode(options.mock),
      );
    }

    throw stageError;
  }
}

export async function generateArtifactsFromFile(
  options: GenerateCliOptions,
): Promise<GeneratePipelineResult> {
  const note = await loadSourceNoteArtifact(options.inputPath);
  return runGeneratePipeline(options, note);
}

export async function generateArtifactsFromText(
  input: GenerateFromTextInput,
): Promise<GeneratePipelineResult> {
  const runName = sanitizeRunName(input.runName);
  const artifactsRoot = path.resolve(
    input.artifactsRoot ?? DEFAULT_ARTIFACTS_DIR,
  );
  const outputDir = path.join(artifactsRoot, runName);
  const inputFile = path.join(outputDir, INPUT_NOTE_FILE);
  const options = buildGenerateOptions(
    inputFile,
    outputDir,
    input.stage,
    input.fromStage,
    input.mock ?? true,
  );

  await mkdir(outputDir, { recursive: true });
  await writeFile(inputFile, input.noteContent, "utf8");

  const sourceNote = createSourceNoteArtifact(input.noteContent, inputFile);
  return runGeneratePipeline(options, sourceNote);
}

export async function loadSampleNotes(
  samplesDir = DEFAULT_SAMPLES_DIR,
): Promise<SampleNoteSummary[]> {
  const resolvedSamplesDir = path.resolve(samplesDir);
  const entries = await readdir(resolvedSamplesDir, { withFileTypes: true });
  const noteFiles = entries
    .filter((entry) => entry.isFile())
    .filter((entry) => /\.md$|\.txt$/i.test(entry.name))
    .sort((left, right) => left.name.localeCompare(right.name, "ja"));

  const samples = await Promise.all(
    noteFiles.map(async (entry) => {
      const filePath = path.join(resolvedSamplesDir, entry.name);
      const content = await readFile(filePath, "utf8");
      const { metadata } = parseNoteContent(content);

      return {
        id: metadata.id || path.parse(entry.name).name,
        title: metadata.title || path.parse(entry.name).name,
        filePath,
        content,
      };
    }),
  );

  return samples;
}

export { toStageErrorInfo };
