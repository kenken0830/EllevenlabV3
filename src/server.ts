import { readFile } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { loadLocalEnvFiles } from "./env.js";
import { isStageExecutionError } from "./errors.js";
import { isStageName } from "./pipeline.js";
import {
  type GenerateFromTextInput,
  generateArtifactsFromText,
  loadSampleNotes,
} from "./service.js";
import type { StageFailureKind, StageName } from "./types.js";

await loadLocalEnvFiles();

const HOST = process.env.HOST ?? "127.0.0.1";
const PORT = Number(process.env.PORT ?? 4173);
const PUBLIC_DIR = path.resolve("public");

interface GenerateRequestBody {
  noteContent?: unknown;
  runName?: unknown;
  stageMode?: unknown;
  stageValue?: unknown;
  mock?: unknown;
}

function sendJson(
  response: ServerResponse,
  statusCode: number,
  payload: unknown,
): void {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(`${JSON.stringify(payload)}\n`);
}

function sendText(
  response: ServerResponse,
  statusCode: number,
  payload: string,
): void {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(payload);
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");

  if (!raw) {
    return {};
  }

  return JSON.parse(raw);
}

function resolveStaticFile(urlPath: string): string {
  const relativePath = urlPath === "/" ? "/index.html" : urlPath;
  const normalizedPath = path
    .normalize(relativePath)
    .replace(/^([.][.][/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, normalizedPath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    return path.join(PUBLIC_DIR, "index.html");
  }

  return filePath;
}

function getContentType(filePath: string): string {
  if (filePath.endsWith(".html")) {
    return "text/html; charset=utf-8";
  }

  if (filePath.endsWith(".css")) {
    return "text/css; charset=utf-8";
  }

  if (filePath.endsWith(".js")) {
    return "application/javascript; charset=utf-8";
  }

  if (filePath.endsWith(".json")) {
    return "application/json; charset=utf-8";
  }

  return "text/plain; charset=utf-8";
}

function parseStageSelection(body: GenerateRequestBody): {
  stage?: StageName;
  fromStage?: StageName;
} {
  const stageMode = body.stageMode;
  const stageValue = body.stageValue;

  if (
    stageMode !== undefined &&
    stageMode !== "all" &&
    stageMode !== "stage" &&
    stageMode !== "from"
  ) {
    throw new Error("stageMode must be one of all, stage, from.");
  }

  if (stageMode === "stage") {
    if (typeof stageValue !== "string" || !isStageName(stageValue)) {
      throw new Error(
        "stageValue must be a valid stage when stageMode is stage.",
      );
    }

    return { stage: stageValue };
  }

  if (stageMode === "from") {
    if (typeof stageValue !== "string" || !isStageName(stageValue)) {
      throw new Error(
        "stageValue must be a valid stage when stageMode is from.",
      );
    }

    return { fromStage: stageValue };
  }

  return {};
}

function statusCodeForFailure(kind: StageFailureKind): number {
  switch (kind) {
    case "configuration_error":
      return 500;
    case "validation_error":
      return 422;
    case "refusal":
      return 422;
    case "runtime_error":
      return 500;
  }
}

async function handleGenerate(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const body = (await readJsonBody(request)) as GenerateRequestBody;

  if (
    typeof body.noteContent !== "string" ||
    body.noteContent.trim().length === 0
  ) {
    sendJson(response, 400, {
      ok: false,
      error: "noteContent is required.",
    });
    return;
  }

  const selection = parseStageSelection(body);
  const input: GenerateFromTextInput = {
    noteContent: body.noteContent,
    mock: body.mock !== false,
  };

  if (typeof body.runName === "string") {
    input.runName = body.runName;
  }

  if (selection.stage) {
    input.stage = selection.stage;
  }

  if (selection.fromStage) {
    input.fromStage = selection.fromStage;
  }

  try {
    const result = await generateArtifactsFromText(input);

    sendJson(response, 200, {
      ok: true,
      data: result,
    });
  } catch (error) {
    if (isStageExecutionError(error)) {
      sendJson(response, statusCodeForFailure(error.kind), {
        ok: false,
        error: error.message,
        stage: error.stage,
        kind: error.kind,
      });
      return;
    }

    throw error;
  }
}

async function handleSamples(response: ServerResponse): Promise<void> {
  const samples = await loadSampleNotes();
  sendJson(response, 200, {
    ok: true,
    data: samples,
  });
}

async function handleStatic(
  urlPath: string,
  response: ServerResponse,
): Promise<void> {
  const filePath = resolveStaticFile(urlPath);

  try {
    const content = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": getContentType(filePath),
      "Cache-Control": "no-store",
    });
    response.end(content);
  } catch {
    sendText(response, 404, "Not Found");
  }
}

export function createAppServer() {
  return createServer(async (request, response) => {
    try {
      const method = request.method ?? "GET";
      const url = new URL(request.url ?? "/", `http://${HOST}:${PORT}`);

      if (method === "GET" && url.pathname === "/api/health") {
        sendJson(response, 200, {
          ok: true,
          openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
        });
        return;
      }

      if (method === "GET" && url.pathname === "/api/samples") {
        await handleSamples(response);
        return;
      }

      if (method === "POST" && url.pathname === "/api/generate") {
        await handleGenerate(request, response);
        return;
      }

      if (method === "GET") {
        await handleStatic(url.pathname, response);
        return;
      }

      sendText(response, 405, "Method Not Allowed");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Internal Server Error";
      sendJson(response, 500, {
        ok: false,
        error: message,
      });
    }
  });
}

export async function startServer(): Promise<void> {
  const server = createAppServer();

  await new Promise<void>((resolve) => {
    server.listen(PORT, HOST, () => {
      console.log(`note2voice UI is running at http://${HOST}:${PORT}`);
      resolve();
    });
  });
}

const entryPoint = process.argv[1];

if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  await startServer();
}
