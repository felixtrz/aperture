import {
  chromium,
  expect,
  type Browser,
  type BrowserServer,
  type Page,
} from "@playwright/test";
import type { ChildProcess } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { isWebGpuValidationConsoleMessage } from "../webgpu-status.js";
import { diffPngSamples, diffStatusSnapshots } from "./diff.js";
import type {
  CapturedPixelSample,
  ExampleControlCapabilities,
  ExampleControlSnapshot,
  NamedPixelSample,
  PixelDiffReport,
  RenderControlScreenshot,
  RenderControlWarning,
  RenderControlWaitReadyOptions,
  StatusDiffReport,
} from "./types.js";

export interface RenderControlPageOptions {
  readonly artifactDir?: string;
}

export interface StartBrowserOptions extends RenderControlPageOptions {
  readonly headless?: boolean;
  readonly channel?: string;
  readonly baseURL?: string;
}

export interface RenderControlBrowser {
  readonly browser: Browser;
  readonly page: Page;
  readonly controller: RenderControlPage;
  stopBrowser(): Promise<void>;
}

type ExampleControlGlobal = typeof globalThis & {
  readonly __APERTURE_EXAMPLE_CONTROL__?: {
    readonly version: number;
    readonly capabilities: ExampleControlCapabilities;
    getStatus(): unknown | Promise<unknown>;
    getWarnings(): unknown | Promise<unknown>;
    pause(): unknown | Promise<unknown>;
    resume(): unknown | Promise<unknown>;
    step(frames?: number): unknown | Promise<unknown>;
    setScenario(id: string, options?: unknown): unknown | Promise<unknown>;
    snapshot(label?: string): unknown | Promise<unknown>;
    getFrameState(): unknown | Promise<unknown>;
  };
  readonly __APERTURE_EXAMPLE_STATUS__?: unknown;
};

export async function startBrowser(
  options: StartBrowserOptions = {},
): Promise<RenderControlBrowser> {
  const browserServer = await chromium.launchServer({
    channel: options.channel ?? "chrome",
    headless: options.headless ?? false,
    args: ["--enable-unsafe-webgpu"],
  });
  const browser = await chromium.connect(browserServer.wsEndpoint());
  const page = await browser.newPage({
    baseURL: options.baseURL ?? "http://127.0.0.1:4173",
    viewport: { width: 960, height: 640 },
  });
  const controller = createRenderControlPage(page, options);

  return {
    browser,
    page,
    controller,
    async stopBrowser() {
      await closeBrowserWithTimeout(browser, browserServer);
    },
  };
}

export interface RenderControlPage {
  readonly page: Page;
  readonly webGpuValidationMessages: readonly string[];
  newPage(): Promise<Page>;
  navigate(url: string): Promise<unknown>;
  refresh(): Promise<unknown>;
  resetToBlank(): Promise<void>;
  waitReady(options?: RenderControlWaitReadyOptions): Promise<unknown>;
  getCapabilities(): Promise<ExampleControlCapabilities>;
  getStatus(): Promise<unknown>;
  getWarnings(): Promise<readonly RenderControlWarning[]>;
  assertNoWebGpuValidationWarnings(): Promise<void>;
  pauseFrames(): Promise<unknown>;
  resumeFrames(): Promise<unknown>;
  stepFrames(count: number): Promise<unknown>;
  runScenario(id: string, options?: unknown): Promise<unknown>;
  captureSnapshot(label: string): Promise<ExampleControlSnapshot>;
  captureScreenshot(label: string): Promise<RenderControlScreenshot>;
  samplePixels(
    points: readonly NamedPixelSample[],
  ): Promise<readonly CapturedPixelSample[]>;
  diffStatus(
    before: unknown,
    after: unknown,
    options?: Parameters<typeof diffStatusSnapshots>[2],
  ): StatusDiffReport;
  diffPixels(
    before: Buffer,
    after: Buffer,
    points: readonly NamedPixelSample[],
  ): PixelDiffReport;
  saveArtifact(kind: string, label: string, payload: unknown): Promise<string>;
}

export function createRenderControlPage(
  page: Page,
  options: RenderControlPageOptions = {},
): RenderControlPage {
  const webGpuValidationMessages: string[] = [];
  let currentScopeWarningOffset = 0;
  const artifactDir =
    options.artifactDir ?? path.join("test-results", "render-control");

  page.on("console", (message) => {
    if (isWebGpuValidationConsoleMessage(message)) {
      webGpuValidationMessages.push(message.text());
    }
  });

  return {
    page,
    webGpuValidationMessages,
    async newPage() {
      const context = page.context();

      return context.newPage();
    },
    async navigate(url) {
      const warningOffset = webGpuValidationMessages.length;
      currentScopeWarningOffset = warningOffset;

      await page.goto(url, { waitUntil: "domcontentloaded" });
      const status = await waitForControlOrStatus(page, {
        phase: "navigate",
        warnings: webGpuValidationMessages.slice(warningOffset),
      });

      return {
        url,
        finalUrl: page.url(),
        status,
        webGpuValidationMessages: webGpuValidationMessages.slice(warningOffset),
      };
    },
    async refresh() {
      const warningOffset = webGpuValidationMessages.length;
      currentScopeWarningOffset = warningOffset;

      await page.reload({ waitUntil: "domcontentloaded" });
      const status = await waitForControlOrStatus(page, {
        phase: "refresh",
        warnings: webGpuValidationMessages.slice(warningOffset),
      });

      return {
        finalUrl: page.url(),
        status,
        webGpuValidationMessages: webGpuValidationMessages.slice(warningOffset),
      };
    },
    async resetToBlank() {
      await disposeKnownExamplesBeforeNavigation(page);
      await page.goto("about:blank");
      currentScopeWarningOffset = webGpuValidationMessages.length;
    },
    async waitReady(waitOptions = {}) {
      const waitRequest = {
        phase: waitOptions.phase ?? "waitReady",
        warnings: webGpuValidationMessages.slice(currentScopeWarningOffset),
        ...(waitOptions.timeoutMs === undefined
          ? {}
          : { timeoutMs: waitOptions.timeoutMs }),
      };

      return waitForControlOrStatus(page, waitRequest);
    },
    async getCapabilities() {
      const capabilities = await page.evaluate(() => {
        const control = (globalThis as ExampleControlGlobal)
          .__APERTURE_EXAMPLE_CONTROL__;

        return control?.capabilities ?? null;
      });

      if (capabilities === null) {
        throw await createRenderControlError(
          page,
          "getCapabilities",
          "Example did not expose __APERTURE_EXAMPLE_CONTROL__.",
          "missing-example-control",
          webGpuValidationMessages,
        );
      }

      return capabilities;
    },
    async getStatus() {
      return evaluateControl(page, "getStatus", [], webGpuValidationMessages);
    },
    async getWarnings() {
      const warnings = await evaluateControl(
        page,
        "getWarnings",
        [],
        webGpuValidationMessages,
      );

      return Array.isArray(warnings)
        ? (warnings as readonly RenderControlWarning[])
        : [];
    },
    async assertNoWebGpuValidationWarnings() {
      const pageWarnings = await this.getWarnings();
      const allWarnings = [
        ...webGpuValidationMessages.slice(currentScopeWarningOffset),
        ...pageWarnings.map((warning) => warning.text),
      ];

      expect(
        allWarnings,
        `WebGPU validation warnings should not be emitted:\n${allWarnings.join(
          "\n\n",
        )}`,
      ).toEqual([]);
    },
    async pauseFrames() {
      return evaluateControl(page, "pause", [], webGpuValidationMessages);
    },
    async resumeFrames() {
      return evaluateControl(page, "resume", [], webGpuValidationMessages);
    },
    async stepFrames(count) {
      return evaluateControl(page, "step", [count], webGpuValidationMessages);
    },
    async runScenario(id, scenarioOptions = {}) {
      currentScopeWarningOffset = webGpuValidationMessages.length;
      await page.bringToFront().catch(() => undefined);
      const capabilities = await this.getCapabilities();

      if (capabilities.scenario !== true) {
        return runPersistentShellScenario(
          page,
          id,
          scenarioOptions,
          webGpuValidationMessages,
        );
      }

      return evaluateControl(
        page,
        "setScenario",
        [id, scenarioOptions],
        webGpuValidationMessages,
      );
    },
    async captureSnapshot(label) {
      return (await evaluateControl(
        page,
        "snapshot",
        [label],
        webGpuValidationMessages,
      )) as ExampleControlSnapshot;
    },
    async captureScreenshot(label) {
      const locator = page.locator("#aperture-canvas");
      let png: Buffer;

      try {
        png = await locator.screenshot();
      } catch (error) {
        throw await createRenderControlError(
          page,
          "captureScreenshot",
          `Failed to capture #aperture-canvas screenshot: ${messageFromError(
            error,
          )}`,
          "screenshot-failed",
          webGpuValidationMessages,
        );
      }

      return { label, png };
    },
    async samplePixels(points) {
      const screenshot = await this.captureScreenshot("pixel-samples");

      return this.diffPixels(
        screenshot.png,
        screenshot.png,
        points,
      ).samples.map((sample, index) => ({
        id: sample.id,
        x: points[index]?.x ?? 0,
        y: points[index]?.y ?? 0,
        pixel: sample.before,
      }));
    },
    diffStatus(before, after, diffOptions) {
      return diffStatusSnapshots(before, after, diffOptions);
    },
    diffPixels(before, after, points) {
      return diffPngSamples(before, after, points);
    },
    async saveArtifact(kind, label, payload) {
      await mkdir(artifactDir, { recursive: true });

      const safeKind = safeArtifactSegment(kind);
      const safeLabel = safeArtifactSegment(label);
      const binary = binaryArtifactPayload(payload);

      if (binary !== null) {
        const filePath = path.join(
          artifactDir,
          `${safeKind}-${safeLabel}.${binary.extension}`,
        );

        await writeFile(filePath, binary.data);

        return filePath;
      }

      const filePath = path.join(artifactDir, `${safeKind}-${safeLabel}.json`);

      await writeFile(filePath, JSON.stringify(payload ?? null, null, 2));

      return filePath;
    },
  };
}

async function waitForControlOrStatus(
  page: Page,
  options: {
    readonly phase: string;
    readonly timeoutMs?: number;
    readonly warnings: readonly string[];
  },
): Promise<unknown> {
  try {
    await page.waitForFunction(
      () => {
        const global = globalThis as ExampleControlGlobal;
        const status = global.__APERTURE_EXAMPLE_STATUS__;
        const ok =
          typeof status === "object" &&
          status !== null &&
          (status as { readonly ok?: unknown }).ok === true;
        const phase =
          typeof status === "object" && status !== null
            ? (status as { readonly phase?: unknown }).phase
            : undefined;

        return status !== undefined && (ok || phase !== "loading");
      },
      undefined,
      { timeout: options.timeoutMs ?? 30000 },
    );
  } catch (error) {
    throw await createRenderControlError(
      page,
      options.phase,
      `Timed out waiting for example status/control readiness: ${messageFromError(
        error,
      )}`,
      "wait-ready-timeout",
      options.warnings,
    );
  }

  return page.evaluate(async () => {
    const global = globalThis as ExampleControlGlobal;
    const control = global.__APERTURE_EXAMPLE_CONTROL__;

    if (control !== undefined) {
      return control.getStatus();
    }

    return global.__APERTURE_EXAMPLE_STATUS__ ?? null;
  });
}

async function evaluateControl(
  page: Page,
  method: keyof NonNullable<
    ExampleControlGlobal["__APERTURE_EXAMPLE_CONTROL__"]
  >,
  args: readonly unknown[],
  webGpuValidationMessages: readonly string[],
): Promise<unknown> {
  const result = await page.evaluate(
    async ({ methodName, methodArgs }) => {
      const control = (globalThis as ExampleControlGlobal)
        .__APERTURE_EXAMPLE_CONTROL__;

      if (control === undefined) {
        return {
          ok: false,
          reason: "missing-example-control",
          message: "Example did not expose __APERTURE_EXAMPLE_CONTROL__.",
        };
      }

      const candidate = control[methodName];

      if (typeof candidate !== "function") {
        return {
          ok: false,
          reason: "missing-example-control-method",
          message: `Example control method '${String(methodName)}' is missing.`,
        };
      }

      return (candidate as (...args: readonly unknown[]) => unknown).apply(
        control,
        Array.from(methodArgs),
      );
    },
    { methodName: method, methodArgs: args },
  );

  if (isControlFailure(result)) {
    throw await createRenderControlError(
      page,
      String(method),
      result.message,
      result.reason,
      webGpuValidationMessages,
    );
  }

  return result;
}

async function runPersistentShellScenario(
  page: Page,
  id: string,
  options: unknown,
  webGpuValidationMessages: readonly string[],
): Promise<unknown> {
  const result = await page.evaluate(
    async ({ id, options }) => {
      const shell = (
        globalThis as typeof globalThis & {
          readonly __APERTURE_RENDER_PROOF_SHELL__?: {
            runScenario(id: string, options?: unknown): Promise<unknown>;
          };
        }
      ).__APERTURE_RENDER_PROOF_SHELL__;

      if (shell === undefined) {
        return {
          ok: false,
          reason: "unsupported-capability",
          message:
            "Example control does not support scenarios and no persistent shell API is available.",
        };
      }

      return shell.runScenario(id, options);
    },
    { id, options },
  );

  if (isControlFailure(result)) {
    throw await createRenderControlError(
      page,
      "setScenario",
      result.message,
      result.reason,
      webGpuValidationMessages,
    );
  }

  return result;
}

function isControlFailure(value: unknown): value is {
  readonly ok: false;
  readonly reason: string;
  readonly message: string;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { readonly ok?: unknown }).ok === false &&
    typeof (value as { readonly reason?: unknown }).reason === "string" &&
    ((value as { readonly reason: string }).reason ===
      "unsupported-capability" ||
      (value as { readonly reason: string }).reason.startsWith(
        "missing-example-control",
      ))
  );
}

function safeArtifactSegment(value: string): string {
  return (
    value.replace(/[^a-z0-9._-]+/giu, "-").replace(/^-|-$/gu, "") || "artifact"
  );
}

function binaryArtifactPayload(payload: unknown): {
  readonly data: Buffer;
  readonly extension: string;
} | null {
  if (Buffer.isBuffer(payload)) {
    return {
      data: payload,
      extension: isPng(payload) ? "png" : "bin",
    };
  }

  if (payload instanceof Uint8Array) {
    const data = Buffer.from(payload);

    return {
      data,
      extension: isPng(data) ? "png" : "bin",
    };
  }

  if (isRecord(payload) && Buffer.isBuffer(payload.png)) {
    return {
      data: payload.png,
      extension: "png",
    };
  }

  return null;
}

async function createRenderControlError(
  page: Page,
  phase: string,
  message: string,
  reason: string,
  webGpuValidationMessages: readonly string[],
): Promise<Error> {
  const status = await readStatusNoThrow(page);
  const warnings = webGpuValidationMessages.slice(-5);

  return new Error(
    [
      message,
      `url=${page.url()}`,
      `phase=${phase}`,
      `reason=${reason}`,
      `status=${summarizeValue(status)}`,
      `recentWebGpuWarnings=${summarizeValue(warnings)}`,
    ].join(" "),
  );
}

async function readStatusNoThrow(page: Page): Promise<unknown> {
  try {
    return await page.evaluate(() => {
      const global = globalThis as ExampleControlGlobal;

      return global.__APERTURE_EXAMPLE_STATUS__ ?? null;
    });
  } catch {
    return null;
  }
}

async function disposeKnownExamplesBeforeNavigation(page: Page): Promise<void> {
  await page
    .evaluate(async () => {
      const global = globalThis as typeof globalThis & {
        readonly __APERTURE_SPINNING_CUBE_STOP__?: () => unknown;
        readonly __APERTURE_POST_EFFECTS_STOP__?: () => unknown;
        readonly __APERTURE_GLB_VIEWER_STOP__?: () => unknown;
        readonly __APERTURE_RENDER_PROOF_SHELL__?: {
          readonly dispose?: () => unknown;
        };
      };

      await Promise.all([
        Promise.resolve(global.__APERTURE_SPINNING_CUBE_STOP__?.()),
        Promise.resolve(global.__APERTURE_POST_EFFECTS_STOP__?.()),
        Promise.resolve(global.__APERTURE_GLB_VIEWER_STOP__?.()),
        Promise.resolve(global.__APERTURE_RENDER_PROOF_SHELL__?.dispose?.()),
      ]);
    })
    .catch(() => undefined);
}

function summarizeValue(value: unknown): string {
  try {
    const json = JSON.stringify(value ?? null);

    return json.length > 500 ? `${json.slice(0, 500)}...` : json;
  } catch {
    return '"<non-json-safe>"';
  }
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isPng(buffer: Buffer): boolean {
  return buffer.subarray(0, 8).toString("hex") === "89504e470d0a1a0a";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function closeBrowserWithTimeout(
  browser: Browser,
  browserServer?: BrowserServer,
  timeoutMs = 5_000,
): Promise<void> {
  const child = browserServer?.process();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let browserCloseSettled = false;
  const closePromise = browser
    .close({ reason: "render-control-stop" })
    .catch(() => undefined)
    .finally(() => {
      browserCloseSettled = true;
    });

  try {
    await Promise.race([
      closePromise,
      new Promise<void>((resolve) => {
        timeoutId = setTimeout(resolve, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  }

  if (!browserCloseSettled && browserServer !== undefined) {
    await Promise.race([
      browserServer.kill().catch(() => undefined),
      delay(1_000),
    ]);
    await Promise.race([closePromise, delay(1_000)]);
    return;
  }

  if (
    child !== undefined &&
    child.exitCode === null &&
    child.signalCode === null
  ) {
    child.kill("SIGTERM");
    await waitForProcessExit(child, 1_000);

    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
      await waitForProcessExit(child, 1_000);
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function waitForProcessExit(
  child: ChildProcess,
  timeoutMs: number,
): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const timeoutId = setTimeout(resolve, timeoutMs);

    child.once("exit", () => {
      clearTimeout(timeoutId);
      resolve();
    });
  });
}
