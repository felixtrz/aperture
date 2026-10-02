import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  runVerifiedScene,
  validateViewport,
} from "../../scripts/verified-webgpu.mjs";
import {
  normalizeRenderBundleWebGpuMetadata,
  readRenderBundleDigestMetadata,
  renderBundleFeedbackMetadata,
  renderHarnessHtml,
  type ApertureRenderSession,
  type ApertureRenderSessionRenderOptions,
  type RenderBundleBrowserMetadata,
  type RenderBundleResult,
} from "../../packages/cli/src/render/driver.js";
import { resolveEnginePackages } from "../../packages/cli/src/render/resolve-engine-packages.js";
import { startApertureStaticServer } from "../../packages/cli/src/render/static-server.js";
import { readPngDimensions } from "../../packages/cli/src/tools/png-readback.js";

interface VerifiedRenderSessionOptions {
  readonly runtimeRoot: string;
  readonly scratchRoot: string;
  readonly outputRoot: string;
}

/** Test-only opt-in. No environment variable changes the production renderer. */
export function cloudTestRenderSessionFactory():
  | (() => Promise<ApertureRenderSession>)
  | undefined {
  const outputRoot = process.env["APERTURE_TEST_CLOUD_RENDER_OUTPUT"];
  if (outputRoot === undefined) return undefined;
  const runtimeRoot = process.env["APERTURE_WEBGPU_RUNTIME"];
  const scratchRoot = process.env["APERTURE_TMP_RUN"];
  assert.ok(runtimeRoot, "Cloud tests require APERTURE_WEBGPU_RUNTIME");
  assert.ok(scratchRoot, "Cloud tests require the cleanup lifecycle wrapper");
  return createVerifiedRenderSessionFactory({
    runtimeRoot,
    scratchRoot,
    outputRoot,
  });
}

/**
 * A serial session facade over the approved runner. Each render owns a fresh
 * browser/context/page and loopback server. Reports, input bundles and PNGs are
 * retained outside disposable scratch, including failed-run reports.
 */
export function createVerifiedRenderSessionFactory(
  options: VerifiedRenderSessionOptions,
): () => Promise<ApertureRenderSession> {
  for (const value of Object.values(options)) {
    assert.ok(path.isAbsolute(value), "Cloud render paths must be absolute");
  }
  return async () => {
    const scratchRoot = await realpath(options.scratchRoot);
    await mkdir(options.outputRoot, { recursive: true });
    const outputRoot = await realpath(options.outputRoot);
    const relative = path.relative(scratchRoot, outputRoot);
    assert.ok(
      path.isAbsolute(relative) ||
        relative === ".." ||
        relative.startsWith(`..${path.sep}`),
      "Cloud render evidence must be outside disposable scratch",
    );
    const sessionRoot = await mkdtemp(path.join(outputRoot, "session-"));
    let disposed = false;
    let chain: Promise<unknown> = Promise.resolve();
    let disposal: Promise<void> | undefined;
    let browser: RenderBundleBrowserMetadata | undefined;
    let sequence = 0;

    async function renderOnce(
      input: ApertureRenderSessionRenderOptions,
    ): Promise<RenderBundleResult> {
      const dimensions = validateViewport({
        width: input.width,
        height: input.height,
      });
      const stem = path.join(sessionRoot, String(++sequence).padStart(3, "0"));
      const bundlePath = `${stem}.bundle.json`;
      const screenshotPath = `${stem}.png`;
      await writeFile(bundlePath, JSON.stringify(input.bundle));
      const engine = resolveEnginePackages();
      assert.ok(
        Object.keys(engine.importMap).length > 0,
        "Engine packages are not built/resolved",
      );
      const server = await startApertureStaticServer({
        mounts: [
          ...engine.mounts,
          {
            prefix: "/_harness/",
            dir: fileURLToPath(
              new URL(
                "../../packages/cli/assets/render-harness/",
                import.meta.url,
              ),
            ),
          },
        ],
        index: () => renderHarnessHtml(engine.importMap, dimensions),
      });
      try {
        const report = await runVerifiedScene({
          runtimeRoot: options.runtimeRoot,
          scratchRoot,
          url: `${server.url}/`,
          outputPath: `${stem}.report.json`,
          screenshotPath,
          bundlePath,
          viewport: dimensions,
          ...(input.timeoutMs === undefined
            ? {}
            : { timeout: input.timeoutMs }),
        });
        assert.equal(report.status, "passed");
        const status = report.sceneStatus;
        assert.ok(
          isRecord(status) && status["ok"] === true,
          "Harness status missing",
        );
        assert.ok(isRecord(status["metadata"]), "Harness metadata missing");
        assert.ok(
          report.browserVersion && report.launch?.actualArgv,
          "Verified browser provenance missing",
        );
        const png = await readFile(screenshotPath);
        const actualDimensions = readPngDimensions(png);
        assert.deepEqual(
          actualDimensions,
          dimensions,
          "PNG does not match the harness canvas",
        );
        browser = {
          channel: report.browserVersion,
          headless: report.launch.actualArgv.includes("--headless"),
          args: report.launch.actualArgv.slice(1),
        };
        const diagnostics = status["diagnostics"];
        return {
          png,
          frame: typeof status["frame"] === "number" ? status["frame"] : null,
          metadata: {
            ...renderBundleFeedbackMetadata({
              ...(Array.isArray(diagnostics) ? { diagnostics } : {}),
              ...(status["shadow"] === undefined
                ? {}
                : { shadow: status["shadow"] }),
            }),
            browser,
            requestedDimensions: dimensions,
            actualDimensions,
            bundleDigest: readRenderBundleDigestMetadata(input.bundle),
            webgpu: normalizeRenderBundleWebGpuMetadata(
              status["metadata"]["webgpu"],
            ),
            lightingHealth: status["metadata"]["lightingHealth"] ?? null,
          },
        };
      } finally {
        await server.close();
      }
    }

    return {
      // There is no launched browser until the first render. Never synthesize
      // launch metadata; expose the last verified browser only once observed.
      get browser() {
        assert.ok(browser, "No browser has completed a verified render yet");
        return browser;
      },
      render(input) {
        if (disposed)
          return Promise.reject(
            new Error("This render session has been disposed"),
          );
        const result = chain.then(() => renderOnce(input));
        chain = result.catch(() => undefined);
        return result;
      },
      dispose() {
        disposed = true;
        disposal ??= chain.then(() => undefined);
        return disposal;
      },
    };
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}
