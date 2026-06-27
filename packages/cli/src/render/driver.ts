import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type LaunchOptions } from "playwright";
import { ApertureCliError } from "../errors.js";
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
 * Build the harness `index.html` with an import map generated from the resolved
 * engine packages. The import map must be inline in the served HTML — module
 * scripts resolve it at parse time, before any `addInitScript` can run.
 */
export function renderHarnessHtml(importMap: Readonly<Record<string, string>>): string {
  const imports = JSON.stringify({ imports: importMap }, null, 2);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Aperture Snapshot Render Harness</title>
    <script type="importmap">
${imports}
    </script>
    <script type="module" src="${HARNESS_PREFIX}render-harness.main.js"></script>
  </head>
  <body>
    <canvas id="aperture-canvas" width="960" height="640"></canvas>
  </body>
</html>
`;
}

export async function renderBundleToPng(options: {
  readonly bundle: unknown;
  readonly width: number;
  readonly height: number;
  readonly timeoutMs?: number;
}): Promise<RenderBundleResult> {
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

  const server = await startApertureStaticServer({
    mounts,
    index: renderHarnessHtml(engine.importMap),
  });
  const browser = await chromium.launch(resolveLaunchOptions());

  try {
    const page = await browser.newPage({
      viewport: { width: options.width, height: options.height },
    });

    await page.addInitScript((bundle) => {
      (globalThis as Record<string, unknown>)["__APERTURE_RENDER_BUNDLE__"] =
        bundle;
    }, options.bundle);

    await page.goto(`${server.url}/`, { waitUntil: "domcontentloaded" });

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
