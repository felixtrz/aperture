import { HARNESS_PREFIX, renderHarnessHtml } from "./harness.js";
import {
  renderBundleFeedbackMetadata,
  readRenderBundleDigestMetadata,
  normalizeRenderBundleWebGpuMetadata,
} from "./metadata.js";
import type {
  RenderBundleResult,
  RenderBundleBrowserMetadata,
  HarnessStatus,
  ApertureRenderSessionRenderOptions,
  ApertureRenderSession,
} from "./types.js";
import path from "node:path";

import { fileURLToPath } from "node:url";

import { chromium, type LaunchOptions } from "playwright";

import { ApertureCliError } from "../errors.js";

import { readPngDimensions } from "../tools/png-readback.js";

import { hasDisplay, startVirtualDisplay } from "../dev/xvfb.js";

import { resolveEnginePackages } from "./resolve-engine-packages.js";

import {
  startApertureStaticServer,
  type StaticMount,
} from "./static-server.js";

// The harness assets ship next to dist/ (see package.json "files"), so this
// resolves both in the repo and from an installed package.
const HARNESS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../assets/render-harness",
);

// GPU-less software rendering (SwiftShader Vulkan) — the same path the WebGPU
// e2e suite uses. The harness runs in Chromium's NEW headless mode by
// default, which composites the WebGPU canvas into element screenshots
// correctly (verified byte-identical against a headed render of the same
// bundle; the old headless mode returned a flat white frame, which is why
// this used to require a headed window). APERTURE_RENDER_HEADLESS=0 forces a
// headed window for debugging; on a GPU-less Linux host that path
// auto-provisions an Xvfb virtual display when DISPLAY is unset, mirroring
// `aperture dev`, so the same command renders on macOS, Windows, and Linux.
const DEFAULT_BROWSER_ARGS = [
  "--enable-unsafe-webgpu",
  "--use-vulkan=swiftshader",
  "--enable-features=Vulkan",
  "--enable-unsafe-swiftshader",
];

interface ResolvedLaunchOptions {
  readonly launchOptions: LaunchOptions;
  readonly metadata: RenderBundleBrowserMetadata;
}

export async function createBrowserRenderSession(
  options: {
    /** Minimum virtual-display size when Xvfb is auto-provisioned. */
    readonly displayWidth?: number;
    readonly displayHeight?: number;
  } = {},
): Promise<ApertureRenderSession> {
  const engine = resolveEnginePackages();

  if (Object.keys(engine.importMap).length === 0) {
    throw new ApertureCliError(
      "aperture.render.engineNotResolved",
      "Could not resolve the Aperture engine packages to render with. Ensure @aperture-engine/app and its dependencies are installed alongside the CLI.",
    );
  }

  const mounts: StaticMount[] = [
    ...engine.mounts.map((mount) => ({ prefix: mount.prefix, dir: mount.dir })),
    { prefix: HARNESS_PREFIX, dir: HARNESS_DIR },
  ];

  // The canvas size is baked into the served index.html, so the index is a
  // per-request getter reading the CURRENT render's dimensions.
  let dimensions = { width: 960, height: 640 };
  const server = await startApertureStaticServer({
    mounts,
    index: () => renderHarnessHtml(engine.importMap, dimensions),
  });

  // A headed browser on a GPU-less Linux host needs an X display. Provision an
  // Xvfb one when none exists (matching `aperture dev`), so `render` and
  // `frame_capture` do not crash with "launched a headed browser without
  // having a XServer running". macOS/Windows and Linux hosts that already have
  // DISPLAY set fall through unchanged.
  let virtualDisplay: Awaited<ReturnType<typeof startVirtualDisplay>> | null =
    null;
  const launch = resolveLaunchOptions();
  try {
    if (
      !launch.launchOptions.headless &&
      process.platform === "linux" &&
      !hasDisplay(process.env)
    ) {
      // Size the virtual screen to comfortably hold the render window; floor at
      // the dev display default so large canvases still fit.
      virtualDisplay = await startVirtualDisplay({
        width: Math.max(options.displayWidth ?? 0, 1280),
        height: Math.max(options.displayHeight ?? 0, 800),
      });
    }
  } catch (error: unknown) {
    await server.close();
    throw error;
  }

  const launchOptions: LaunchOptions =
    virtualDisplay === null
      ? launch.launchOptions
      : {
          ...launch.launchOptions,
          env: { ...process.env, DISPLAY: virtualDisplay.display },
        };

  const browser = await chromium
    .launch(launchOptions)
    .catch(async (error: unknown) => {
      await virtualDisplay?.close();
      await server.close();
      throw error;
    });

  let disposed = false;
  let chain: Promise<unknown> = Promise.resolve();

  async function renderOnce(
    renderOptions: ApertureRenderSessionRenderOptions,
  ): Promise<RenderBundleResult> {
    dimensions = {
      width: renderOptions.width,
      height: renderOptions.height,
    };
    const page = await browser.newPage({ viewport: dimensions });

    try {
      await page.addInitScript((bundle) => {
        (globalThis as Record<string, unknown>)["__APERTURE_RENDER_BUNDLE__"] =
          bundle;
      }, renderOptions.bundle);

      await page.goto(`${server.url}/`, { waitUntil: "domcontentloaded" });

      const status = (await page
        .waitForFunction(
          () =>
            (globalThis as Record<string, unknown>)[
              "__APERTURE_RENDER_STATUS__"
            ] ?? null,
          undefined,
          { timeout: renderOptions.timeoutMs ?? 60_000 },
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
      const actualDimensions = readPngDimensions(png);

      return {
        png,
        frame: status.frame ?? null,
        metadata: {
          ...renderBundleFeedbackMetadata(status),
          backend: "browser",
          schemaVersion: 2,
          browser: launch.metadata,
          requestedDimensions: {
            width: renderOptions.width,
            height: renderOptions.height,
          },
          actualDimensions,
          bundleDigest: readRenderBundleDigestMetadata(renderOptions.bundle),
          webgpu: normalizeRenderBundleWebGpuMetadata(status.metadata?.webgpu),
          lightingHealth: status.metadata?.lightingHealth ?? null,
        },
      };
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  return {
    backend: "browser",
    browser: launch.metadata,
    render(renderOptions) {
      if (disposed) {
        return Promise.reject(
          new ApertureCliError(
            "aperture.render.sessionDisposed",
            "This render session has been disposed; create a new one.",
          ),
        );
      }
      const result = chain.then(() => renderOnce(renderOptions));
      chain = result.catch(() => undefined);
      return result;
    },
    async dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      await chain.catch(() => undefined);
      await browser.close();
      await server.close();
      await virtualDisplay?.close();
    },
  };
}

function resolveLaunchOptions(): ResolvedLaunchOptions {
  const channel = process.env["APERTURE_RENDER_CHANNEL"] ?? "chrome";
  const browserArgs = process.env["APERTURE_RENDER_BROWSER_ARGS"];
  const args =
    browserArgs === undefined
      ? [...DEFAULT_BROWSER_ARGS]
      : browserArgs.split(/\s+/u).filter((arg) => arg.length > 0);
  // Headless by default: Chromium's new headless mode composites the WebGPU
  // canvas correctly (verified byte-identical PNG output against a headed
  // render of the same bundle), so on-demand renders no longer pop a browser
  // window mid-session (agent-stumble: headed windows during verification).
  // Set APERTURE_RENDER_HEADLESS=0 to force a headed window for debugging;
  // "1" remains accepted from the era when headless was the opt-in.
  const headless = process.env["APERTURE_RENDER_HEADLESS"] !== "0";

  return {
    launchOptions: {
      channel,
      headless,
      args,
    },
    metadata: {
      channel,
      headless,
      args,
    },
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
