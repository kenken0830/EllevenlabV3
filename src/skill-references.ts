import { readFile } from "node:fs/promises";
import path from "node:path";

const REFERENCE_DIR = path.resolve(
  ".agents",
  "skills",
  "eleven-v3-ja-pipeline",
  "references",
);
const cache = new Map<string, string>();

export async function loadSkillReference(fileName: string): Promise<string> {
  const cached = cache.get(fileName);

  if (cached) {
    return cached;
  }

  const filePath = path.join(REFERENCE_DIR, fileName);
  const content = await readFile(filePath, "utf8");
  cache.set(fileName, content.trim());
  return content.trim();
}
