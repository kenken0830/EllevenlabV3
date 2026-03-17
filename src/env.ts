import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

const ENV_FILE_NAMES = [".env", ".env.local"] as const;
let loaded = false;

function decodeQuotedValue(value: string): string {
  if (value.length < 2) {
    return value;
  }

  const quote = value[0];

  if ((quote !== '"' && quote !== "'") || value.at(-1) !== quote) {
    return value;
  }

  const inner = value.slice(1, -1);

  if (quote === "'") {
    return inner;
  }

  return inner
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

function parseEnvContent(content: string): Record<string, string> {
  const entries: Record<string, string> = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const normalized = line.startsWith("export ") ? line.slice(7) : line;
    const separatorIndex = normalized.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = normalized.slice(0, separatorIndex).trim();
    const value = normalized.slice(separatorIndex + 1).trim();

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      continue;
    }

    entries[key] = decodeQuotedValue(value);
  }

  return entries;
}

export async function loadLocalEnvFiles(cwd = process.cwd()): Promise<void> {
  if (loaded) {
    return;
  }

  const loadedFromFiles = new Set<string>();

  for (const fileName of ENV_FILE_NAMES) {
    const filePath = path.join(cwd, fileName);

    try {
      await access(filePath, constants.F_OK);
    } catch {
      continue;
    }

    const entries = parseEnvContent(await readFile(filePath, "utf8"));

    for (const [key, value] of Object.entries(entries)) {
      if (process.env[key] === undefined || loadedFromFiles.has(key)) {
        process.env[key] = value;
        loadedFromFiles.add(key);
      }
    }
  }

  loaded = true;
}
