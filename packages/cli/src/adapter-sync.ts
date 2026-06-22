import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  adapterTemplateFiles,
  type AdapterTemplateFile,
  type ManagedBlockStyle,
} from "./adapter-templates.js";

export interface SyncApertureAdaptersOptions {
  readonly cwd: string;
  readonly force?: boolean;
}

export interface SyncApertureAdaptersReport {
  readonly targetDir: string;
  readonly written: readonly string[];
  readonly changed: readonly string[];
  readonly unchanged: readonly string[];
  readonly skipped: readonly string[];
  readonly conflicted: readonly SyncApertureAdapterConflict[];
}

export interface SyncApertureAdapterConflict {
  readonly path: string;
  readonly reason: string;
}

type SyncApertureAdapterFileResult =
  | { readonly status: "written" | "changed" | "unchanged" | "skipped" }
  | {
      readonly status: "conflicted";
      readonly reason: string;
    };

const MANAGED_BLOCK_ID = "aperture-ai-tools";

export async function syncApertureAdapters(
  options: SyncApertureAdaptersOptions,
): Promise<SyncApertureAdaptersReport> {
  const targetDir = path.resolve(options.cwd);
  const written: string[] = [];
  const changed: string[] = [];
  const unchanged: string[] = [];
  const skipped: string[] = [];
  const conflicted: SyncApertureAdapterConflict[] = [];

  for (const file of adapterTemplateFiles()) {
    const result = await syncAdapterTemplateFile({
      file,
      targetDir,
      force: options.force === true,
    });

    if (result.status === "written") {
      written.push(file.path);
    } else if (result.status === "changed") {
      changed.push(file.path);
    } else if (result.status === "unchanged") {
      unchanged.push(file.path);
    } else if (result.status === "skipped") {
      skipped.push(file.path);
    } else if (result.status === "conflicted") {
      conflicted.push({ path: file.path, reason: result.reason });
    }
  }

  return { targetDir, written, changed, unchanged, skipped, conflicted };
}

async function syncAdapterTemplateFile(input: {
  readonly file: AdapterTemplateFile;
  readonly targetDir: string;
  readonly force: boolean;
}): Promise<SyncApertureAdapterFileResult> {
  const absolutePath = path.join(input.targetDir, input.file.path);
  const exists = await fileExists(absolutePath);

  if (!exists) {
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, input.file.contents, "utf8");
    return { status: "written" };
  }

  const existingContents = await readFile(absolutePath, "utf8");

  if (input.force) {
    if (existingContents === input.file.contents) {
      return { status: "unchanged" };
    }

    await writeFile(absolutePath, input.file.contents, "utf8");
    return { status: "changed" };
  }

  if (input.file.sync.kind === "jsonMcpServer") {
    return syncJsonMcpServerFile({
      path: absolutePath,
      desiredContents: input.file.contents,
      existingContents,
    });
  }

  return syncManagedBlockFile({
    path: absolutePath,
    style: input.file.sync.style,
    desiredContents: input.file.contents,
    existingContents,
  });
}

async function syncManagedBlockFile(input: {
  readonly path: string;
  readonly style: ManagedBlockStyle;
  readonly desiredContents: string;
  readonly existingContents: string;
}): Promise<SyncApertureAdapterFileResult> {
  const desiredBlock = readManagedBlock(input.desiredContents, input.style);

  if (desiredBlock.status !== "found") {
    return {
      status: "conflicted",
      reason: "Internal adapter template is missing its managed block markers.",
    };
  }

  const existingBlock = readManagedBlock(input.existingContents, input.style);
  if (existingBlock.status === "partial") {
    return {
      status: "conflicted",
      reason: "Existing file has incomplete Aperture managed block markers.",
    };
  }

  const nextContents =
    existingBlock.status === "found"
      ? `${input.existingContents.slice(0, existingBlock.start)}${
          desiredBlock.block
        }${input.existingContents.slice(existingBlock.end)}`
      : input.existingContents.trim().length === 0
        ? input.desiredContents
        : appendManagedBlock(input.existingContents, desiredBlock.block);

  if (nextContents === input.existingContents) {
    return { status: "unchanged" };
  }

  await writeFile(input.path, nextContents, "utf8");
  return { status: "changed" };
}

async function syncJsonMcpServerFile(input: {
  readonly path: string;
  readonly desiredContents: string;
  readonly existingContents: string;
}): Promise<SyncApertureAdapterFileResult> {
  const desiredJson = parseJsonObject(input.desiredContents);

  if (desiredJson.status !== "ok") {
    return {
      status: "conflicted",
      reason: "Internal adapter template is not valid JSON.",
    };
  }

  const desiredServer = readApertureMcpServer(desiredJson.value);
  if (desiredServer === undefined) {
    return {
      status: "conflicted",
      reason: "Internal adapter template is missing mcpServers.aperture.",
    };
  }

  const existingJson = parseJsonObject(input.existingContents);
  if (existingJson.status !== "ok") {
    return {
      status: "conflicted",
      reason: "Existing JSON could not be parsed.",
    };
  }

  const existingServers = readMcpServers(existingJson.value);
  const existingApertureServer = existingServers.aperture;
  if (jsonEqual(existingApertureServer, desiredServer)) {
    return { status: "unchanged" };
  }

  const nextJson = {
    ...existingJson.value,
    mcpServers: {
      ...existingServers,
      aperture: desiredServer,
    },
  };

  await writeFile(input.path, `${JSON.stringify(nextJson, null, 2)}\n`, "utf8");
  return { status: "changed" };
}

function readManagedBlock(
  contents: string,
  style: ManagedBlockStyle,
):
  | {
      readonly status: "found";
      readonly start: number;
      readonly end: number;
      readonly block: string;
    }
  | { readonly status: "missing" }
  | { readonly status: "partial" } {
  const startMarker = managedBlockStart(style);
  const endMarker = managedBlockEnd(style);
  const start = contents.indexOf(startMarker);
  const end = start === -1 ? -1 : contents.indexOf(endMarker, start);

  if (start === -1 && contents.indexOf(endMarker) === -1) {
    return { status: "missing" };
  }

  if (start === -1 || end === -1) {
    return { status: "partial" };
  }

  const endMarkerEnd = end + endMarker.length;
  const blockEnd = contents.startsWith("\r\n", endMarkerEnd)
    ? endMarkerEnd + 2
    : contents.startsWith("\n", endMarkerEnd)
      ? endMarkerEnd + 1
      : endMarkerEnd;

  return {
    status: "found",
    start,
    end: blockEnd,
    block: contents.slice(start, blockEnd),
  };
}

function appendManagedBlock(contents: string, block: string): string {
  const trimmed = contents.trimEnd();
  const normalizedBlock = block.endsWith("\n") ? block : `${block}\n`;

  return `${trimmed}\n\n${normalizedBlock}`;
}

function managedBlockStart(style: ManagedBlockStyle): string {
  return style === "hash"
    ? `# aperture-managed:start ${MANAGED_BLOCK_ID}`
    : `<!-- aperture-managed:start ${MANAGED_BLOCK_ID} -->`;
}

function managedBlockEnd(style: ManagedBlockStyle): string {
  return style === "hash"
    ? `# aperture-managed:end ${MANAGED_BLOCK_ID}`
    : `<!-- aperture-managed:end ${MANAGED_BLOCK_ID} -->`;
}

function parseJsonObject(
  contents: string,
):
  | { readonly status: "ok"; readonly value: Record<string, unknown> }
  | { readonly status: "error" } {
  try {
    const value = JSON.parse(contents) as unknown;

    if (isRecord(value)) {
      return { status: "ok", value };
    }
  } catch {
    return { status: "error" };
  }

  return { status: "error" };
}

function readApertureMcpServer(
  value: Record<string, unknown>,
): unknown | undefined {
  const servers = readMcpServers(value);

  return servers.aperture;
}

function readMcpServers(
  value: Record<string, unknown>,
): Record<string, unknown> {
  const servers = value.mcpServers;

  return isRecord(servers) ? servers : {};
}

function jsonEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch (error: unknown) {
    if (isNodeErrorCode(error, "ENOENT")) {
      return false;
    }

    throw error;
  }
}

function isNodeErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { readonly code?: unknown }).code === code
  );
}
