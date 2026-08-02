import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type LaunchOptions } from "playwright";
import { ApertureCliError } from "../errors.js";
import { isPngBlank, readPngDimensions } from "../tools/png-readback.js";
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
const HARNESS_PREFIX = "/_harness/";
const RENDER_BUNDLE_PATH = "/_aperture/render-bundle.json";

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

export interface RenderBundleResult {
  readonly png: Buffer;
  readonly frame: number | null;
  readonly metadata: RenderBundleMetadata;
}

export interface RenderBundleMetadata {
  readonly browser: RenderBundleBrowserMetadata;
  readonly requestedDimensions: RenderBundleDimensions;
  readonly actualDimensions: RenderBundleDimensions;
  readonly bundleDigest: RenderBundleDigestMetadata | null;
  readonly webgpu: RenderBundleWebGpuMetadata | null;
  readonly lightingHealth: unknown | null;
}

export interface RenderBundleBrowserMetadata {
  readonly channel: string;
  readonly headless: boolean;
  readonly args: readonly string[];
  /**
   * Set when a blank headless render was retried in a headed window (GPU-less
   * Linux hosts where headless Chrome discards WebGPU submissions).
   */
  readonly fallbackFromHeadlessBlank?: boolean;
}

export interface RenderBundleDimensions {
  readonly width: number;
  readonly height: number;
}

export interface RenderBundleDigestMetadata {
  readonly algorithm: string;
  readonly hash: string;
  readonly byteLength: number;
}

export interface RenderBundleWebGpuMetadata {
  readonly format: string | null;
  readonly displayColorSpace: string | null;
  readonly adapterInfo: Readonly<Record<string, string | number | boolean>>;
  readonly adapterFeatures: readonly string[];
  readonly deviceFeatures: readonly string[];
}

interface HarnessStatus {
  readonly ok?: boolean;
  readonly frame?: number | null;
  readonly error?: string;
  readonly diagnostics?: readonly unknown[];
  readonly metadata?: {
    readonly webgpu?: unknown;
    readonly lightingHealth?: unknown;
  } | null;
}

interface ResolvedLaunchOptions {
  readonly launchOptions: LaunchOptions;
  readonly metadata: RenderBundleBrowserMetadata;
}

/**
 * Build the harness `index.html` with an import map generated from the resolved
 * engine packages. The import map must be inline in the served HTML — module
 * scripts resolve it at parse time, before any `addInitScript` can run.
 */
export function renderHarnessHtml(
  importMap: Readonly<Record<string, string>>,
  options: { readonly width: number; readonly height: number },
): string {
  const imports = JSON.stringify({ imports: importMap }, null, 2);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Aperture Snapshot Render Harness</title>
    <style>
      /* Pin the page to the canvas so the element screenshot never picks up
         default body margins or scrollbars (see finding F10). */
      html,
      body {
        margin: 0;
        padding: 0;
        overflow: hidden;
        background: #000;
      }
      #aperture-canvas {
        display: block;
      }
    </style>
    <script type="importmap">
${imports}
    </script>
    <script type="module" src="${HARNESS_PREFIX}render-harness.main.js"></script>
  </head>
  <body>
    <canvas id="aperture-canvas" width="${options.width}" height="${options.height}"></canvas>
  </body>
</html>
`;
}

export interface ApertureRenderSessionRenderOptions {
  readonly bundle: unknown;
  readonly width: number;
  readonly height: number;
  readonly timeoutMs?: number;
}

/**
 * A warm render slot (#61): one browser + static server + (on GPU-less Linux)
 * Xvfb display, reused across many bundles so only the first render pays the
 * multi-second boot. Each render still runs in a FRESH page — the bundle is
 * injected per navigation — so no state leaks between bundles, and renders are
 * serialized because the served harness page's canvas dimensions are session
 * state.
 */
export interface ApertureRenderSession {
  readonly browser: RenderBundleBrowserMetadata;
  render(
    options: ApertureRenderSessionRenderOptions,
  ): Promise<RenderBundleResult>;
  dispose(): Promise<void>;
}

export async function createApertureRenderSession(
  options: {
    /** Minimum virtual-display size when Xvfb is auto-provisioned. */
    readonly displayWidth?: number;
    readonly displayHeight?: number;
    /**
     * Override the headless decision (normally taken from
     * APERTURE_RENDER_HEADLESS). Used by the blank-frame fallback to retry a
     * failed headless render in a headed window.
     */
    readonly headless?: boolean;
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
  let renderBundleJson = "null";
  const server = await startApertureStaticServer({
    mounts,
    index: () => renderHarnessHtml(engine.importMap, dimensions),
    resolveVirtualFile(pathname) {
      return pathname === RENDER_BUNDLE_PATH
        ? {
            body: renderBundleJson,
            contentType: "application/json; charset=utf-8",
          }
        : null;
    },
  });

  // A headed browser on a GPU-less Linux host needs an X display. Provision an
  // Xvfb one when none exists (matching `aperture dev`), so `render` and
  // `frame_capture` do not crash with "launched a headed browser without
  // having a XServer running". macOS/Windows and Linux hosts that already have
  // DISPLAY set fall through unchanged.
  interface ProvisionedBrowser {
    readonly launch: ResolvedLaunchOptions;
    readonly virtualDisplay: Awaited<
      ReturnType<typeof startVirtualDisplay>
    > | null;
    readonly browser: Browser;
  }

  async function provisionBrowser(
    headlessOverride: boolean | undefined,
  ): Promise<ProvisionedBrowser> {
    let virtualDisplay: Awaited<ReturnType<typeof startVirtualDisplay>> | null =
      null;
    const launch = resolveLaunchOptions(headlessOverride);
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
    const launchOptions: LaunchOptions =
      virtualDisplay === null
        ? launch.launchOptions
        : {
            ...launch.launchOptions,
            env: { ...process.env, DISPLAY: virtualDisplay.display },
          };
    try {
      const browser = await chromium.launch(launchOptions);
      return { launch, virtualDisplay, browser };
    } catch (error: unknown) {
      await virtualDisplay?.close();
      throw error;
    }
  }

  let active: ProvisionedBrowser;
  try {
    active = await provisionBrowser(options.headless);
  } catch (error: unknown) {
    await server.close();
    throw error;
  }

  let fellBackFromHeadlessBlank = false;
  let disposed = false;
  let chain: Promise<unknown> = Promise.resolve();

  async function renderOnce(
    renderOptions: ApertureRenderSessionRenderOptions,
  ): Promise<RenderBundleResult> {
    dimensions = {
      width: renderOptions.width,
      height: renderOptions.height,
    };
    renderBundleJson = JSON.stringify(renderOptions.bundle);
    const page = await active.browser.newPage({ viewport: dimensions });

    try {
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

      // Some GPU-less Linux hosts silently discard every WebGPU submission in
      // headless Chrome (queue waits reject with the "external Instance"
      // OperationError, frames come back flat) while a headed window under
      // Xvfb renders the same bundle correctly — the split the WebGPU e2e
      // suite handles by always running headed. When a headless render comes
      // back blank there, swap this session's browser for a headed one and
      // retry; the swap is sticky so long-lived hosts (the MCP render slot)
      // pay the relaunch once.
      if (
        active.launch.metadata.headless &&
        process.platform === "linux" &&
        isPngBlank(png)
      ) {
        let replacement: ProvisionedBrowser | null = null;
        try {
          replacement = await provisionBrowser(false);
        } catch {
          // Headed retry is best-effort (no Xvfb binary, no display): fall
          // through and report the headless result unchanged.
        }
        if (replacement !== null) {
          const previous = active;
          active = replacement;
          fellBackFromHeadlessBlank = true;
          await previous.browser.close().catch(() => undefined);
          await previous.virtualDisplay?.close().catch(() => undefined);
          await page.close().catch(() => undefined);
          return renderOnce(renderOptions);
        }
      }

      const actualDimensions = readPngDimensions(png);

      return {
        png,
        frame: status.frame ?? null,
        metadata: {
          browser: fellBackFromHeadlessBlank
            ? { ...active.launch.metadata, fallbackFromHeadlessBlank: true }
            : active.launch.metadata,
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
    browser: active.launch.metadata,
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
      await active.browser.close();
      await server.close();
      await active.virtualDisplay?.close();
    },
  };
}

export async function renderBundleToPng(options: {
  readonly bundle: unknown;
  readonly width: number;
  readonly height: number;
  readonly timeoutMs?: number;
}): Promise<RenderBundleResult> {
  const session = await createApertureRenderSession({
    displayWidth: options.width,
    displayHeight: options.height,
  });

  try {
    return await session.render(options);
  } finally {
    await session.dispose();
  }
}

function resolveLaunchOptions(
  headlessOverride?: boolean,
): ResolvedLaunchOptions {
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
  // "1" remains accepted from the era when headless was the opt-in. Some
  // GPU-less Linux hosts break the OTHER way: headless Chrome's GPU process
  // accepts WebGPU submissions and silently discards them (every queue wait
  // rejects with "A valid external Instance reference no longer exists" and
  // frames come back flat), while a headed window under Xvfb renders
  // correctly — renderBundleToPng retries headed on that signature via
  // `headlessOverride`.
  const headless =
    headlessOverride ?? process.env["APERTURE_RENDER_HEADLESS"] !== "0";

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

export function readRenderBundleDigestMetadata(
  bundle: unknown,
): RenderBundleDigestMetadata | null {
  if (!isRecord(bundle) || !isRecord(bundle["digest"])) {
    return null;
  }

  const digest = bundle["digest"];
  const algorithm = digest["algorithm"];
  const hash = digest["hash"];
  const byteLength = digest["byteLength"];

  if (
    typeof algorithm !== "string" ||
    typeof hash !== "string" ||
    typeof byteLength !== "number" ||
    !Number.isInteger(byteLength) ||
    byteLength < 0
  ) {
    return null;
  }

  return { algorithm, hash, byteLength };
}

export function normalizeRenderBundleWebGpuMetadata(
  value: unknown,
): RenderBundleWebGpuMetadata | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    format: stringOrNull(value["format"]),
    displayColorSpace: stringOrNull(value["displayColorSpace"]),
    adapterInfo: primitiveRecord(value["adapterInfo"]),
    adapterFeatures: sortedStringArray(value["adapterFeatures"]),
    deviceFeatures: sortedStringArray(value["deviceFeatures"]),
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

function sortedStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .sort();
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function primitiveRecord(
  value: unknown,
): Readonly<Record<string, string | number | boolean>> {
  if (!isRecord(value)) {
    return {};
  }

  const output: Record<string, string | number | boolean> = {};

  for (const [key, item] of Object.entries(value)) {
    if (
      typeof item === "string" ||
      typeof item === "number" ||
      typeof item === "boolean"
    ) {
      output[key] = item;
    }
  }

  return output;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
