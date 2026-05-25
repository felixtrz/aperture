import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { expect, test } from "@playwright/test";

import { pixelDistance, readPngImage, type RgbaPixel } from "./png.js";

const DEVELOPER_API_PORT = 5175;
const DEVELOPER_API_URL = `http://127.0.0.1:${DEVELOPER_API_PORT}/`;

type GeneratedStatusGlobal = typeof globalThis & {
  readonly __APERTURE_GENERATED_APP__?: GeneratedBrowserAppStatus;
};

interface GeneratedBrowserAppStatus {
  readonly status: string;
  readonly webgpuOk: boolean | null;
  readonly snapshots: number;
  readonly mirroredSourceAssets: number;
  readonly forwardedInputEvents?: number;
  readonly lastInputEvent?: unknown;
  readonly lastWorkerSummary?: {
    readonly input?: {
      readonly actions?: Record<
        string,
        {
          readonly pressed?: boolean;
          readonly value?: number;
        }
      >;
    };
    readonly diagnostics?: readonly {
      readonly code?: string;
      readonly severity?: string;
      readonly data?: Record<string, unknown>;
    }[];
  };
  readonly diagnostics?: {
    readonly lastFrame?: {
      readonly counts?: {
        readonly views?: number;
        readonly meshDraws?: number;
        readonly drawCalls?: number;
        readonly diagnostics?: number;
      };
      readonly diagnostics?: readonly unknown[];
    };
  };
}

let server: ChildProcess | null = null;
let serverOutput = "";

test.beforeAll(async () => {
  server = spawn(
    process.execPath,
    [
      path.resolve("node_modules/vite/bin/vite.js"),
      "--host",
      "127.0.0.1",
      "--port",
      String(DEVELOPER_API_PORT),
      "--strictPort",
      "--config",
      "vite.config.ts",
    ],
    {
      cwd: path.resolve("examples/developer-api"),
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  server.stdout?.on("data", (chunk: Buffer) => {
    serverOutput += chunk.toString();
  });
  server.stderr?.on("data", (chunk: Buffer) => {
    serverOutput += chunk.toString();
  });

  await waitForDeveloperApiServer();
});

test.afterAll(async () => {
  await stopDeveloperApiServer();
});

test("generated Vite browser bootstrap renders a config/system-authored scene", async ({
  page,
}) => {
  await page.goto(DEVELOPER_API_URL, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => {
      const status = (globalThis as GeneratedStatusGlobal)
        .__APERTURE_GENERATED_APP__;
      const counts = status?.diagnostics?.lastFrame?.counts;

      return (
        status?.webgpuOk === true &&
        (status.snapshots ?? 0) > 2 &&
        (counts?.views ?? 0) >= 1 &&
        (counts?.meshDraws ?? 0) >= 2 &&
        (counts?.drawCalls ?? 0) >= 2
      );
    },
    undefined,
    { timeout: 30000 },
  );

  await page.waitForTimeout(500);

  const status = await page.evaluate(
    () =>
      (globalThis as GeneratedStatusGlobal).__APERTURE_GENERATED_APP__ ?? null,
  );

  await test.info().attach("developer-api-status", {
    body: JSON.stringify(status, null, 2),
    contentType: "application/json",
  });

  expect(status?.status).toBe("running");
  expect(status?.webgpuOk).toBe(true);
  expect(status?.mirroredSourceAssets ?? 0).toBeGreaterThan(0);
  expect(status?.diagnostics?.lastFrame?.counts?.views).toBe(1);
  expect(
    status?.diagnostics?.lastFrame?.counts?.meshDraws ?? 0,
  ).toBeGreaterThan(1);
  expect(
    status?.diagnostics?.lastFrame?.counts?.drawCalls ?? 0,
  ).toBeGreaterThan(1);
  expect(status?.diagnostics?.lastFrame?.counts?.diagnostics).toBe(0);
  expect(status?.diagnostics?.lastFrame?.diagnostics ?? []).toEqual([]);

  const canvasBox = await page.locator("#aperture").boundingBox();
  expect(canvasBox).not.toBeNull();

  await page.mouse.move(
    canvasBox!.x + canvasBox!.width * 0.5,
    canvasBox!.y + canvasBox!.height * 0.5,
  );
  await page.mouse.down();
  await page.waitForFunction(
    () => {
      const status = (globalThis as GeneratedStatusGlobal)
        .__APERTURE_GENERATED_APP__;
      const select = status?.lastWorkerSummary?.input?.actions?.select;
      const diagnostics = status?.lastWorkerSummary?.diagnostics ?? [];

      return (
        (status?.forwardedInputEvents ?? 0) > 0 &&
        select?.pressed === true &&
        diagnostics.some(
          (diagnostic) =>
            diagnostic.code === "select.pressed" &&
            diagnostic.data?.mutatedComponent === "aperture.metadata.debug",
        )
      );
    },
    undefined,
    { timeout: 10000 },
  );

  const inputStatus = await page.evaluate(
    () =>
      (globalThis as GeneratedStatusGlobal).__APERTURE_GENERATED_APP__ ?? null,
  );

  await test.info().attach("developer-api-input-status", {
    body: JSON.stringify(inputStatus?.lastWorkerSummary ?? null, null, 2),
    contentType: "application/json",
  });

  expect(inputStatus?.forwardedInputEvents ?? 0).toBeGreaterThan(0);
  expect(inputStatus?.lastWorkerSummary?.input?.actions?.select?.pressed).toBe(
    true,
  );
  expect(inputStatus?.lastWorkerSummary?.diagnostics ?? []).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code: "select.pressed",
        data: expect.objectContaining({
          mutatedComponent: "aperture.metadata.debug",
        }),
      }),
    ]),
  );

  const screenshot = await page.locator("#aperture").screenshot();
  await page.mouse.up();
  const image = readPngImage(screenshot);
  const clear = rgba(8, 9, 10, 255);
  const proof = countNonClearPixels(image, clear);

  await test.info().attach("developer-api-pixel-proof", {
    body: JSON.stringify(proof, null, 2),
    contentType: "application/json",
  });

  expect(proof.nonClearSamples).toBeGreaterThan(3);
  expect(proof.maxDistance).toBeGreaterThan(20);
});

async function waitForDeveloperApiServer(): Promise<void> {
  const deadline = Date.now() + 30000;
  let lastError: unknown = null;

  while (Date.now() < deadline) {
    if (server?.exitCode !== null) {
      throw new Error(
        `Developer API Vite server exited early with code ${server?.exitCode}.\n${serverOutput}`,
      );
    }

    try {
      const response = await fetch(DEVELOPER_API_URL);
      if (response.ok) {
        return;
      }
    } catch (error: unknown) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(
    `Timed out waiting for Developer API Vite server. Last error: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }\n${serverOutput}`,
  );
}

async function stopDeveloperApiServer(): Promise<void> {
  const current = server;
  server = null;

  if (current === null || current.exitCode !== null) {
    return;
  }

  const stopped = new Promise<void>((resolve) => {
    current.once("exit", () => resolve());
  });
  current.kill("SIGTERM");

  let timeout: ReturnType<typeof setTimeout> | null = null;

  try {
    await Promise.race([
      stopped,
      new Promise<void>((resolve) => {
        timeout = setTimeout(() => {
          current.kill("SIGKILL");
          resolve();
        }, 3000);
      }),
    ]);
  } finally {
    if (timeout !== null) {
      clearTimeout(timeout);
    }

    current.stdout?.destroy();
    current.stderr?.destroy();
    current.unref();
  }
}

function countNonClearPixels(
  image: ReturnType<typeof readPngImage>,
  clear: RgbaPixel,
): {
  readonly nonClearSamples: number;
  readonly maxDistance: number;
  readonly best: {
    readonly x: number;
    readonly y: number;
    readonly pixel: RgbaPixel;
  };
} {
  let nonClearSamples = 0;
  let maxDistance = 0;
  let best = { x: 0, y: 0, pixel: rgba(0, 0, 0, 0) };

  for (let y = 0; y < image.height; y += 3) {
    for (let x = 0; x < image.width; x += 3) {
      const pixel = readPixel(image, x, y);
      const distance = pixelDistance(pixel, clear);

      if (distance > 20) {
        nonClearSamples += 1;
      }

      if (distance > maxDistance) {
        maxDistance = distance;
        best = { x, y, pixel };
      }
    }
  }

  return { nonClearSamples, maxDistance, best };
}

function readPixel(
  image: ReturnType<typeof readPngImage>,
  x: number,
  y: number,
): RgbaPixel {
  const offset = (y * image.width + x) * image.bytesPerPixel;

  return {
    r: image.pixels[offset] ?? 0,
    g: image.pixels[offset + 1] ?? 0,
    b: image.pixels[offset + 2] ?? 0,
    a: image.bytesPerPixel === 4 ? (image.pixels[offset + 3] ?? 0) : 255,
  };
}

function rgba(r: number, g: number, b: number, a: number): RgbaPixel {
  return { r, g, b, a };
}
