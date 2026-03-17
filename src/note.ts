import { readFile } from "node:fs/promises";
import path from "node:path";

import { SCHEMA_VERSION, type SourceNoteArtifact } from "./types.js";

const FRONT_MATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export interface ParsedNoteContent {
  metadata: Record<string, string>;
  body: string;
}

export function parseNoteContent(raw: string): ParsedNoteContent {
  const matchedFrontMatter = raw.match(FRONT_MATTER_PATTERN);

  if (!matchedFrontMatter) {
    return {
      metadata: {},
      body: raw.trim(),
    };
  }

  const metadataBlock = matchedFrontMatter[1] ?? "";
  const body = raw.slice(matchedFrontMatter[0].length).trim();
  const metadata: Record<string, string> = {};

  for (const line of metadataBlock.split(/\r?\n/)) {
    const separatorIndex = line.indexOf(":");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (key) {
      metadata[key] = value;
    }
  }

  return {
    metadata,
    body,
  };
}

export function createSourceNoteArtifact(
  raw: string,
  sourcePath: string,
): SourceNoteArtifact {
  const { metadata, body } = parseNoteContent(raw);
  const nonEmptyLines = body
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (nonEmptyLines.length < 2) {
    throw new Error("Note body must contain at least 2 non-empty lines.");
  }

  const parsedPath = path.parse(sourcePath);
  const id = metadata.id || parsedPath.name;
  const title = metadata.title || parsedPath.name;

  return {
    artifact_type: "source_note",
    version: SCHEMA_VERSION,
    id,
    title,
    source_path: sourcePath,
    body,
    metadata,
  };
}

export async function loadSourceNoteArtifact(
  inputPath: string,
): Promise<SourceNoteArtifact> {
  const absolutePath = path.resolve(inputPath);
  const raw = await readFile(absolutePath, "utf8");
  return createSourceNoteArtifact(raw, absolutePath);
}
