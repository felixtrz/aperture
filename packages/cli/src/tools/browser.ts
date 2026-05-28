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
    down(): Promise<void>;
    up(): Promise<void>;
    click(x: number, y: number): Promise<void>;
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

export async function screenshot(page: AperturePage): Promise<unknown> {
  const bytes = await page.screenshot({ type: "png" });

  return {
    ok: true,
    mimeType: "image/png",
    encoding: "base64",
    data: bytes.toString("base64"),
  };
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
