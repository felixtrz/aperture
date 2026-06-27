import { stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type LaunchOptions } from "playwright";
import { ApertureCliError } from "../errors.js";
import { startApertureStaticServer } from "./static-server.js";

const HARNESS_ROUTE = "/examples/render-harness/index.html";

// GPU-less software rendering (SwiftShader Vulkan) under a headed Chrome — the
// same path the WebGPU e2e suite uses. Headless Chromium hides navigator.gpu,
// so the harness must run headed (under xvfb on CI/Linux).
const DEFAULT_BROWSER_ARGS = [
  "--enable-unsafe-webgpu",
  "--use-vulkan=swiftshader",
  "--enable-features=Vulkan",
  "--enable-unsafe-swiftshader",
];

export interface RenderBundleResult {
  readonly png: Buffer;
  readonly frame: number | null;
}

interface HarnessStatus {
  readonly ok?: boolean;
  readonly frame?: number | null;
  readonly error?: string;
  readonly diagnostics?: readonly unknown[];
}

/**
 * Resolve the directory that contains the render harness and engine dist. In a
 * source/built checkout this is the repo root; the harness import map paths
 * (`/packages/...`, `/node_modules/...`) are served relative to it.
 */
export async function resolveApertureWebRoot(
  startDir = path.dirname(fileURLToPath(import.meta.url)),
): Promise<string> {
  let current = startDir;

  for (;;) {
    const candidate = path.join(current, "examples/render-harness/index.html");
    const exists = await stat(candidate)
      .then((entry) => entry.isFile())
      .catch(() => false);

    if (exists) {
      return current;
    }

    const parent = path.dirname(current);

    if (parent === current) {
      throw new ApertureCliError(
        "aperture.render.harnessNotFound",
        "Could not locate the Aperture render harness (examples/render-harness/index.html). The render command currently requires the Aperture source/built layout.",
      );
    }

    current = parent;
  }
}

export async function renderBundleToPng(options: {
  readonly bundle: unknown;
  readonly width: number;
  readonly height: number;
  readonly webRoot?: string;
  readonly timeoutMs?: number;
}): Promise<RenderBundleResult> {
  const webRoot = options.webRoot ?? (await resolveApertureWebRoot());
  const server = await startApertureStaticServer(webRoot);
  const browser = await chromium.launch(resolveLaunchOptions());

  try {
    const page = await browser.newPage({
      viewport: { width: options.width, height: options.height },
    });

    await page.addInitScript((bundle) => {
      (globalThis as Record<string, unknown>)["__APERTURE_RENDER_BUNDLE__"] =
        bundle;
    }, options.bundle);

    await page.goto(`${server.url}${HARNESS_ROUTE}`, {
      waitUntil: "domcontentloaded",
    });

    const status = (await page
      .waitForFunction(
        () =>
          (globalThis as Record<string, unknown>)[
            "__APERTURE_RENDER_STATUS__"
          ] ?? null,
        undefined,
        { timeout: options.timeoutMs ?? 60_000 },
      )
      .then((handle) => handle.jsonValue())) as HarnessStatus | null;

    if (status === null || status.ok !== true) {
      throw new ApertureCliError(
        "aperture.render.renderFailed",
        `Snapshot render failed in the browser: ${describeFailure(status)}`,
      );
    }

    const png = await page.locator("#aperture-canvas").screenshot({
      type: "png",
    });

    return { png, frame: status.frame ?? null };
  } finally {
    await browser.close();
    await server.close();
  }
}

function resolveLaunchOptions(): LaunchOptions {
  const channel = process.env["APERTURE_RENDER_CHANNEL"] ?? "chrome";
  const browserArgs = process.env["APERTURE_RENDER_BROWSER_ARGS"];

  return {
    channel,
    headless: process.env["APERTURE_RENDER_HEADLESS"] === "1",
    args:
      browserArgs === undefined
        ? DEFAULT_BROWSER_ARGS
        : browserArgs.split(/\s+/u).filter((arg) => arg.length > 0),
  };
}

function describeFailure(status: HarnessStatus | null): string {
  if (status === null) {
    return "the harness never reported a status.";
  }

  if (status.error !== undefined) {
    return status.error;
  }

  if (status.diagnostics !== undefined && status.diagnostics.length > 0) {
    return JSON.stringify(status.diagnostics);
  }

  return JSON.stringify(status);
}
