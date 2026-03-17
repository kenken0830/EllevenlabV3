import { constants } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  getPlannedStageFiles,
  resolveRequestedStages,
  resolveStageMode,
} from "./pipeline.js";
import {
  type ExecutionMode,
  type GenerateCliOptions,
  MANIFEST_FILE,
  type QaReportArtifact,
  type RunManifest,
  SCHEMA_VERSION,
  SOURCE_NOTE_FILE,
  type SourceNoteArtifact,
  STAGE_FILE_NAMES,
  type StageName,
} from "./types.js";
import { validateStageArtifact } from "./validation.js";

async function writeJson(filePath: string, value: unknown): Promise<void> {
  const content = `${JSON.stringify(value, null, 2)}\n`;
  await writeFile(filePath, content, "utf8");
}

export async function ensurePrerequisiteArtifacts(
  outputDir: string,
  requiredFiles: string[],
): Promise<void> {
  const missingFiles: string[] = [];
  const resolvedOutputDir = path.resolve(outputDir);

  for (const requiredFile of requiredFiles) {
    try {
      await access(path.join(resolvedOutputDir, requiredFile), constants.F_OK);
    } catch {
      missingFiles.push(requiredFile);
    }
  }

  if (missingFiles.length > 0) {
    throw new Error(
      `Missing prerequisite artifacts in ${resolvedOutputDir}: ${missingFiles.join(", ")}`,
    );
  }
}

function resolveExecutionMode(mock: boolean): ExecutionMode {
  return mock ? "mock" : "real";
}

export async function writeManifest(
  outputDir: string,
  manifest: RunManifest,
): Promise<void> {
  await writeJson(path.join(path.resolve(outputDir), MANIFEST_FILE), manifest);
}

export async function writeGenerateArtifacts(
  options: GenerateCliOptions,
  note: SourceNoteArtifact,
): Promise<RunManifest> {
  const resolvedOutputDir = path.resolve(options.outputDir);
  const stagesRequested = resolveRequestedStages(options);
  const plannedStageFiles = getPlannedStageFiles(stagesRequested);
  const stageResults = Object.fromEntries(
    stagesRequested.map((stage) => [
      stage,
      {
        status: "pending",
      },
    ]),
  ) as RunManifest["stage_results"];

  await mkdir(resolvedOutputDir, { recursive: true });

  const manifest: RunManifest = {
    schema_version: SCHEMA_VERSION,
    run_name: path.basename(resolvedOutputDir),
    command: "generate",
    input_file: note.source_path,
    output_dir: resolvedOutputDir,
    created_at: new Date().toISOString(),
    stage_mode: resolveStageMode(options),
    stages_requested: stagesRequested,
    mock_mode: options.mock,
    execution_mode: resolveExecutionMode(options.mock),
    status: "running",
    stage_results: stageResults,
    files: {
      source_note: SOURCE_NOTE_FILE,
      manifest: MANIFEST_FILE,
      planned_stage_files: plannedStageFiles,
    },
  };

  await writeJson(path.join(resolvedOutputDir, SOURCE_NOTE_FILE), note);
  await writeManifest(resolvedOutputDir, manifest);

  return manifest;
}

export async function writeStageArtifact(
  outputDir: string,
  stage: StageName,
  artifact: unknown,
): Promise<string> {
  validateStageArtifact(stage, artifact);

  const resolvedOutputDir = path.resolve(outputDir);
  await mkdir(resolvedOutputDir, { recursive: true });

  const fileName = STAGE_FILE_NAMES[stage];
  const filePath = path.join(resolvedOutputDir, fileName);
  await writeJson(filePath, artifact);
  return fileName;
}

export async function loadStageArtifact<T>(
  outputDir: string,
  stage: StageName,
): Promise<T> {
  const filePath = path.join(path.resolve(outputDir), STAGE_FILE_NAMES[stage]);
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  validateStageArtifact(stage, parsed);
  return parsed as T;
}

export async function loadQaReport(
  outputDir: string,
): Promise<QaReportArtifact> {
  return loadStageArtifact<QaReportArtifact>(outputDir, "qa");
}
