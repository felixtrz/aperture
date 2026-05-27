import { readFile } from "node:fs/promises";
import { readApertureDevSession, type ApertureDevSession } from "./session.js";
import {
  listApertureReferenceComponents,
  listApertureReferenceSystems,
  readApertureReferenceFile,
  searchApertureReferences,
} from "./reference.js";

const STATUS_GLOBAL = "__APERTURE_GENERATED_APP__";
const MANAGED_GLOBAL = "__APERTURE_MCP_MANAGED__";
const RUNTIME_GLOBAL = "__APERTURE_MCP_RUNTIME__";

export interface ApertureToolCallOptions {
  readonly cwd: string;
  readonly name: string;
  readonly arguments?: Record<string, unknown>;
}

interface BrowserConnection {
  readonly browser: {
    close(): Promise<void>;
  };
  readonly page: AperturePage;
}

interface AperturePage {
  url(): string;
  reload(options?: {
    readonly waitUntil?: "domcontentloaded";
  }): Promise<unknown>;
  screenshot(options?: { readonly type?: "png" }): Promise<Buffer>;
  waitForFunction(
    expression: string,
    arg?: unknown,
    options?: { readonly timeout?: number },
  ): Promise<unknown>;
  evaluate<R, A = unknown>(
    pageFunction: string | ((arg: A) => R | Promise<R>),
    arg?: A,
  ): Promise<R>;
  keyboard: {
    down(key: string): Promise<void>;
    up(key: string): Promise<void>;
    press(key: string): Promise<void>;
  };
  mouse: {
    move(x: number, y: number): Promise<void>;
    down(): Promise<void>;
    up(): Promise<void>;
    click(x: number, y: number): Promise<void>;
  };
}

export async function callApertureTool(
  options: ApertureToolCallOptions,
): Promise<unknown> {
  const args = options.arguments ?? {};

  if (options.name.startsWith("reference_")) {
    return callReferenceTool(options.cwd, options.name, args);
  }

  const session = await readApertureDevSession(options.cwd);

  if (session === null) {
    return {
      ok: false,
      diagnostic: {
        code: "aperture.mcp.sessionMissing",
        message:
          "No Aperture dev session exists. Run 'aperture dev up' before using browser, ECS, input, camera, or render tools.",
      },
    };
  }

  if (session.browser.cdpUrl === null) {
    return {
      ok: false,
      diagnostic: {
        code: "aperture.mcp.browserUnavailable",
        message:
          "The active Aperture dev session does not expose a browser debugging endpoint.",
      },
      session,
    };
  }

  const connection = await connectToManagedPage(session).catch(() => null);

  if (connection === null) {
    return {
      ok: false,
      diagnostic: {
        code: "aperture.mcp.browserConnectFailed",
        message:
          "The active Aperture dev session browser could not be reached over CDP.",
        suggestedFix:
          "Run 'aperture dev status', then restart the managed session with 'aperture dev down' and 'aperture dev up'.",
      },
      session: sessionSummary(session),
    };
  }

  try {
    return await callBrowserBackedTool(
      connection.page,
      session,
      options.name,
      args,
    );
  } finally {
    await connection.browser.close();
  }
}

async function callReferenceTool(
  cwd: string,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case "reference_search":
      return searchApertureReferences({
        cwd,
        query: stringArg(args, "query") ?? "",
        ...optionalNumber("limit", numberArg(args, "limit")),
        ...optionalReferenceKind(referenceKindArg(args)),
      });
    case "reference_api_lookup":
      return searchApertureReferences({
        cwd,
        query: stringArg(args, "symbol") ?? stringArg(args, "query") ?? "",
        limit: numberArg(args, "limit") ?? 5,
        kind: "source",
      });
    case "reference_file_content": {
      const file = stringArg(args, "file") ?? "";
      const entry = await readApertureReferenceFile(cwd, file);

      return entry === null
        ? {
            ok: false,
            diagnostic: {
              code: "aperture.reference.fileNotIndexed",
              file,
              message:
                "The requested file is not present in the reference index.",
            },
          }
        : { ok: true, entry };
    }
    case "reference_find_examples":
      return searchApertureReferences({
        cwd,
        query: stringArg(args, "query") ?? "",
        ...optionalNumber("limit", numberArg(args, "limit")),
        kind: "example",
      });
    case "reference_list_components":
      return {
        ok: true,
        components: await listApertureReferenceComponents(cwd),
      };
    case "reference_list_systems":
      return {
        ok: true,
        systems: await listApertureReferenceSystems(cwd),
      };
    case "reference_find_dependents":
      return searchApertureReferences({
        cwd,
        query: stringArg(args, "symbol") ?? stringArg(args, "query") ?? "",
        ...optionalNumber("limit", numberArg(args, "limit")),
      });
    case "reference_explain_diagnostic":
      return searchApertureReferences({
        cwd,
        query: stringArg(args, "code") ?? stringArg(args, "query") ?? "",
        limit: numberArg(args, "limit") ?? 5,
      });
    default:
      return unsupportedTool(name, "Unknown Aperture reference tool.");
  }
}

async function callBrowserBackedTool(
  page: AperturePage,
  session: ApertureDevSession,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case "browser_status":
      return {
        ok: true,
        session: sessionSummary(session),
        page: await readGeneratedStatus(page),
      };
    case "browser_wait_for_webgpu":
      return waitForWebGpu(page, numberArg(args, "timeoutMs") ?? 30_000);
    case "browser_screenshot":
      return screenshot(page);
    case "browser_console_logs":
      return {
        ok: true,
        logs: await tailFile(
          session.logs.browser,
          numberArg(args, "lines") ?? 80,
        ),
      };
    case "browser_reload":
      await page.reload({ waitUntil: "domcontentloaded" });
      return { ok: true, page: await readGeneratedStatus(page) };
    case "browser_pick_pixel":
      return callGeneratedRuntimeTool(page, name, args);
    case "ecs_find_entities":
    case "ecs_get_entity":
    case "ecs_snapshot":
    case "ecs_diff":
    case "ecs_set_component_field":
    case "ecs_get_hierarchy":
      return callGeneratedRuntimeTool(page, name, args);
    case "ecs_list_systems":
      return listGeneratedSystems(page);
    case "ecs_query":
    case "ecs_get_component_schema":
    case "ecs_pause":
    case "ecs_resume":
    case "ecs_step":
      return callGeneratedRuntimeTool(page, name, args);
    case "input_key":
      return inputKey(page, args);
    case "input_pointer_move":
      return inputPointerMove(page, args);
    case "input_pointer_click":
      return inputPointerClick(page, args);
    case "input_drag":
      return inputDrag(page, args);
    case "input_action_set":
      return callGeneratedRuntimeTool(page, name, args);
    case "input_reset":
      await page.mouse.up();
      return { ok: true, page: await readGeneratedStatus(page) };
    case "camera_list":
    case "camera_get":
    case "camera_save":
    case "camera_restore":
    case "camera_create_agent":
    case "camera_set_transform":
    case "camera_look_at":
    case "camera_orbit":
    case "camera_fit_entity":
    case "camera_use_agent_view":
      return callGeneratedRuntimeTool(page, name, args);
    case "render_get_frame_report":
      return renderFrameReport(page);
    case "render_get_snapshot_summary":
      return renderSnapshotSummary(page);
    case "render_get_packets":
      return renderPackets(page);
    case "render_explain_entity":
      return renderExplainEntity(page, args);
    case "render_get_diagnostics":
      return renderDiagnostics(page);
    case "render_readback_samples":
    case "render_pick_entity":
      return callGeneratedRuntimeTool(page, name, args);
    default:
      return unsupportedTool(name, "Unknown Aperture MCP tool.");
  }
}

async function connectToManagedPage(
  session: ApertureDevSession,
): Promise<BrowserConnection> {
  const { chromium } = await import("playwright");
  const browser = await chromium.connectOverCDP(session.browser.cdpUrl ?? "");
  const pages = browser.contexts().flatMap((context) => context.pages());
  const page =
    pages.find((candidate) => candidate.url().startsWith(session.url)) ??
    pages[0];

  if (page === undefined) {
    throw new Error("The managed browser has no open pages.");
  }

  return { browser, page };
}

async function readGeneratedStatus(page: AperturePage): Promise<unknown> {
  return page.evaluate(
    ({ statusGlobal, managedGlobal }) => ({
      url: globalThis.location?.href ?? "",
      managed:
        (globalThis as unknown as Record<string, unknown>)[managedGlobal] ===
        true,
      status:
        (globalThis as unknown as Record<string, unknown>)[statusGlobal] ??
        null,
    }),
    { statusGlobal: STATUS_GLOBAL, managedGlobal: MANAGED_GLOBAL },
  );
}

async function waitForWebGpu(
  page: AperturePage,
  timeoutMs: number,
): Promise<unknown> {
  await page.waitForFunction(
    `(() => {
      const status = globalThis.${STATUS_GLOBAL};
      return status?.webgpuOk === true && status?.status === "running";
    })()`,
    undefined,
    { timeout: timeoutMs },
  );

  return { ok: true, page: await readGeneratedStatus(page) };
}

async function screenshot(page: AperturePage): Promise<unknown> {
  const bytes = await page.screenshot({ type: "png" });

  return {
    ok: true,
    mimeType: "image/png",
    encoding: "base64",
    data: bytes.toString("base64"),
  };
}

async function callGeneratedRuntimeTool(
  page: AperturePage,
  tool: string,
  payload: Record<string, unknown>,
): Promise<unknown> {
  const response = await page.evaluate(
    async ({ runtimeGlobal, runtimeTool, runtimePayload }) => {
      const runtime = (globalThis as unknown as Record<string, unknown>)[
        runtimeGlobal
      ] as
        | {
            callTool(
              tool: string,
              payload?: unknown,
            ): Promise<{
              readonly ok: boolean;
              readonly result?: unknown;
              readonly diagnostics?: readonly unknown[];
            }>;
          }
        | undefined;

      if (runtime === undefined) {
        return {
          ok: false,
          diagnostics: [
            {
              code: "aperture.devtools.runtimeMissing",
              severity: "error",
              message:
                "The managed Aperture runtime bridge is not installed in this tab.",
            },
          ],
        };
      }

      return runtime.callTool(runtimeTool, runtimePayload);
    },
    {
      runtimeGlobal: RUNTIME_GLOBAL,
      runtimeTool: tool,
      runtimePayload: payload,
    },
  );

  return {
    ok: response.ok,
    result: response.result ?? null,
    diagnostics: response.diagnostics ?? [],
  };
}

async function inputKey(
  page: AperturePage,
  args: Record<string, unknown>,
): Promise<unknown> {
  const key = stringArg(args, "key") ?? "Enter";
  const action = stringArg(args, "action") ?? "press";

  if (action === "down") {
    await page.keyboard.down(key);
  } else if (action === "up") {
    await page.keyboard.up(key);
  } else {
    await page.keyboard.press(key);
  }

  return { ok: true, page: await readGeneratedStatus(page) };
}

async function inputPointerMove(
  page: AperturePage,
  args: Record<string, unknown>,
): Promise<unknown> {
  const point = await canvasPoint(page, args);

  await page.mouse.move(point.x, point.y);
  return { ok: true, point, page: await readGeneratedStatus(page) };
}

async function inputPointerClick(
  page: AperturePage,
  args: Record<string, unknown>,
): Promise<unknown> {
  const point = await canvasPoint(page, args);

  await page.mouse.click(point.x, point.y);
  return { ok: true, point, page: await readGeneratedStatus(page) };
}

async function inputDrag(
  page: AperturePage,
  args: Record<string, unknown>,
): Promise<unknown> {
  const from = await canvasPoint(page, nestedRecord(args, "from") ?? args);
  const to = await canvasPoint(page, nestedRecord(args, "to") ?? args);

  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y);
  await page.mouse.up();

  return { ok: true, from, to, page: await readGeneratedStatus(page) };
}

async function canvasPoint(
  page: AperturePage,
  args: Record<string, unknown>,
): Promise<{ readonly x: number; readonly y: number }> {
  const normalizedX = numberArg(args, "x") ?? 0.5;
  const normalizedY = numberArg(args, "y") ?? 0.5;

  return page.evaluate(
    ({ x, y }) => {
      const canvas = document.querySelector("canvas");
      const rect = canvas?.getBoundingClientRect();

      if (rect === undefined) {
        return { x: 0, y: 0 };
      }

      return {
        x: rect.left + rect.width * Math.min(1, Math.max(0, x)),
        y: rect.top + rect.height * Math.min(1, Math.max(0, y)),
      };
    },
    { x: normalizedX, y: normalizedY },
  );
}

async function renderFrameReport(page: AperturePage): Promise<unknown> {
  const report = await page.evaluate(
    ({ statusGlobal }) => {
      const status = (globalThis as unknown as Record<string, unknown>)[
        statusGlobal
      ] as {
        readonly diagnostics?: {
          readonly lastFrame?: unknown;
        };
        readonly lastWorkerSummary?: {
          readonly entities?: unknown;
        };
      } | null;

      return {
        lastFrame: status?.diagnostics?.lastFrame ?? null,
        entities: status?.lastWorkerSummary?.entities ?? null,
      };
    },
    { statusGlobal: STATUS_GLOBAL },
  );

  return { ok: true, report };
}

async function renderSnapshotSummary(page: AperturePage): Promise<unknown> {
  const summary = await page.evaluate(
    ({ statusGlobal }) => {
      const status = (globalThis as unknown as Record<string, unknown>)[
        statusGlobal
      ] as GeneratedStatusLike | null;
      const lastFrame = status?.diagnostics?.lastFrame;

      return {
        frame: status?.lastFrame ?? null,
        snapshots: status?.snapshots ?? 0,
        counts: lastFrame?.counts ?? null,
        renderChangeSet: lastFrame?.renderChangeSet ?? null,
        entities: status?.lastWorkerSummary?.entities ?? null,
        diagnostics: lastFrame?.diagnostics ?? [],
      };
    },
    { statusGlobal: STATUS_GLOBAL },
  );

  return { ok: true, summary };
}

async function renderDiagnostics(page: AperturePage): Promise<unknown> {
  const diagnostics = await page.evaluate(
    ({ statusGlobal }) => {
      const status = (globalThis as unknown as Record<string, unknown>)[
        statusGlobal
      ] as GeneratedStatusLike | null;

      return {
        app: status?.diagnostics ?? null,
        worker: status?.lastWorkerSummary?.diagnostics ?? [],
        failure: status?.lastFailure ?? null,
      };
    },
    { statusGlobal: STATUS_GLOBAL },
  );

  return { ok: true, diagnostics };
}

async function renderPackets(page: AperturePage): Promise<unknown> {
  const packets = await page.evaluate(
    ({ statusGlobal }) => {
      const status = (globalThis as unknown as Record<string, unknown>)[
        statusGlobal
      ] as GeneratedStatusLike | null;
      const lastFrame = status?.diagnostics?.lastFrame;
      const changeSet = lastFrame?.renderChangeSet;

      return {
        frame: lastFrame?.frame ?? null,
        counts: lastFrame?.counts ?? null,
        keys: changeSet?.keys ?? null,
        changes: changeSet?.total ?? null,
      };
    },
    { statusGlobal: STATUS_GLOBAL },
  );

  return { ok: true, packets };
}

async function renderExplainEntity(
  page: AperturePage,
  args: Record<string, unknown>,
): Promise<unknown> {
  const report = await page.evaluate(
    ({ statusGlobal, key, entity }) => {
      const isRecord = (value: unknown): value is Record<string, unknown> =>
        typeof value === "object" && value !== null;
      const status = (globalThis as unknown as Record<string, unknown>)[
        statusGlobal
      ] as GeneratedStatusLike | null;
      const summaries =
        status?.lastWorkerSummary?.entities?.summaries?.filter(isRecord) ?? [];
      const requested = isRecord(entity) ? entity : null;
      const summary =
        summaries.find(
          (candidate) =>
            typeof key === "string" &&
            key.length > 0 &&
            candidate["key"] === key,
        ) ??
        summaries.find((candidate) => {
          const candidateEntity = isRecord(candidate["entity"])
            ? candidate["entity"]
            : null;

          return (
            requested !== null &&
            candidateEntity?.["index"] === requested["index"] &&
            candidateEntity?.["generation"] === requested["generation"]
          );
        }) ??
        null;
      const entityRef = isRecord(summary?.["entity"])
        ? summary["entity"]
        : null;
      const entityIndex =
        typeof entityRef?.["index"] === "number" ? entityRef["index"] : null;
      const keys = status?.diagnostics?.lastFrame?.renderChangeSet?.keys;
      const meshDrawKeys = [
        ...(keys?.meshDraws?.changed ?? []),
        ...(keys?.meshDraws?.unchanged ?? []),
      ];
      const boundsKeys = [
        ...(keys?.bounds?.changed ?? []),
        ...(keys?.bounds?.unchanged ?? []),
      ];
      const renderKey =
        entityIndex === null ? null : `mesh-draw:${String(entityIndex)}`;
      const boundsKey =
        entityIndex === null ? null : `bounds:${String(entityIndex)}:0`;

      return {
        entity: summary,
        rendered: renderKey === null ? false : meshDrawKeys.includes(renderKey),
        hasBounds: boundsKey === null ? false : boundsKeys.includes(boundsKey),
        renderKey,
        boundsKey,
        frame: status?.diagnostics?.lastFrame?.frame ?? null,
        counts: status?.diagnostics?.lastFrame?.counts ?? null,
        diagnostics: status?.diagnostics?.lastFrame?.diagnostics ?? [],
      };
    },
    {
      statusGlobal: STATUS_GLOBAL,
      key: stringArg(args, "key"),
      entity: nestedRecord(args, "entity"),
    },
  );

  return { ok: true, report };
}

async function listGeneratedSystems(page: AperturePage): Promise<unknown> {
  const systems = await page.evaluate(
    ({ statusGlobal }) => {
      const status = (globalThis as unknown as Record<string, unknown>)[
        statusGlobal
      ] as {
        readonly systems?: unknown;
      } | null;

      return Array.isArray(status?.systems) ? status.systems : [];
    },
    { statusGlobal: STATUS_GLOBAL },
  );

  return { ok: true, systems };
}

interface GeneratedStatusLike {
  readonly status?: string;
  readonly snapshots?: number;
  readonly lastFrame?: number | null;
  readonly lastFailure?: unknown;
  readonly diagnostics?: {
    readonly lastFrame?: {
      readonly frame?: number;
      readonly counts?: unknown;
      readonly diagnostics?: readonly unknown[];
      readonly renderChangeSet?: {
        readonly keys?: {
          readonly meshDraws?: {
            readonly changed?: readonly string[];
            readonly unchanged?: readonly string[];
          };
          readonly bounds?: {
            readonly changed?: readonly string[];
            readonly unchanged?: readonly string[];
          };
        };
        readonly total?: unknown;
      };
    };
  };
  readonly lastWorkerSummary?: {
    readonly diagnostics?: readonly unknown[];
    readonly entities?: {
      readonly summaries?: readonly unknown[];
    };
  };
}

function sessionSummary(session: ApertureDevSession): unknown {
  return {
    protocolVersion: session.protocolVersion,
    appRoot: session.appRoot,
    url: session.url,
    server: session.server,
    browser: session.browser,
    bridge: session.bridge,
  };
}

function unsupportedTool(name: string, message: string): unknown {
  return {
    ok: false,
    diagnostic: {
      code: "aperture.mcp.toolUnsupported",
      tool: name,
      message,
    },
  };
}

async function tailFile(file: string, lines: number): Promise<string> {
  try {
    const source = await readFile(file, "utf8");
    const parts = source.split(/\r?\n/);
    if (parts.at(-1) === "") {
      parts.pop();
    }

    return parts.slice(Math.max(0, parts.length - lines)).join("\n");
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      (error as { readonly code?: unknown }).code === "ENOENT"
    ) {
      return "";
    }

    throw error;
  }
}

function stringArg(
  args: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = args[key];

  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberArg(
  args: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = args[key];

  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function nestedRecord(
  args: Record<string, unknown>,
  key: string,
): Record<string, unknown> | null {
  const value = args[key];

  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function referenceKindArg(
  args: Record<string, unknown>,
):
  | "doc"
  | "source"
  | "example"
  | "test"
  | "reference"
  | "other"
  | "any"
  | undefined {
  const value = stringArg(args, "kind");

  return value === "doc" ||
    value === "source" ||
    value === "example" ||
    value === "test" ||
    value === "reference" ||
    value === "other" ||
    value === "any"
    ? value
    : undefined;
}

function optionalNumber(
  key: "limit",
  value: number | undefined,
): { readonly limit?: number } {
  return value === undefined ? {} : { [key]: value };
}

function optionalReferenceKind(
  value:
    | "doc"
    | "source"
    | "example"
    | "test"
    | "reference"
    | "other"
    | "any"
    | undefined,
): {
  readonly kind?:
    | "doc"
    | "source"
    | "example"
    | "test"
    | "reference"
    | "other"
    | "any";
} {
  return value === undefined ? {} : { kind: value };
}
