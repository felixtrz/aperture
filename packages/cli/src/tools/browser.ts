import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ApertureDevSession } from "../session.js";
import { isRecord } from "./args.js";
import { STATUS_GLOBAL } from "./types.js";

const MANAGED_GLOBAL = "__APERTURE_MCP_MANAGED__";

export interface BrowserConnection {
  readonly browser: {
    close(): Promise<void>;
  };
  readonly page: AperturePage;
}

export type AperturePointerButton = "left" | "middle" | "right";

export interface AperturePage {
  url(): string;
  reload(options?: {
    readonly waitUntil?: "domcontentloaded";
  }): Promise<unknown>;
  screenshot(options?: { readonly type?: "png" }): Promise<Buffer>;
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
    down(options?: { readonly button?: AperturePointerButton }): Promise<void>;
    up(options?: { readonly button?: AperturePointerButton }): Promise<void>;
    click(
      x: number,
      y: number,
      options?: { readonly button?: AperturePointerButton },
    ): Promise<void>;
  };
}

export async function connectToManagedPage(
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

export async function readGeneratedStatus(
  page: AperturePage,
): Promise<unknown> {
  return page.evaluate(
    ({ statusGlobal, managedGlobal }) => {
      const elementSummary = (element: Element | null) =>
        element === null
          ? null
          : {
              tagName: element.tagName.toLowerCase(),
              id: element.id,
            };
      const pointerLockElement = document.pointerLockElement;
      const canvas = document.querySelector("canvas");

      return {
        url: globalThis.location?.href ?? "",
        managed:
          (globalThis as unknown as Record<string, unknown>)[managedGlobal] ===
          true,
        status:
          (globalThis as unknown as Record<string, unknown>)[statusGlobal] ??
          null,
        dom: {
          pointerLock: {
            locked: pointerLockElement !== null,
            canvasLocked:
              canvas !== null && pointerLockElement !== null
                ? pointerLockElement === canvas
                : false,
            target: elementSummary(pointerLockElement),
          },
        },
      };
    },
    { statusGlobal: STATUS_GLOBAL, managedGlobal: MANAGED_GLOBAL },
  );
}

export async function waitForWebGpu(
  page: AperturePage,
  timeoutMs: number,
): Promise<unknown> {
  const deadline = Date.now() + Math.max(0, timeoutMs);
  let pageStatus = await readGeneratedStatus(page);

  for (;;) {
    const status = generatedAppStatus(pageStatus);

    if (status?.webgpuOk === true && status.status === "running") {
      return { ok: true, page: pageStatus };
    }

    if (status?.status === "webgpu-failed" || status?.webgpuOk === false) {
      return {
        ok: false,
        diagnostic: {
          code: "aperture.mcp.webgpuUnavailable",
          message:
            "The generated Aperture app reported WebGPU initialization failure.",
          suggestedFix:
            "Inspect render diagnostics and verify the managed browser exposes navigator.gpu.",
        },
        page: pageStatus,
      };
    }

    if (status?.status === "worker-error") {
      return {
        ok: false,
        diagnostic: {
          code: "aperture.mcp.workerError",
          message:
            "The generated Aperture app reported a worker error before WebGPU became ready.",
          suggestedFix:
            "Inspect render diagnostics and generated worker diagnostics before retrying.",
        },
        page: pageStatus,
      };
    }

    if (Date.now() >= deadline) {
      return {
        ok: false,
        diagnostic: {
          code: "aperture.mcp.webgpuTimeout",
          message: `Timed out waiting ${timeoutMs}ms for the generated Aperture app to report WebGPU readiness.`,
          suggestedFix:
            "Use browser_status and render_get_diagnostics to inspect startup state.",
        },
        page: pageStatus,
      };
    }

    await delay(100);
    pageStatus = await readGeneratedStatus(page);
  }
}

export async function screenshot(
  page: AperturePage,
  options: {
    readonly baseDir?: string;
    readonly path?: unknown;
    readonly outputPath?: unknown;
    readonly includeData?: unknown;
  } = {},
): Promise<unknown> {
  const bytes = await page.screenshot({ type: "png" });
  const outputPath = screenshotOutputPath(options);
  const includeData = outputPath === null || options.includeData === true;

  if (outputPath !== null) {
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, bytes);
  }

  return {
    ok: true,
    mimeType: "image/png",
    encoding: "base64",
    byteLength: bytes.byteLength,
    ...(outputPath === null ? {} : { path: outputPath }),
    ...(options.includeData === true ? { includeData: true } : {}),
    ...(includeData ? { data: bytes.toString("base64") } : {}),
  };
}

function screenshotOutputPath(options: {
  readonly baseDir?: string;
  readonly path?: unknown;
  readonly outputPath?: unknown;
}): string | null {
  const requested =
    typeof options.path === "string"
      ? options.path
      : typeof options.outputPath === "string"
        ? options.outputPath
        : null;

  if (requested === null || requested.trim().length === 0) {
    return null;
  }

  return path.isAbsolute(requested)
    ? requested
    : path.resolve(options.baseDir ?? process.cwd(), requested);
}

export async function canvasStatus(page: AperturePage): Promise<unknown> {
  const status = await page.evaluate(
    ({ statusGlobal }) => {
      const status = (globalThis as unknown as Record<string, unknown>)[
        statusGlobal
      ] as {
        readonly canvas?: unknown;
        readonly render?: unknown;
        readonly diagnostics?: {
          readonly lastFrame?: {
            readonly renderTargets?: readonly unknown[];
          };
        };
      } | null;

      return {
        canvas: status?.canvas ?? null,
        render: status?.render ?? null,
        renderTarget:
          status?.diagnostics?.lastFrame?.renderTargets?.[0] ?? null,
      };
    },
    { statusGlobal: STATUS_GLOBAL },
  );

  return { ok: true, status };
}

function generatedAppStatus(value: unknown): {
  readonly status?: string;
  readonly webgpuOk?: boolean | null;
} | null {
  if (!isRecord(value)) {
    return null;
  }

  const status = value["status"];

  if (!isRecord(status)) {
    return null;
  }

  const statusValue =
    typeof status["status"] === "string" ? status["status"] : undefined;
  const webgpuOkValue =
    typeof status["webgpuOk"] === "boolean" || status["webgpuOk"] === null
      ? status["webgpuOk"]
      : undefined;

  return {
    ...(statusValue === undefined ? {} : { status: statusValue }),
    ...(webgpuOkValue === undefined ? {} : { webgpuOk: webgpuOkValue }),
  };
}

async function delay(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}
