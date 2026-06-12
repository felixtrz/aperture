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
  readonly forwardedCommandEvents?: number;
  readonly lastCommandEvent?: unknown;
  readonly lastFailure?: {
    readonly status?: string;
    readonly diagnostics?: readonly {
      readonly code?: string;
      readonly message?: string;
      readonly suggestedFix?: string;
    }[];
  } | null;
  readonly lastWorkerSummary?: {
    readonly signals?: {
      readonly selectedEntity?: {
        readonly index?: number;
        readonly generation?: number;
      } | null;
    };
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
    readonly commands?: {
      readonly enqueued?: number;
      readonly drained?: number;
      readonly requestedAssets?: readonly {
        readonly id?: string;
        readonly status?: string;
        readonly ready?: boolean;
      }[];
    };
    readonly entities?: {
      readonly total?: number;
      readonly summaries?: readonly {
        readonly key?: string;
        readonly name?: string;
        readonly componentIds?: readonly string[];
        readonly tags?: readonly string[];
        readonly source?: {
          readonly assetId?: string;
          readonly gltfNodeIndex?: number;
          readonly gltfNodePath?: string;
        };
      }[];
    };
    readonly entityTools?: {
      readonly finds?: number;
      readonly gets?: number;
      readonly mutations?: number;
      readonly snapshots?: number;
      readonly diffs?: number;
      readonly lastFind?: {
        readonly total?: number;
        readonly summaries?: readonly {
          readonly entity?: {
            readonly index?: number;
            readonly generation?: number;
          };
          readonly key?: string;
        }[];
      };
      readonly lastGet?: {
        readonly ok?: boolean;
        readonly summary?: {
          readonly entity?: {
            readonly index?: number;
            readonly generation?: number;
          };
          readonly key?: string;
        };
      };
      readonly lastMutation?: {
        readonly ok?: boolean;
        readonly component?: string;
        readonly field?: string;
        readonly value?: unknown;
      };
      readonly lastSnapshot?: {
        readonly label?: string;
        readonly total?: number;
      };
      readonly lastDiff?: {
        readonly fromLabel?: string;
        readonly toLabel?: string;
        readonly counts?: {
          readonly added?: number;
          readonly removed?: number;
          readonly changed?: number;
          readonly unchanged?: number;
        };
      };
      readonly diagnostics?: readonly unknown[];
    };
  };
  readonly diagnostics?: {
    readonly lastFrame?: {
      readonly msaa?: {
        readonly requestedSampleCount?: number;
        readonly sampleCount?: number;
        readonly enabled?: boolean;
        readonly clamped?: boolean;
        readonly colorTargets?: number;
      };
      readonly renderTargets?: readonly {
        readonly width?: number;
        readonly height?: number;
        readonly msaaSampleCount?: number;
      }[];
      readonly counts?: {
        readonly views?: number;
        readonly meshDraws?: number;
        readonly drawCalls?: number;
        readonly diagnostics?: number;
      };
      readonly diagnostics?: readonly unknown[];
    };
  };
  readonly render?: {
    readonly requestedSampleCount?: number;
    readonly sampleCountSource?: string;
    readonly pixelRatio?: number;
    readonly maxPixelRatio?: number;
    readonly pixelRatioSource?: string;
    readonly diagnostics?: readonly unknown[];
  } | null;
  readonly canvas?: {
    readonly width?: number;
    readonly height?: number;
    readonly displayWidth?: number;
    readonly displayHeight?: number;
    readonly pixelRatio?: number;
    readonly aspect?: number;
    readonly maxPixelRatio?: number;
    readonly pixelRatioSource?: string;
    readonly resizeSource?: string;
    readonly measurementSource?: string;
  } | null;
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

test("generated developer API Vite browser bootstrap renders a config/system-authored scene", async ({
  context,
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
        (counts?.meshDraws ?? 0) >= 3 &&
        (counts?.drawCalls ?? 0) >= 3
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
  ).toBeGreaterThan(2);
  expect(
    status?.diagnostics?.lastFrame?.counts?.drawCalls ?? 0,
  ).toBeGreaterThan(2);
  expect(status?.diagnostics?.lastFrame?.counts?.diagnostics).toBe(0);
  expect(status?.diagnostics?.lastFrame?.diagnostics ?? []).toEqual([]);
  expect(status?.render).toMatchObject({
    requestedSampleCount: 4,
    sampleCountSource: "default",
    maxPixelRatio: 2,
    diagnostics: [],
  });
  expect(status?.diagnostics?.lastFrame?.msaa).toMatchObject({
    requestedSampleCount: 4,
    sampleCount: 4,
    enabled: true,
    clamped: false,
  });
  expect(status?.diagnostics?.lastFrame?.renderTargets?.[0]).toMatchObject({
    msaaSampleCount: 4,
  });
  expect(status?.canvas).toMatchObject({
    width: expect.any(Number),
    height: expect.any(Number),
    displayWidth: expect.any(Number),
    displayHeight: expect.any(Number),
    pixelRatio: expect.any(Number),
    aspect: expect.any(Number),
  });
  expect(status?.canvas?.width).toBe(
    Math.max(
      1,
      Math.floor(
        (status?.canvas?.displayWidth ?? 0) * (status?.canvas?.pixelRatio ?? 0),
      ),
    ),
  );
  expect(status?.diagnostics?.lastFrame?.renderTargets?.[0]?.width).toBe(
    status?.canvas?.width,
  );
  expect(status?.diagnostics?.lastFrame?.renderTargets?.[0]?.height).toBe(
    status?.canvas?.height,
  );

  const initialCanvasWidth = status?.canvas?.width ?? 0;
  await page.setViewportSize({ width: 740, height: 720 });
  await page.waitForFunction(
    (previousWidth) => {
      const status = (globalThis as GeneratedStatusGlobal)
        .__APERTURE_GENERATED_APP__;
      const canvas = status?.canvas;
      const target = status?.diagnostics?.lastFrame?.renderTargets?.[0];

      return (
        canvas !== null &&
        canvas !== undefined &&
        typeof canvas.width === "number" &&
        canvas.width !== previousWidth &&
        target?.width === canvas.width &&
        target?.height === canvas.height
      );
    },
    initialCanvasWidth,
    { timeout: 10000 },
  );

  const resizedStatus = await page.evaluate(
    () =>
      (globalThis as GeneratedStatusGlobal).__APERTURE_GENERATED_APP__ ?? null,
  );

  await test.info().attach("developer-api-resized-status", {
    body: JSON.stringify(
      {
        canvas: resizedStatus?.canvas,
        renderTarget:
          resizedStatus?.diagnostics?.lastFrame?.renderTargets?.[0] ?? null,
      },
      null,
      2,
    ),
    contentType: "application/json",
  });

  expect(resizedStatus?.canvas?.width).toBe(
    Math.max(
      1,
      Math.floor(
        (resizedStatus?.canvas?.displayWidth ?? 0) *
          (resizedStatus?.canvas?.pixelRatio ?? 0),
      ),
    ),
  );
  expect(resizedStatus?.diagnostics?.lastFrame?.renderTargets?.[0]?.width).toBe(
    resizedStatus?.canvas?.width,
  );
  expect(
    resizedStatus?.diagnostics?.lastFrame?.renderTargets?.[0]?.height,
  ).toBe(resizedStatus?.canvas?.height);
  expect(resizedStatus?.canvas?.aspect).toBeCloseTo(
    (resizedStatus?.canvas?.displayWidth ?? 1) /
      (resizedStatus?.canvas?.displayHeight ?? 1),
    5,
  );
  expect(status?.lastWorkerSummary?.entities?.total ?? 0).toBeGreaterThan(0);
  expect(status?.lastWorkerSummary?.entities?.summaries ?? []).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        key: "level.crate.primary",
        tags: expect.arrayContaining(["interactive", "crate"]),
      }),
      expect.objectContaining({
        key: "level.robot",
        source: expect.objectContaining({
          assetId: "robot",
        }),
      }),
      expect.objectContaining({
        key: "level.custom.water",
        tags: expect.arrayContaining(["custom-wgsl", "shader-asset"]),
      }),
    ]),
  );
  await expect(page.locator("#aperture-dev-status")).toContainText(
    "level.crate.primary",
  );

  await page.locator("[data-aperture-action='snapshot']").click();
  await page.waitForFunction(
    () => {
      const status = (globalThis as GeneratedStatusGlobal)
        .__APERTURE_GENERATED_APP__;
      const entityTools = status?.lastWorkerSummary?.entityTools;
      const snapshot = entityTools?.lastSnapshot;

      return (
        (status?.forwardedCommandEvents ?? 0) > 0 &&
        (entityTools?.snapshots ?? 0) > 0 &&
        snapshot?.label?.startsWith("panel.snapshot.") === true &&
        (snapshot?.total ?? 0) > 0
      );
    },
    undefined,
    { timeout: 10000 },
  );

  const snapshotStatus = await page.evaluate(
    () =>
      (globalThis as GeneratedStatusGlobal).__APERTURE_GENERATED_APP__ ?? null,
  );

  await test.info().attach("developer-api-entity-snapshot-status", {
    body: JSON.stringify(
      snapshotStatus?.lastWorkerSummary?.entityTools ?? null,
      null,
      2,
    ),
    contentType: "application/json",
  });

  expect(snapshotStatus?.lastWorkerSummary?.entityTools).toMatchObject({
    snapshots: expect.any(Number),
    lastSnapshot: {
      label: expect.stringMatching(/^panel\.snapshot\./),
      total: expect.any(Number),
    },
  });
  await expect(page.locator("#aperture-dev-status")).toContainText(
    "panel.snapshot.",
  );

  await page.locator("[data-aperture-action='select']").click();
  await page.waitForFunction(
    () => {
      const status = (globalThis as GeneratedStatusGlobal)
        .__APERTURE_GENERATED_APP__;
      const selectedEntity = status?.lastWorkerSummary?.signals?.selectedEntity;
      const diagnostics = status?.lastWorkerSummary?.diagnostics ?? [];

      return (
        (status?.forwardedInputEvents ?? 0) > 0 &&
        typeof selectedEntity?.index === "number" &&
        typeof selectedEntity?.generation === "number" &&
        diagnostics.some(
          (diagnostic) =>
            diagnostic.code === "select.pressed" &&
            typeof diagnostic.data?.selectedEntity === "object" &&
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
  // Selection fires on pointer RELEASE (interaction onClick), so by the time
  // selectedEntity is observable the select action has already let go — assert
  // the configured action exists rather than a held value.
  expect(inputStatus?.lastWorkerSummary?.input?.actions?.select).toMatchObject({
    kind: "button",
  });
  expect(inputStatus?.lastWorkerSummary?.signals?.selectedEntity).toMatchObject(
    {
      index: expect.any(Number),
      generation: expect.any(Number),
    },
  );
  expect(inputStatus?.lastWorkerSummary?.diagnostics ?? []).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code: "select.pressed",
        data: expect.objectContaining({
          selectedEntity: expect.objectContaining({
            index: expect.any(Number),
            generation: expect.any(Number),
          }),
          mutatedComponent: "aperture.metadata.debug",
        }),
      }),
    ]),
  );
  await expect(page.locator("#aperture-dev-status")).toContainText(
    "select.pressed",
  );
  await expect(page.locator("#aperture-dev-status")).toContainText(
    "selectedEntity",
  );

  await page.locator("[data-aperture-action='diff']").click();
  await page.waitForFunction(
    () => {
      const status = (globalThis as GeneratedStatusGlobal)
        .__APERTURE_GENERATED_APP__;
      const entityTools = status?.lastWorkerSummary?.entityTools;
      const counts = entityTools?.lastDiff?.counts;

      return (
        (entityTools?.diffs ?? 0) > 0 &&
        entityTools?.lastDiff?.toLabel?.startsWith("panel.diff.") === true &&
        (counts?.changed ?? 0) > 0 &&
        (counts?.added ?? -1) >= 0 &&
        (counts?.removed ?? -1) >= 0 &&
        (counts?.unchanged ?? -1) >= 0
      );
    },
    undefined,
    { timeout: 10000 },
  );

  const diffStatus = await page.evaluate(
    () =>
      (globalThis as GeneratedStatusGlobal).__APERTURE_GENERATED_APP__ ?? null,
  );

  await test.info().attach("developer-api-entity-diff-status", {
    body: JSON.stringify(
      diffStatus?.lastWorkerSummary?.entityTools ?? null,
      null,
      2,
    ),
    contentType: "application/json",
  });

  expect(diffStatus?.lastWorkerSummary?.entityTools?.lastDiff).toMatchObject({
    fromLabel: expect.stringMatching(/^panel\.snapshot\./),
    toLabel: expect.stringMatching(/^panel\.diff\./),
    counts: {
      added: expect.any(Number),
      removed: expect.any(Number),
      changed: expect.any(Number),
      unchanged: expect.any(Number),
    },
  });
  expect(
    diffStatus?.lastWorkerSummary?.entityTools?.lastDiff?.counts?.changed ?? 0,
  ).toBeGreaterThan(0);
  await expect(page.locator("#aperture-dev-status")).toContainText(
    "panel.diff.",
  );
  await expect(page.locator("#aperture-dev-status")).toContainText("changed");

  await page.locator("[data-aperture-action='find-crate']").click();
  await page.waitForFunction(
    () => {
      const status = (globalThis as GeneratedStatusGlobal)
        .__APERTURE_GENERATED_APP__;
      const entityTools = status?.lastWorkerSummary?.entityTools;
      const first = entityTools?.lastFind?.summaries?.[0];

      return (
        (entityTools?.finds ?? 0) > 0 &&
        entityTools?.lastFind?.total === 1 &&
        first?.key === "level.crate.primary" &&
        typeof first?.entity?.index === "number"
      );
    },
    undefined,
    { timeout: 10000 },
  );

  await page.locator("[data-aperture-action='get-entity']").click();
  await page.waitForFunction(
    () => {
      const status = (globalThis as GeneratedStatusGlobal)
        .__APERTURE_GENERATED_APP__;
      const entityTools = status?.lastWorkerSummary?.entityTools;

      return (
        (entityTools?.gets ?? 0) > 0 &&
        entityTools?.lastGet?.ok === true &&
        entityTools.lastGet.summary?.key === "level.crate.primary"
      );
    },
    undefined,
    { timeout: 10000 },
  );

  await page.locator("[data-aperture-note-input]").fill("panel.note.e2e");
  await page.locator("[data-aperture-action='set-note']").click();
  await page.waitForFunction(
    () => {
      const status = (globalThis as GeneratedStatusGlobal)
        .__APERTURE_GENERATED_APP__;
      const entityTools = status?.lastWorkerSummary?.entityTools;

      return (
        (entityTools?.mutations ?? 0) > 0 &&
        entityTools?.lastMutation?.ok === true &&
        entityTools.lastMutation.component === "aperture.metadata.debug" &&
        entityTools.lastMutation.field === "note" &&
        entityTools.lastMutation.value === "panel.note.e2e"
      );
    },
    undefined,
    { timeout: 10000 },
  );

  const entityToolStatus = await page.evaluate(
    () =>
      (globalThis as GeneratedStatusGlobal).__APERTURE_GENERATED_APP__
        ?.lastWorkerSummary?.entityTools ?? null,
  );

  await test.info().attach("developer-api-entity-tool-status", {
    body: JSON.stringify(entityToolStatus, null, 2),
    contentType: "application/json",
  });

  expect(entityToolStatus).toMatchObject({
    lastFind: {
      total: 1,
      summaries: [
        expect.objectContaining({
          key: "level.crate.primary",
        }),
      ],
    },
    lastGet: {
      ok: true,
      summary: {
        key: "level.crate.primary",
      },
    },
    lastMutation: {
      ok: true,
      component: "aperture.metadata.debug",
      field: "note",
      value: "panel.note.e2e",
    },
  });
  await expect(page.locator("#aperture-dev-status")).toContainText(
    "panel.note.e2e",
  );

  await page.locator("[data-aperture-action='invalid-command']").click();
  await page.waitForFunction(
    () => {
      const status = (globalThis as GeneratedStatusGlobal)
        .__APERTURE_GENERATED_APP__;
      const diagnostic = status?.lastFailure?.diagnostics?.[0];

      return (
        status?.lastFailure?.status === "failed" &&
        diagnostic?.code === "aperture.command.invalid" &&
        diagnostic?.suggestedFix?.includes("aperture:command") === true
      );
    },
    undefined,
    { timeout: 10000 },
  );
  await expect(page.locator("#aperture-dev-status")).toContainText(
    "aperture.command.invalid",
  );
  await expect(page.locator("#aperture-dev-status")).toContainText(
    "Dispatch aperture:command",
  );

  await page.locator("[data-aperture-action='request-decal']").click();
  await page.waitForFunction(
    () => {
      const status = (globalThis as GeneratedStatusGlobal)
        .__APERTURE_GENERATED_APP__;
      const commands = status?.lastWorkerSummary?.commands;
      const diagnostics = status?.lastWorkerSummary?.diagnostics ?? [];

      return (
        (status?.forwardedCommandEvents ?? 0) > 0 &&
        (commands?.drained ?? 0) > 0 &&
        (commands?.requestedAssets ?? []).some(
          (asset) => asset.id === "decal" && asset.status === "ready",
        ) &&
        diagnostics.some(
          (diagnostic) =>
            diagnostic.code === "command.assetRequest.ready" &&
            diagnostic.data?.asset === "decal" &&
            diagnostic.data?.ready === true,
        )
      );
    },
    undefined,
    { timeout: 10000 },
  );

  const commandStatus = await page.evaluate(
    () =>
      (globalThis as GeneratedStatusGlobal).__APERTURE_GENERATED_APP__ ?? null,
  );

  await test.info().attach("developer-api-command-status", {
    body: JSON.stringify(commandStatus?.lastWorkerSummary ?? null, null, 2),
    contentType: "application/json",
  });

  expect(commandStatus?.forwardedCommandEvents ?? 0).toBeGreaterThan(0);
  expect(commandStatus?.lastCommandEvent).toMatchObject({
    channel: "asset.request",
    payload: { assetId: "decal" },
  });
  expect(commandStatus?.lastWorkerSummary?.commands).toMatchObject({
    enqueued: expect.any(Number),
    drained: expect.any(Number),
    requestedAssets: expect.arrayContaining([
      expect.objectContaining({
        id: "decal",
        status: "ready",
        ready: true,
      }),
    ]),
  });
  await expect(page.locator("#aperture-dev-status")).toContainText(
    "asset.request",
  );
  await expect(page.locator("#aperture-dev-status")).toContainText("decal");

  const screenshot = await page.locator("#aperture").screenshot();
  const image = readPngImage(screenshot);
  const clear = rgba(8, 9, 10, 255);
  const proof = countNonClearPixels(image, clear);

  await test.info().attach("developer-api-pixel-proof", {
    body: JSON.stringify(proof, null, 2),
    contentType: "application/json",
  });

  expect(proof.nonClearSamples).toBeGreaterThan(3);
  expect(proof.maxDistance).toBeGreaterThan(20);

  await context.close();
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
        await response.body?.cancel();
        return;
      }
      await response.body?.cancel();
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

  if (current === null) {
    return;
  }

  const cleanup = () => {
    current.stdout?.removeAllListeners();
    current.stderr?.removeAllListeners();
    current.removeAllListeners();
    current.stdout?.destroy();
    current.stderr?.destroy();
    current.unref();
  };

  if (current.exitCode !== null) {
    cleanup();
    return;
  }

  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      cleanup();
      resolve();
    };
    const timeout = setTimeout(() => {
      current.kill("SIGKILL");
      finish();
    }, 3000);

    current.once("exit", finish);
    current.once("close", finish);

    if (!current.kill("SIGTERM")) {
      finish();
    }
  });
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
