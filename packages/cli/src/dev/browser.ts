import { spawn } from "node:child_process";
import type { WriteStream } from "node:fs";
import path from "node:path";
import {
  APERTURE_MCP_MANAGED_GLOBAL,
  readApertureDevSession,
} from "../session.js";
import type { ManagedBrowser } from "./types.js";
import { appendLog } from "./logs.js";

export async function launchManagedBrowser(input: {
  readonly url: string;
  readonly host: string;
  readonly cdpPort: number;
  readonly headless: boolean;
  readonly log: WriteStream;
}): Promise<ManagedBrowser> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({
    headless: input.headless,
    // Use the user's installed Google Chrome (real GPU/Metal stack), NOT Playwright's
    // bundled Chromium. The bundled build has a flakier WebGPU path on macOS and,
    // combined with --enable-unsafe-webgpu, intermittently selects the software
    // (SwiftShader) fallback adapter and renders garbage (full-screen magenta).
    // Stock Chrome ships WebGPU on the hardware adapter by default, so we add no
    // GPU/WebGPU flags here and let it behave exactly like the user's own browser.
    channel: "chrome",
    args: [
      `--remote-debugging-address=${input.host}`,
      `--remote-debugging-port=${input.cdpPort}`,
      // Keep WebGPU rendering alive when the headed window is occluded or
      // backgrounded. These only affect scheduling, not the GPU path: without
      // them macOS/Chrome drops the frame and WebGPU readbacks (screenshots,
      // render_readback_samples) come back all-zero / blank even though the
      // simulation is healthy.
      "--disable-features=CalculateNativeWinOcclusion",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--disable-background-timer-throttling",
    ],
  });
  const page = await browser.newPage({ viewport: { width: 960, height: 640 } });

  page.on("console", (message) => {
    void appendLog(input.log, `[${message.type()}] ${message.text()}`);
  });
  page.on("pageerror", (error) => {
    void appendLog(input.log, `[pageerror] ${error.stack ?? error.message}`);
  });
  await page.addInitScript((managedGlobal: string) => {
    Object.defineProperty(globalThis, managedGlobal, {
      configurable: true,
      value: true,
    });
  }, APERTURE_MCP_MANAGED_GLOBAL);
  await page.goto(input.url, { waitUntil: "domcontentloaded" });

  const processProvider = browser as unknown as {
    process?: () => { readonly pid?: number } | null;
  };
  const pid = processProvider.process?.()?.pid ?? null;

  return {
    pid,
    async close() {
      await browser.close();
    },
  };
}

export async function openApertureDevSession(cwd: string): Promise<void> {
  const session = await readApertureDevSession(path.resolve(cwd));

  if (session === null) {
    throw new Error("No Aperture dev session exists. Run 'aperture dev up'.");
  }

  const command =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "cmd"
        : "xdg-open";
  const args =
    process.platform === "win32"
      ? ["/c", "start", "", session.url]
      : [session.url];

  spawn(command, args, {
    detached: true,
    stdio: "ignore",
  }).unref();
}
