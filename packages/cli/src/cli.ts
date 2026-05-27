import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ApertureDevSessionError,
  openApertureDevSession,
  readApertureDevLogs,
  readApertureDevStatus,
  runApertureDevSessionDaemon,
  startApertureDevSession,
  stopApertureDevSession,
  type ApertureDevLogsReport,
  type ApertureDevUpReport,
} from "./dev-session.js";
import { runApertureMcpServer } from "./mcp.js";
import {
  buildApertureReferenceIndex,
  readApertureReferenceStatus,
  searchApertureReferences,
  warmApertureReferences,
  type ApertureReferenceSearchReport,
  type ApertureReferenceStatusReport,
  type BuildApertureReferenceIndexReport,
  type WarmApertureReferenceReport,
} from "./reference.js";
import type { ApertureDevSessionStatus } from "./session.js";
import { callApertureTool } from "./devtools-client.js";

const CLI_VERSION = "0.0.0";

export interface ApertureCliIo {
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
}

export interface RunApertureCliOptions extends Partial<ApertureCliIo> {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly entryPoint?: string;
}

export interface CreateApertureProjectOptions {
  readonly cwd: string;
  readonly name: string;
  readonly force?: boolean;
  readonly template?: ApertureCreateTemplate;
}

export interface CreateApertureProjectReport {
  readonly targetDir: string;
  readonly packageName: string;
  readonly template: ApertureCreateTemplate;
  readonly files: readonly string[];
}

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

interface ParsedCreateCommand {
  readonly name: string;
  readonly force: boolean;
  readonly template: ApertureCreateTemplate;
}

interface ParsedAdapterSyncCommand {
  readonly force: boolean;
}

interface ParsedDevUpCommand {
  readonly host?: string;
  readonly port?: number;
  readonly open: boolean;
  readonly headless?: boolean;
  readonly strictPort?: boolean;
}

interface ParsedDevLogsCommand {
  readonly lines?: number;
}

interface ParsedReferenceSearchCommand {
  readonly query: string;
  readonly limit?: number;
}

interface ParsedToolCommand {
  readonly name: string;
  readonly arguments?: Record<string, unknown>;
}

type TemplateFile = {
  readonly path: string;
  readonly contents: string | Uint8Array;
};

type ApertureCreateTemplate = "minimal" | "glb-viewer" | "game";

type ManagedBlockStyle = "html" | "hash";

type AdapterTemplateFile = Omit<TemplateFile, "contents"> & {
  readonly contents: string;
  readonly sync:
    | {
        readonly kind: "managedBlock";
        readonly style: ManagedBlockStyle;
      }
    | {
        readonly kind: "jsonMcpServer";
      };
};

type SyncApertureAdapterFileResult =
  | { readonly status: "written" | "changed" | "unchanged" | "skipped" }
  | {
      readonly status: "conflicted";
      readonly reason: string;
    };

const MANAGED_BLOCK_ID = "aperture-ai-tools";

export class ApertureCliError extends Error {
  readonly code: string;
  readonly exitCode: number;

  constructor(code: string, message: string, exitCode = 1) {
    super(message);
    this.name = "ApertureCliError";
    this.code = code;
    this.exitCode = exitCode;
  }
}

export async function runApertureCli(
  options: RunApertureCliOptions,
): Promise<number> {
  const io = resolveIo(options);
  const [command, ...rest] = options.argv;

  try {
    if (command === undefined || isHelpFlag(command)) {
      io.stdout(mainHelp());
      return 0;
    }

    if (command === "--version" || command === "-v") {
      io.stdout(`${CLI_VERSION}\n`);
      return 0;
    }

    if (command === "create") {
      if (rest.some(isHelpFlag)) {
        io.stdout(createHelp());
        return 0;
      }

      const parsed = parseCreateCommand(rest);
      const report = await createApertureProject({
        cwd: options.cwd,
        name: parsed.name,
        force: parsed.force,
        template: parsed.template,
      });

      io.stdout(createSuccessMessage(report, options.cwd));
      return 0;
    }

    if (command === "adapter") {
      if (rest.some(isHelpFlag)) {
        io.stdout(adapterHelp());
        return 0;
      }

      const [subcommand, ...subcommandRest] = rest;
      if (subcommand !== "sync") {
        throw new ApertureCliError(
          "aperture.adapter.unknownSubcommand",
          "The adapter command currently supports 'sync'. Run 'aperture adapter --help' for usage.",
        );
      }

      const parsed = parseAdapterSyncCommand(subcommandRest);
      const report = await syncApertureAdapters({
        cwd: options.cwd,
        force: parsed.force,
      });

      io.stdout(adapterSyncSuccessMessage(report));
      return 0;
    }

    if (command === "dev") {
      if (rest.some(isHelpFlag)) {
        io.stdout(devHelp());
        return 0;
      }

      const [subcommand, ...subcommandRest] = rest;

      if (subcommand === "up") {
        const parsed = parseDevUpCommand(subcommandRest);
        const report = await startApertureDevSession({
          cwd: options.cwd,
          entryPoint: options.entryPoint ?? defaultEntryPoint(),
          open: parsed.open,
          ...(parsed.host === undefined ? {} : { host: parsed.host }),
          ...(parsed.port === undefined ? {} : { port: parsed.port }),
          ...(parsed.headless === undefined
            ? {}
            : { headless: parsed.headless }),
          ...(parsed.strictPort === undefined
            ? {}
            : { strictPort: parsed.strictPort }),
        });

        io.stdout(devUpSuccessMessage(report));
        return 0;
      }

      if (subcommand === "status") {
        io.stdout(devStatusMessage(await readApertureDevStatus(options.cwd)));
        return 0;
      }

      if (subcommand === "logs") {
        const parsed = parseDevLogsCommand(subcommandRest);
        io.stdout(
          devLogsMessage(
            await readApertureDevLogs({
              cwd: options.cwd,
              ...(parsed.lines === undefined ? {} : { lines: parsed.lines }),
            }),
          ),
        );
        return 0;
      }

      if (subcommand === "open") {
        await openApertureDevSession(options.cwd);
        io.stdout("Opened Aperture dev session URL.\n");
        return 0;
      }

      if (subcommand === "down") {
        const report = await stopApertureDevSession({ cwd: options.cwd });
        io.stdout(
          report.hadSession
            ? "Stopped Aperture dev session.\n"
            : "No Aperture dev session was active.\n",
        );
        return 0;
      }

      if (subcommand === "daemon") {
        const parsed = parseDevUpCommand(subcommandRest);
        await runApertureDevSessionDaemon({
          cwd: options.cwd,
          open: parsed.open,
          ...(parsed.host === undefined ? {} : { host: parsed.host }),
          ...(parsed.port === undefined ? {} : { port: parsed.port }),
          ...(parsed.headless === undefined
            ? {}
            : { headless: parsed.headless }),
          ...(parsed.strictPort === undefined
            ? {}
            : { strictPort: parsed.strictPort }),
        });
        return 0;
      }

      throw new ApertureCliError(
        "aperture.dev.unknownSubcommand",
        "The dev command supports up, down, status, open, and logs. Run 'aperture dev --help' for usage.",
      );
    }

    if (command === "mcp") {
      if (rest.some(isHelpFlag)) {
        io.stdout(mcpHelp());
        return 0;
      }

      const [subcommand] = rest;
      if (subcommand !== "stdio") {
        throw new ApertureCliError(
          "aperture.mcp.unknownSubcommand",
          "The mcp command currently supports 'stdio'. Run 'aperture mcp --help' for usage.",
        );
      }

      await runApertureMcpServer({ cwd: options.cwd });
      return 0;
    }

    if (command === "tool") {
      if (rest.some(isHelpFlag)) {
        io.stdout(toolHelp());
        return 0;
      }

      const parsed = parseToolCommand(rest);
      const result = await callApertureTool({
        cwd: options.cwd,
        name: parsed.name,
        ...(parsed.arguments === undefined
          ? {}
          : { arguments: parsed.arguments }),
      });

      io.stdout(`${JSON.stringify(result, null, 2)}\n`);
      return 0;
    }

    if (command === "reference") {
      if (rest.some(isHelpFlag)) {
        io.stdout(referenceHelp());
        return 0;
      }

      const [subcommand, ...subcommandRest] = rest;

      if (subcommand === "warmup") {
        const parsed = parseReferenceWarmupCommand(subcommandRest);
        io.stdout(
          referenceWarmupMessage(
            await warmApertureReferences({
              cwd: options.cwd,
              ...(parsed.from === undefined ? {} : { from: parsed.from }),
            }),
          ),
        );
        return 0;
      }

      if (subcommand === "status") {
        io.stdout(
          referenceStatusMessage(
            await readApertureReferenceStatus(options.cwd),
          ),
        );
        return 0;
      }

      if (subcommand === "build") {
        io.stdout(
          referenceBuildMessage(
            await buildApertureReferenceIndex({ cwd: options.cwd }),
          ),
        );
        return 0;
      }

      if (subcommand === "search") {
        const parsed = parseReferenceSearchCommand(subcommandRest);
        io.stdout(
          referenceSearchMessage(
            await searchApertureReferences({
              cwd: options.cwd,
              query: parsed.query,
              ...(parsed.limit === undefined ? {} : { limit: parsed.limit }),
            }),
          ),
        );
        return 0;
      }

      throw new ApertureCliError(
        "aperture.reference.unknownSubcommand",
        "The reference command supports warmup, status, build, and search. Run 'aperture reference --help' for usage.",
      );
    }

    if (isPlannedCommand(command)) {
      if (rest.some(isHelpFlag)) {
        io.stdout(plannedCommandHelp(command));
        return 0;
      }

      throw new ApertureCliError(
        "aperture.cli.notImplemented",
        `The '${command}' command is planned for Aperture AI tooling but is not implemented yet.`,
      );
    }

    throw new ApertureCliError(
      "aperture.cli.unknownCommand",
      `Unknown Aperture command '${command}'. Run 'aperture --help' for available commands.`,
    );
  } catch (error: unknown) {
    if (
      error instanceof ApertureCliError ||
      error instanceof ApertureDevSessionError
    ) {
      io.stderr(`${error.code}: ${error.message}\n`);
      return error.exitCode;
    }

    const message = error instanceof Error ? error.message : String(error);
    io.stderr(`aperture.cli.failed: ${message}\n`);
    return 1;
  }
}

export async function createApertureProject(
  options: CreateApertureProjectOptions,
): Promise<CreateApertureProjectReport> {
  const targetDir = resolveTargetDir(options.cwd, options.name);
  const packageName = npmPackageNameFromPath(targetDir);

  await assertWritableTarget(targetDir, options.force === true);
  const template = options.template ?? "minimal";
  const files = createTemplateFiles({
    packageName,
    dependencySpec: defaultApertureDependencySpec(),
    template,
  });

  for (const file of files) {
    const absolutePath = path.join(targetDir, file.path);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    if (typeof file.contents === "string") {
      await writeFile(absolutePath, file.contents, "utf8");
    } else {
      await writeFile(absolutePath, file.contents);
    }
  }

  return {
    targetDir,
    packageName,
    template,
    files: files.map((file) => file.path),
  };
}

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

function resolveIo(options: RunApertureCliOptions): ApertureCliIo {
  return {
    stdout: options.stdout ?? (() => undefined),
    stderr: options.stderr ?? (() => undefined),
  };
}

function parseCreateCommand(argv: readonly string[]): ParsedCreateCommand {
  let name: string | null = null;
  let force = false;
  let template: ApertureCreateTemplate = "minimal";

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === undefined) {
      continue;
    }

    if (arg === "--force") {
      force = true;
      continue;
    }

    if (arg === "--template") {
      index += 1;
      template = parseCreateTemplate(readOptionValue(argv, index, arg));
      continue;
    }

    if (arg.startsWith("-")) {
      throw new ApertureCliError(
        "aperture.create.unknownOption",
        `Unknown create option '${arg}'. Run 'aperture create --help' for supported options.`,
      );
    }

    if (name !== null) {
      throw new ApertureCliError(
        "aperture.create.tooManyArguments",
        "The create command accepts one project path.",
      );
    }

    name = arg;
  }

  if (name === null || name.trim().length === 0) {
    throw new ApertureCliError(
      "aperture.create.missingName",
      "The create command requires a project path, for example 'aperture create my-app'.",
    );
  }

  return { name, force, template };
}

function parseCreateTemplate(value: string): ApertureCreateTemplate {
  if (value === "minimal" || value === "glb-viewer" || value === "game") {
    return value;
  }

  throw new ApertureCliError(
    "aperture.create.invalidTemplate",
    `Unknown create template '${value}'. Use minimal, glb-viewer, or game.`,
  );
}

function parseAdapterSyncCommand(
  argv: readonly string[],
): ParsedAdapterSyncCommand {
  let force = false;

  for (const arg of argv) {
    if (arg === "--force") {
      force = true;
      continue;
    }

    throw new ApertureCliError(
      "aperture.adapter.unknownOption",
      `Unknown adapter sync option '${arg}'. Run 'aperture adapter --help' for supported options.`,
    );
  }

  return { force };
}

function parseDevUpCommand(argv: readonly string[]): ParsedDevUpCommand {
  let host: string | undefined;
  let port: number | undefined;
  let open = false;
  let headless: boolean | undefined;
  let strictPort: boolean | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--open") {
      open = true;
      headless = false;
      continue;
    }

    if (arg === "--headless") {
      headless = true;
      continue;
    }

    if (arg === "--headed") {
      headless = false;
      continue;
    }

    if (arg === "--strict-port") {
      strictPort = true;
      continue;
    }

    if (arg === "--no-strict-port") {
      strictPort = false;
      continue;
    }

    if (arg === "--host") {
      index += 1;
      host = readOptionValue(argv, index, arg);
      continue;
    }

    if (arg === "--port") {
      index += 1;
      port = parsePort(readOptionValue(argv, index, arg), arg);
      continue;
    }

    throw new ApertureCliError(
      "aperture.dev.unknownOption",
      `Unknown dev option '${arg ?? ""}'. Run 'aperture dev --help' for supported options.`,
    );
  }

  return {
    ...(host === undefined ? {} : { host }),
    ...(port === undefined ? {} : { port }),
    open,
    ...(headless === undefined ? {} : { headless }),
    ...(strictPort === undefined ? {} : { strictPort }),
  };
}

function parseDevLogsCommand(argv: readonly string[]): ParsedDevLogsCommand {
  let lines: number | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--lines") {
      index += 1;
      lines = parsePositiveInteger(readOptionValue(argv, index, arg), arg);
      continue;
    }

    throw new ApertureCliError(
      "aperture.dev.unknownOption",
      `Unknown dev logs option '${arg ?? ""}'. Run 'aperture dev --help' for supported options.`,
    );
  }

  return lines === undefined ? {} : { lines };
}

function parseToolCommand(argv: readonly string[]): ParsedToolCommand {
  let name: string | undefined;
  let args: Record<string, unknown> | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--json" || arg === "--args") {
      index += 1;
      args = parseToolJsonArgs(readOptionValue(argv, index, arg));
      continue;
    }

    if (arg?.startsWith("-") === true) {
      throw new ApertureCliError(
        "aperture.tool.unknownOption",
        `Unknown tool option '${arg}'. Run 'aperture tool --help' for supported options.`,
      );
    }

    if (name !== undefined) {
      throw new ApertureCliError(
        "aperture.tool.tooManyArguments",
        "The tool command accepts one tool name.",
      );
    }

    name = arg;
  }

  if (name === undefined || name.length === 0) {
    throw new ApertureCliError(
      "aperture.tool.missingName",
      "The tool command requires a tool name, for example 'aperture tool browser_status'.",
    );
  }

  return {
    name,
    ...(args === undefined ? {} : { arguments: args }),
  };
}

function parseToolJsonArgs(value: string): Record<string, unknown> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value) as unknown;
  } catch (error: unknown) {
    throw new ApertureCliError(
      "aperture.tool.invalidJson",
      `Tool arguments must be valid JSON. ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new ApertureCliError(
      "aperture.tool.invalidJson",
      "Tool arguments JSON must be an object.",
    );
  }

  return parsed as Record<string, unknown>;
}

function parseReferenceSearchCommand(
  argv: readonly string[],
): ParsedReferenceSearchCommand {
  let limit: number | undefined;
  const queryParts: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--limit") {
      index += 1;
      limit = parsePositiveInteger(readOptionValue(argv, index, arg), arg);
      continue;
    }

    if (arg?.startsWith("-") === true) {
      throw new ApertureCliError(
        "aperture.reference.unknownOption",
        `Unknown reference search option '${arg}'. Run 'aperture reference --help' for supported options.`,
      );
    }

    if (arg !== undefined) {
      queryParts.push(arg);
    }
  }

  const query = queryParts.join(" ").trim();
  if (query.length === 0) {
    throw new ApertureCliError(
      "aperture.reference.missingQuery",
      "The reference search command requires a query.",
    );
  }

  return {
    query,
    ...(limit === undefined ? {} : { limit }),
  };
}

function parseReferenceWarmupCommand(argv: readonly string[]): {
  readonly from?: string;
} {
  let from: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--from") {
      index += 1;
      from = readOptionValue(argv, index, arg);
      continue;
    }

    throw new ApertureCliError(
      "aperture.reference.unknownOption",
      `Unknown reference warmup option '${arg ?? ""}'. Run 'aperture reference --help' for supported options.`,
    );
  }

  return from === undefined ? {} : { from };
}

function readOptionValue(
  argv: readonly string[],
  index: number,
  option: string,
): string {
  const value = argv[index];

  if (value === undefined || value.startsWith("-")) {
    throw new ApertureCliError(
      "aperture.cli.missingOptionValue",
      `Option '${option}' requires a value.`,
    );
  }

  return value;
}

function parsePort(value: string, option: string): number {
  const port = parsePositiveInteger(value, option);

  if (port > 65_535) {
    throw new ApertureCliError(
      "aperture.cli.invalidPort",
      `Option '${option}' requires a TCP port between 1 and 65535.`,
    );
  }

  return port;
}

function parsePositiveInteger(value: string, option: string): number {
  const number = Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    throw new ApertureCliError(
      "aperture.cli.invalidNumber",
      `Option '${option}' requires a positive integer value.`,
    );
  }

  return number;
}

async function assertWritableTarget(
  targetDir: string,
  force: boolean,
): Promise<void> {
  try {
    const targetStat = await stat(targetDir);

    if (!targetStat.isDirectory()) {
      throw new ApertureCliError(
        "aperture.create.targetNotDirectory",
        `Create target '${targetDir}' exists and is not a directory.`,
      );
    }

    const entries = await readdir(targetDir);
    if (!force && entries.length > 0) {
      throw new ApertureCliError(
        "aperture.create.targetNotEmpty",
        `Create target '${targetDir}' is not empty. Re-run with --force to write starter files into it.`,
      );
    }
  } catch (error: unknown) {
    if (error instanceof ApertureCliError) {
      throw error;
    }

    if (isNodeErrorCode(error, "ENOENT")) {
      await mkdir(targetDir, { recursive: true });
      return;
    }

    throw error;
  }
}

function resolveTargetDir(cwd: string, name: string): string {
  return path.resolve(cwd, name);
}

function npmPackageNameFromPath(targetDir: string): string {
  const baseName = path.basename(targetDir).toLowerCase();
  const normalized = baseName
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (/^[a-z0-9][a-z0-9._-]*$/.test(normalized)) {
    return normalized;
  }

  return `aperture-${normalized || "app"}`;
}

function defaultApertureDependencySpec(): string {
  return CLI_VERSION === "0.0.0" ? "workspace:*" : `^${CLI_VERSION}`;
}

function createTemplateFiles(input: {
  readonly packageName: string;
  readonly dependencySpec: string;
  readonly template: ApertureCreateTemplate;
}): readonly TemplateFile[] {
  const packageJson = {
    name: input.packageName,
    version: "0.0.0",
    private: true,
    type: "module",
    scripts: {
      dev: "vite --host 127.0.0.1",
      build: "vite build",
      preview: "vite preview",
      typecheck: "tsc --noEmit",
      aperture: "aperture",
    },
    dependencies: {
      "@aperture-engine/app": input.dependencySpec,
      "@aperture-engine/vite-plugin": input.dependencySpec,
    },
    devDependencies: {
      "@aperture-engine/cli": input.dependencySpec,
      typescript: "^6.0.3",
      vite: "^8.0.13",
    },
  };

  const templateFiles = createAppTemplateFiles(input.template);

  return [
    {
      path: "package.json",
      contents: `${JSON.stringify(packageJson, null, 2)}\n`,
    },
    {
      path: "index.html",
      contents: indexHtml(),
    },
    {
      path: "tsconfig.json",
      contents: tsconfigJson(),
    },
    {
      path: "vite.config.ts",
      contents: viteConfigTs(),
    },
    ...templateFiles,
    ...adapterTemplateFiles(),
  ];
}

function createAppTemplateFiles(
  template: ApertureCreateTemplate,
): readonly TemplateFile[] {
  if (template === "glb-viewer") {
    return [
      { path: "aperture.config.ts", contents: glbViewerConfigTs() },
      binaryTemplateFile(
        "public/assets/sample-cube.glb",
        SAMPLE_CUBE_GLB_BASE64,
      ),
      {
        path: "src/systems/setup.system.ts",
        contents: glbViewerSetupSystemTs(),
      },
      {
        path: "src/systems/orbit.system.ts",
        contents: glbViewerOrbitSystemTs(),
      },
    ];
  }

  if (template === "game") {
    return [
      { path: "aperture.config.ts", contents: gameConfigTs() },
      binaryTemplateFile("public/assets/goal-cube.glb", SAMPLE_CUBE_GLB_BASE64),
      {
        path: "src/systems/setup.system.ts",
        contents: gameSetupSystemTs(),
      },
      {
        path: "src/systems/player.system.ts",
        contents: gamePlayerSystemTs(),
      },
      {
        path: "src/systems/camera-follow.system.ts",
        contents: gameCameraFollowSystemTs(),
      },
    ];
  }

  return [
    {
      path: "aperture.config.ts",
      contents: apertureConfigTs(),
    },
    {
      path: "src/systems/setup.system.ts",
      contents: setupSystemTs(),
    },
    {
      path: "src/systems/spin.system.ts",
      contents: spinSystemTs(),
    },
  ];
}

function binaryTemplateFile(path: string, base64: string): TemplateFile {
  return {
    path,
    contents: Buffer.from(base64, "base64"),
  };
}

function adapterTemplateFiles(): readonly AdapterTemplateFile[] {
  return [
    {
      path: "AGENTS.md",
      contents: agentsMd(),
      sync: { kind: "managedBlock", style: "html" },
    },
    {
      path: "CLAUDE.md",
      contents: claudeMd(),
      sync: { kind: "managedBlock", style: "html" },
    },
    {
      path: ".claude/settings.json",
      contents: claudeSettingsJson(),
      sync: { kind: "jsonMcpServer" },
    },
    {
      path: ".cursor/rules/aperture.mdc",
      contents: cursorRule(),
      sync: { kind: "managedBlock", style: "html" },
    },
    {
      path: ".github/copilot-instructions.md",
      contents: copilotInstructions(),
      sync: { kind: "managedBlock", style: "html" },
    },
    {
      path: ".codex/config.toml",
      contents: codexConfigToml(),
      sync: { kind: "managedBlock", style: "hash" },
    },
    {
      path: ".mcp.json",
      contents: mcpJson(),
      sync: { kind: "jsonMcpServer" },
    },
  ];
}

function indexHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Aperture App</title>
    <style>
      html,
      body {
        margin: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: #0c0f14;
      }

      #aperture {
        display: block;
        width: 100vw;
        height: 100vh;
      }
    </style>
  </head>
  <body>
    <canvas id="aperture"></canvas>
  </body>
</html>
`;
}

function tsconfigJson(): string {
  return `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "types": ["vite/client"]
  },
  "include": ["aperture.config.ts", "vite.config.ts", "src/**/*.ts"]
}
`;
}

function viteConfigTs(): string {
  return `import { defineConfig } from "vite";
import { aperture } from "@aperture-engine/vite-plugin";

export default defineConfig({
  plugins: [
    aperture({
      ai: {
        mode: "agent",
      },
    }),
  ],
});
`;
}

function apertureConfigTs(): string {
  return `import { defineApertureConfig, signal } from "@aperture-engine/app/config";

export default defineApertureConfig({
  mode: "browser",
  canvas: "#aperture",
  systems: ["src/systems/**/*.system.ts"],
  signals: {
    selectedEntity: signal.ref(null),
  },
  input: {
    actions: {
      select: [{ pointer: "primary" }, { keyboard: "Enter" }],
    },
  },
  render: {
    clearColor: [0.03, 0.035, 0.04, 1],
    defaultCamera: false,
    defaultLight: false,
    sampleCount: 4,
    maxPixelRatio: 2,
  },
  diagnostics: {
    level: "info",
  },
});
`;
}

const SAMPLE_CUBE_GLB_BASE64 =
  "Z2xURgIAAADsAwAAKAMAAEpTT057ImFzc2V0Ijp7InZlcnNpb24iOiIyLjAiLCJnZW5lcmF0b3IiOiJBcGVydHVyZSB0YXNrLTIwMDcgZml4dHVyZSJ9LCJzY2VuZSI6MCwic2NlbmVzIjpbeyJub2RlcyI6WzBdfV0sIm5vZGVzIjpbeyJuYW1lIjoiU2FtcGxlQ3ViZSIsIm1lc2giOjAsInJvdGF0aW9uIjpbMCwwLjI1ODgxOSwwLDAuOTY1OTI2XX1dLCJtZXNoZXMiOlt7Im5hbWUiOiJTYW1wbGVDdWJlTWVzaCIsInByaW1pdGl2ZXMiOlt7ImF0dHJpYnV0ZXMiOnsiUE9TSVRJT04iOjB9LCJpbmRpY2VzIjoxLCJtYXRlcmlhbCI6MH1dfV0sIm1hdGVyaWFscyI6W3sibmFtZSI6IlNhbXBsZUN1YmVNaW50IiwicGJyTWV0YWxsaWNSb3VnaG5lc3MiOnsiYmFzZUNvbG9yRmFjdG9yIjpbMC4xNiwwLjc4LDAuNTYsMV19LCJleHRlbnNpb25zIjp7IktIUl9tYXRlcmlhbHNfdW5saXQiOnt9fX1dLCJidWZmZXJzIjpbeyJieXRlTGVuZ3RoIjoxNjh9XSwiYnVmZmVyVmlld3MiOlt7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6MCwiYnl0ZUxlbmd0aCI6OTYsInRhcmdldCI6MzQ5NjJ9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0Ijo5NiwiYnl0ZUxlbmd0aCI6NzIsInRhcmdldCI6MzQ5NjN9XSwiYWNjZXNzb3JzIjpbeyJidWZmZXJWaWV3IjowLCJieXRlT2Zmc2V0IjowLCJjb21wb25lbnRUeXBlIjo1MTI2LCJjb3VudCI6OCwidHlwZSI6IlZFQzMiLCJtaW4iOlstMC43LC0wLjcsLTAuN10sIm1heCI6WzAuNywwLjcsMC43XX0seyJidWZmZXJWaWV3IjoxLCJieXRlT2Zmc2V0IjowLCJjb21wb25lbnRUeXBlIjo1MTIzLCJjb3VudCI6MzYsInR5cGUiOiJTQ0FMQVIifV19qAAAAEJJTgAzMzO/MzMzvzMzM78zMzM/MzMzvzMzM78zMzM/MzMzPzMzM78zMzO/MzMzPzMzM78zMzO/MzMzvzMzMz8zMzM/MzMzvzMzMz8zMzM/MzMzPzMzMz8zMzO/MzMzPzMzMz8AAAEAAgAAAAIAAwAEAAYABQAEAAcABgAAAAQABQAAAAUAAQABAAUABgABAAYAAgACAAYABwACAAcAAwADAAcABAADAAQAAAA=";

function glbViewerConfigTs(): string {
  return `import { asset, defineApertureConfig } from "@aperture-engine/app/config";

export default defineApertureConfig({
  mode: "browser",
  canvas: "#aperture",
  systems: ["src/systems/**/*.system.ts"],
  assets: {
    sampleCube: asset.gltf("/assets/sample-cube.glb", {
      preload: "blocking",
      label: "Sample Cube",
    }),
  },
  input: {
    actions: {
      resetView: [{ keyboard: "KeyR" }],
    },
  },
  render: {
    clearColor: [0.03, 0.035, 0.04, 1],
    defaultCamera: false,
    defaultLight: false,
    sampleCount: 4,
    maxPixelRatio: 2,
  },
  diagnostics: {
    level: "info",
  },
});
`;
}

function glbViewerSetupSystemTs(): string {
  return `import { createSystem } from "@aperture-engine/app/systems";

export default class SetupSystem extends createSystem({ priority: 0 }) {
  override init(): void {
    this.spawn.camera({
      key: "camera.main",
      name: "Main Camera",
      transform: {
        translation: [0, 1.4, 4],
        lookAt: [0, 0.4, 0],
      },
      fovYDegrees: 50,
    });

    this.spawn.light({
      key: "light.key",
      name: "Key Light",
      kind: "directional",
      illuminance: 4,
      transform: {
        rotationEulerDegrees: [-40, 35, 0],
      },
    });

    this.spawn.light({
      key: "light.fill",
      name: "Fill Light",
      kind: "ambient",
      intensity: 0.4,
    });

    this.spawn.gltf(this.assets.gltf("sampleCube"), {
      key: "viewer.sampleCube",
      name: "Sample Cube",
      tags: ["asset", "gltf", "inspectable"],
    });
  }
}
`;
}

function glbViewerOrbitSystemTs(): string {
  return `import {
  AppEntityKey,
  LocalTransform,
  createSystem,
  quatFromAxisAngle,
} from "@aperture-engine/app/systems";

export default class OrbitSystem extends createSystem({
  priority: 20,
  queries: {
    objects: { required: [AppEntityKey, LocalTransform] },
  },
}) {
  override update(_delta: number, time: number): void {
    for (const entity of this.queries.objects.entities) {
      if (entity.getValue(AppEntityKey, "value") !== "viewer.sampleCube") {
        continue;
      }

      entity
        .getVectorView(LocalTransform, "rotation")
        .set(quatFromAxisAngle([0, 1, 0], time * 0.6));
    }
  }
}
`;
}

function gameConfigTs(): string {
  return `import { asset, defineApertureConfig, signal } from "@aperture-engine/app/config";

export default defineApertureConfig({
  mode: "browser",
  canvas: "#aperture",
  systems: ["src/systems/**/*.system.ts"],
  assets: {
    goal: asset.gltf("/assets/goal-cube.glb", {
      preload: "blocking",
      label: "Goal Cube",
    }),
  },
  signals: {
    score: signal.number(0),
    playerX: signal.number(0),
    goalReached: signal.boolean(false),
  },
  input: {
    actions: {
      left: [{ keyboard: "ArrowLeft" }, { keyboard: "KeyA" }],
      right: [{ keyboard: "ArrowRight" }, { keyboard: "KeyD" }],
      jump: [{ keyboard: "Space" }, { keyboard: "KeyW" }],
      reset: [{ keyboard: "KeyR" }],
    },
  },
  render: {
    clearColor: [0.08, 0.12, 0.16, 1],
    defaultCamera: false,
    defaultLight: false,
    sampleCount: 4,
    maxPixelRatio: 2,
  },
  diagnostics: {
    level: "info",
  },
});
`;
}

function gameSetupSystemTs(): string {
  return `import { createSystem, material, mesh } from "@aperture-engine/app/systems";

export default class SetupSystem extends createSystem({ priority: 0 }) {
  override init(): void {
    this.spawn.camera({
      key: "camera.main",
      name: "Main Camera",
      transform: {
        translation: [0, 3, 7],
        lookAt: [0, 0.6, 0],
      },
      fovYDegrees: 50,
    });

    this.spawn.light({
      key: "light.key",
      name: "Key Light",
      kind: "directional",
      illuminance: 4,
      transform: {
        rotationEulerDegrees: [-45, 25, 0],
      },
    });

    this.spawn.light({
      key: "light.fill",
      name: "Fill Light",
      kind: "ambient",
      intensity: 0.45,
    });

    this.spawn.mesh({
      key: "level.ground",
      name: "Ground",
      tags: ["level", "ground"],
      mesh: mesh.box({ size: [9, 0.3, 1.5] }),
      material: material.standard({
        baseColor: [0.18, 0.44, 0.32, 1],
        roughness: 0.65,
      }),
      transform: { translation: [0, -0.15, 0] },
    });

    this.spawn.mesh({
      key: "player",
      name: "Player",
      tags: ["player", "controllable"],
      mesh: mesh.box({ size: [0.5, 0.8, 0.5] }),
      material: material.standard({
        baseColor: [0.18, 0.58, 1, 1],
        roughness: 0.45,
      }),
      transform: { translation: [-3.5, 0.55, 0] },
    });

    this.spawn.gltf(this.assets.gltf("goal"), {
      key: "collectible.goal",
      name: "Goal Gem",
      tags: ["collectible", "goal"],
      transform: { translation: [1.8, 0.65, 0], scale: [0.35, 0.35, 0.35] },
    });

    this.spawn.mesh({
      key: "finish.flag",
      name: "Finish",
      tags: ["finish"],
      mesh: mesh.box({ size: [0.25, 1.2, 0.25] }),
      material: material.standard({
        baseColor: [1, 0.25, 0.3, 1],
        roughness: 0.5,
      }),
      transform: { translation: [3.8, 0.6, 0] },
    });
  }
}
`;
}

function gamePlayerSystemTs(): string {
  return `import {
  AppEntityKey,
  LocalTransform,
  createSystem,
} from "@aperture-engine/app/systems";

export default class PlayerSystem extends createSystem({
  priority: 20,
  queries: {
    actors: { required: [AppEntityKey, LocalTransform] },
  },
}) {
  override update(delta: number): void {
    const player = this.findByKey("player");
    const gem = this.findByKey("collectible.goal");
    const score = this.signals.score;
    const playerX = this.signals.playerX;
    const goalReached = this.signals.goalReached;

    if (
      player === null ||
      score === undefined ||
      playerX === undefined ||
      goalReached === undefined
    ) {
      return;
    }

    const playerTranslation = player.getVectorView(LocalTransform, "translation");

    if (this.input.actions.reset?.pressed.value === true) {
      playerTranslation[0] = -3.5;
      score.value = 0;
      goalReached.value = false;
      if (gem !== null) {
        gem.getVectorView(LocalTransform, "translation")[1] = 0.65;
      }
    }

    const direction =
      (this.input.actions.right?.pressed.value === true ? 1 : 0) -
      (this.input.actions.left?.pressed.value === true ? 1 : 0);
    const playerCurrentX = playerTranslation[0] ?? -3.5;
    const playerNextX = Math.max(
      -4,
      Math.min(4.2, playerCurrentX + direction * delta * 3),
    );
    playerTranslation[0] = playerNextX;
    playerX.value = playerNextX;

    if (
      gem !== null &&
      Number(score.value) === 0 &&
      Math.abs(playerNextX - 1.8) < 0.45
    ) {
      score.value = 1;
      gem.getVectorView(LocalTransform, "translation")[1] = -10;
      this.diagnostics.info("game.collectible.collected", {
        score: score.value,
      });
    }

    if (Number(score.value) > 0 && playerNextX > 3.5) {
      goalReached.value = true;
    }
  }

  private findByKey(key: string) {
    for (const entity of this.queries.actors.entities) {
      if (entity.getValue(AppEntityKey, "value") === key) {
        return entity;
      }
    }

    return null;
  }
}
`;
}

function gameCameraFollowSystemTs(): string {
  return `import {
  AppEntityKey,
  LocalTransform,
  createSystem,
} from "@aperture-engine/app/systems";

export default class CameraFollowSystem extends createSystem({
  priority: 80,
  queries: {
    actors: { required: [AppEntityKey, LocalTransform] },
  },
}) {
  override update(): void {
    const player = this.findByKey("player");
    const camera = this.findByKey("camera.main");

    if (player === null || camera === null) {
      return;
    }

    const playerTranslation = player.getVectorView(LocalTransform, "translation");
    const cameraTranslation = camera.getVectorView(LocalTransform, "translation");
    cameraTranslation[0] = playerTranslation[0] ?? 0;
  }

  private findByKey(key: string) {
    for (const entity of this.queries.actors.entities) {
      if (entity.getValue(AppEntityKey, "value") === key) {
        return entity;
      }
    }

    return null;
  }
}
`;
}

function setupSystemTs(): string {
  return `import { createSystem, material, mesh } from "@aperture-engine/app/systems";

export default class SetupSystem extends createSystem({ priority: 0 }) {
  override init(): void {
    this.spawn.camera({
      key: "camera.main",
      name: "Main Camera",
      transform: {
        translation: [0, 1.4, 5],
        lookAt: [0, 0.6, 0],
      },
      fovYDegrees: 55,
      camera: {
        clearColor: [0.03, 0.035, 0.04, 1],
      },
    });

    this.spawn.light({
      key: "light.key",
      name: "Key Light",
      kind: "directional",
      illuminance: 4,
      transform: {
        rotationEulerDegrees: [-45, 35, 0],
      },
    });

    this.spawn.light({
      key: "light.fill",
      name: "Fill Light",
      kind: "ambient",
      intensity: 0.35,
    });

    this.spawn.mesh({
      key: "starter.cube",
      name: "Starter Cube",
      tags: ["starter", "inspectable"],
      mesh: mesh.box({ size: [1, 1, 1] }),
      material: material.standard({
        baseColor: [0.18, 0.58, 1, 1],
        roughness: 0.45,
        metallic: 0.05,
      }),
      transform: {
        translation: [0, 0.5, 0],
      },
    });
  }
}
`;
}

function spinSystemTs(): string {
  return `import {
  AppEntityKey,
  EcsType,
  LocalTransform,
  createSystem,
  quatFromAxisAngle,
} from "@aperture-engine/app/systems";

export default class SpinSystem extends createSystem({
  priority: 10,
  queries: {
    cubes: { required: [AppEntityKey, LocalTransform] },
  },
  config: {
    speed: { type: EcsType.Float32, default: 0.8 },
  },
}) {
  override update(_delta: number, time: number): void {
    for (const entity of this.queries.cubes.entities) {
      if (entity.getValue(AppEntityKey, "value") !== "starter.cube") {
        continue;
      }

      entity
        .getVectorView(LocalTransform, "rotation")
        .set(quatFromAxisAngle([0, 1, 0], time * this.config.speed.value));
    }
  }
}
`;
}

function agentsMd(): string {
  return `# AGENTS.md

${managedBlock(
  "html",
  `You are working on an Aperture app.

## Runtime Model

- ECS is the source of truth.
- Systems live in \`src/systems/**/*.system.ts\` and run in the generated simulation worker.
- Rendering is derived from ECS state through Aperture render extraction.
- Do not introduce a mutable scene graph as app state.

## Useful Commands

- \`pnpm run dev\`: start the Vite app.
- \`pnpm run typecheck\`: type-check the app.
- \`pnpm run build\`: build the app.
- \`pnpm exec aperture dev up --open\`: start the managed Aperture browser once AI tooling is available.
- \`pnpm exec aperture mcp stdio\`: expose Aperture tools over MCP once AI tooling is available.
`,
)}`;
}

function claudeMd(): string {
  return `# Claude Instructions

${managedBlock(
  "html",
  `This is an Aperture app. Prefer ECS systems, components, typed assets, and
structured diagnostics. Keep browser/WebGPU-specific logic out of simulation
systems unless an Aperture API explicitly provides it.
`,
)}`;
}

function claudeSettingsJson(): string {
  return `{
  "mcpServers": {
    "aperture": {
      "command": "pnpm",
      "args": ["exec", "aperture", "mcp", "stdio"]
    }
  }
}
`;
}

function cursorRule(): string {
  return `---
description: Aperture app architecture
alwaysApply: true
---

${managedBlock(
  "html",
  `Use Aperture's ECS-first API. Author runtime behavior as systems under
\`src/systems/**/*.system.ts\`. Rendering is derived from ECS components and
assets; do not add a renderer-owned scene graph.
`,
)}`;
}

function copilotInstructions(): string {
  return `# Copilot Instructions

${managedBlock(
  "html",
  `This project is an Aperture app. Keep changes ECS-first:

- Add behavior in \`*.system.ts\` files.
- Use \`@aperture-engine/app/config\` for app config.
- Use \`@aperture-engine/app/systems\` for system authoring.
- Preserve the worker-friendly ECS/render boundary.
`,
)}`;
}

function codexConfigToml(): string {
  return managedBlock(
    "hash",
    `[mcp_servers.aperture]
command = "pnpm"
args = ["exec", "aperture", "mcp", "stdio"]
`,
  );
}

function mcpJson(): string {
  return `{
  "mcpServers": {
    "aperture": {
      "command": "pnpm",
      "args": ["exec", "aperture", "mcp", "stdio"]
    }
  }
}
`;
}

function mainHelp(): string {
  return `Aperture CLI ${CLI_VERSION}

Usage:
  aperture <command> [options]

Commands:
  aperture create <path>        Scaffold an Aperture app with AI tooling files.
  aperture dev <subcommand>     Manage an AI-enabled dev browser session.
  aperture tool <name>          Call one Aperture browser/ECS/render tool.
  aperture mcp stdio            Expose Aperture tools over MCP stdio.
  aperture adapter sync         Sync AI coding-tool adapter files.
  aperture reference <command>  Warm and query the Aperture RAG corpus.

Options:
  -h, --help           Show help.
  -v, --version        Show the CLI version.
`;
}

function referenceHelp(): string {
  return `Usage:
  aperture reference warmup [--from <path-or-url>]
  aperture reference status
  aperture reference build
  aperture reference search <query> [--limit <count>]

Warms, validates, and searches the Aperture RAG reference corpus.
The build subcommand is a local producer alias retained for development.

Options:
  --from <path-or-url> Use a local or hosted reference asset payload.
  --limit <count>     Maximum search results. Defaults to 10.
  -h, --help          Show help.
`;
}

function devHelp(): string {
  return `Usage:
  aperture dev up [--open] [--host <host>] [--port <port>]
  aperture dev status
  aperture dev logs [--lines <count>]
  aperture dev open
  aperture dev down

Manages a Vite dev server plus a Playwright-controlled Aperture browser.

Options:
  --open              Launch the managed browser headed.
  --headless          Launch the managed browser headless.
  --headed            Launch the managed browser headed.
  --host <host>       Host for the Vite server. Defaults to 127.0.0.1.
  --port <port>       Port for the Vite server. Defaults to 5173.
  --strict-port       Fail if the requested port is unavailable. Default.
  --no-strict-port    Allow Aperture to choose the next available port.
  --lines <count>     Log lines to print for dev logs. Defaults to 80.
  -h, --help          Show help.
`;
}

function mcpHelp(): string {
  return `Usage:
  aperture mcp stdio

Exposes Aperture browser, ECS, input, render, camera, and reference tools over
MCP stdio for the active dev session.

Options:
  -h, --help          Show help.
`;
}

function toolHelp(): string {
  return `Usage:
  aperture tool <name> [--json <object>]

Calls the same Aperture browser, ECS, input, render, camera, and reference tools
that are exposed over MCP. Requires an active dev session for browser-backed
tools; reference tools can run without one.

Examples:
  aperture tool browser_status
  aperture tool render_get_diagnostics
  aperture tool input_key --json '{"key":"Enter","action":"press"}'

Options:
  --json <object>     JSON object passed as tool arguments.
  --args <object>     Alias for --json.
  -h, --help          Show help.
`;
}

function adapterHelp(): string {
  return `Usage:
  aperture adapter sync [--force]

Creates Aperture AI coding-tool adapter files in the current app.

Options:
  --force              Overwrite existing adapter files.
  -h, --help           Show help.
`;
}

function createHelp(): string {
  return `Usage:
  aperture create <path> [--force] [--template <minimal|glb-viewer|game>]

Scaffolds a Vite-based Aperture app with starter ECS systems, Aperture config,
and AI adapter files.

Options:
  --force              Write starter files into a non-empty directory.
  --template <name>    Template to scaffold. Defaults to minimal.
  -h, --help           Show help.
`;
}

function adapterSyncSuccessMessage(report: SyncApertureAdaptersReport): string {
  return `Synced Aperture adapter files in ${report.targetDir}.

Written: ${report.written.length}
Changed: ${report.changed.length}
Unchanged: ${report.unchanged.length}
Skipped: ${report.skipped.length}
Conflicted: ${report.conflicted.length}
`;
}

function devUpSuccessMessage(report: ApertureDevUpReport): string {
  const action = report.reused ? "Reusing" : "Started";

  return `${action} Aperture dev session.

URL: ${report.session.url}
Session: ${report.session.appRoot}/.aperture/runtime/session.json
Daemon PID: ${report.session.daemon.pid ?? "unknown"}
Server PID: ${report.session.server.pid ?? "unknown"}
Browser PID: ${report.session.browser.pid ?? "unknown"}
`;
}

function devStatusMessage(status: ApertureDevSessionStatus): string {
  if (status.session === null) {
    return `No Aperture dev session found.

Session: ${status.sessionFile}
`;
  }

  return `Aperture dev session

URL: ${status.session.url}
Session: ${status.sessionFile}
Daemon: ${status.session.daemon.state} (${status.daemonAlive ? "alive" : "not running"})
Server: ${status.session.server.state} (${status.serverAlive ? "alive" : "not running"})
Browser: ${status.session.browser.state} (${status.browserAlive ? "alive" : "not running"})
Bridge: ${status.session.bridge.url ?? "none"} (${status.serverAlive ? "available" : "not running"})
CDP: ${status.session.browser.cdpUrl ?? "none"}
`;
}

function devLogsMessage(report: ApertureDevLogsReport): string {
  if (report.session === null) {
    return "No Aperture dev session found.\n";
  }

  return `${report.logs
    .map(
      (log) => `== ${log.name}: ${log.file} ==
${log.text}`,
    )
    .join("\n\n")}
`;
}

function referenceBuildMessage(
  report: BuildApertureReferenceIndexReport,
): string {
  return `Built Aperture reference corpus.

Root: ${report.root}
Index: ${report.indexFile}
Manifest: ${report.manifestFile}
Archive: ${report.archiveFile}
Entries: ${report.entries}
Chunks: ${report.chunks}
Sources: ${report.sources}
`;
}

function referenceWarmupMessage(report: WarmApertureReferenceReport): string {
  return `Warmed Aperture reference corpus.

Root: ${report.root}
Source: ${report.source}
Index: ${report.indexFile}
Manifest: ${report.manifestFile}
Archive: ${report.archiveFile}
State: ${report.stateFile}
Entries: ${report.entries}
Chunks: ${report.chunks}
Sources: ${report.sources}
`;
}

function referenceStatusMessage(report: ApertureReferenceStatusReport): string {
  const diagnostics =
    report.diagnostics.length === 0
      ? "Diagnostics: none"
      : `Diagnostics:\n${report.diagnostics
          .map(
            (diagnostic) =>
              `- ${diagnostic.code}: ${diagnostic.message} Suggested fix: ${diagnostic.suggestedFix}`,
          )
          .join("\n")}`;

  return `Aperture reference corpus

Status: ${report.status}
Ready: ${report.ok ? "yes" : "no"}
Root: ${report.root}
Index: ${report.indexFile}
Manifest: ${report.manifestFile}
Archive: ${report.archiveFile}
State: ${report.stateFile}
Chunks: ${report.chunks}
Sources: ${report.sources}
Model: ${report.model.provider}/${report.model.model}@${report.model.revision}
${diagnostics}
`;
}

function referenceSearchMessage(report: ApertureReferenceSearchReport): string {
  if (report.results.length === 0) {
    return `No Aperture reference results for '${report.query}'.

Index: ${report.indexFile}
`;
  }

  return `${report.results
    .map(
      (result) => `${result.file} (${result.kind}, score ${result.score})
${result.symbol} lines ${result.startLine}-${result.endLine}
${result.snippet}`,
    )
    .join("\n\n")}
`;
}

function plannedCommandHelp(command: string): string {
  return `The '${command}' command is part of the Aperture AI tooling plan but is not implemented yet.

Run 'aperture --help' to see the current command surface.
`;
}

function createSuccessMessage(
  report: CreateApertureProjectReport,
  cwd: string,
): string {
  const relativeTarget = path.relative(cwd, report.targetDir);
  const displayTarget =
    relativeTarget.length === 0 || relativeTarget.startsWith("..")
      ? report.targetDir
      : relativeTarget;

  return `Created Aperture app '${report.packageName}' in ${displayTarget}.

Next steps:
  cd ${displayTarget}
  pnpm install
  pnpm run dev
`;
}

function isPlannedCommand(_command: string): boolean {
  return false;
}

function isHelpFlag(value: string): boolean {
  return value === "--help" || value === "-h";
}

function isNodeErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { readonly code?: unknown }).code === code
  );
}

function managedBlock(style: ManagedBlockStyle, contents: string): string {
  return `${managedBlockStart(style)}
${contents.trim()}
${managedBlockEnd(style)}
`;
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

function defaultEntryPoint(): string {
  const entryPoint = process.argv[1];

  if (entryPoint === undefined || entryPoint.length === 0) {
    throw new ApertureCliError(
      "aperture.cli.missingEntryPoint",
      "Unable to locate the Aperture CLI entry point for the dev session daemon.",
    );
  }

  return entryPoint;
}
