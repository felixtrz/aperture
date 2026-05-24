import { expect, test, type ConsoleMessage, type Page } from "@playwright/test";

import type { ExampleStatusBase } from "./example-status-types.js";
import {
  attachExampleStatus,
  expectStatusJsonSafeForGpu,
  isWebGpuValidationConsoleMessage,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";

interface PersistentRenderShellStatus {
  readonly example: string;
  readonly ok: boolean;
  readonly phase: string;
  readonly reason?: string;
  readonly message?: string;
  readonly renderingBackend?: string;
  readonly renderer?: PersistentRendererStatus;
  readonly scenario?: PersistentScenarioStatus | null;
  readonly completedRuns?: readonly {
    readonly id: string;
    readonly runId: string;
    readonly ok: boolean;
    readonly frameCount: number;
    readonly elapsedMs: number;
    readonly readbackOk: boolean;
  }[];
}

interface PersistentRendererStatus {
  readonly instanceId: string;
  readonly appCreatedCount: number;
  readonly canvasId: string | null;
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly canvasConnected: boolean;
  readonly readbackSupported: boolean;
}

interface PersistentScenarioStatus {
  readonly id: string;
  readonly runId: string;
  readonly runIndex: number;
  readonly ok: boolean;
  readonly phase: string;
  readonly frameCount: number;
  readonly elapsedMs: number;
  readonly webGpuWarnings: readonly string[];
  readonly renderer: PersistentRendererStatus;
  readonly readbackStatus?: {
    readonly ok: boolean;
    readonly reason?: string;
    readonly maxClearDistance?: number;
  };
  readonly logicLayer?: {
    readonly producer: string;
    readonly workerCreatedCount: number;
    readonly receivedSnapshots: number;
  };
  readonly proof?: {
    readonly kind: string;
    readonly transparentPressure?: {
      readonly ready: boolean;
      readonly recordCount: number;
      readonly expectedRecordCount: number;
      readonly depthOrderInversions: number;
      readonly renderOrderTieBreakCount: number;
      readonly stableIdTieBreakCount: number;
      readonly cameraMoved: boolean;
    };
    readonly transparentSortPolicy?: {
      readonly name: string;
      readonly depthOrder: string;
      readonly totalOrder: boolean;
    } | null;
    readonly commandPressure?: {
      readonly drawCommands: number;
    } | null;
    readonly clusterPressureHistoryStatus?: {
      readonly ready: boolean;
      readonly requiredFrames: number;
      readonly observedFrames: number;
      readonly baselineMode: string;
      readonly cachedPath: {
        readonly clusterBufferWrites: number;
        readonly cookieAtlasTileUpdates: number;
      };
      readonly noCacheBaseline: {
        readonly clusterBufferWrites: number;
        readonly cookieAtlasTileUpdates: number;
      };
      readonly avoided: {
        readonly clusterBufferWrites: number;
        readonly cookieAtlasTileUpdates: number;
      };
      readonly reduction: {
        readonly cachedWork: number;
        readonly baselineWork: number;
        readonly avoidedWork: number;
      };
      readonly stablePixels: {
        readonly ready: boolean;
        readonly maxLuminanceDelta: number;
      };
    };
  } | null;
  readonly counts?: {
    readonly diagnostics: number;
    readonly drawCalls: number;
    readonly meshDraws: number;
  } | null;
}

test("persistent render shell swaps scenario producers without recreating WebGPU app", async ({
  page,
}) => {
  test.setTimeout(120000);

  const webGpuValidationMessages = collectWebGpuValidationMessages(page);

  await page.goto("/examples/persistent-render-shell.html");

  const ready = await waitForExampleStatus<PersistentRenderShellStatus>(page);

  await attachExampleStatus("persistent-render-shell-ready", ready);
  expect(ready, "persistent render shell status should publish").toBeDefined();

  if (ready === undefined) {
    return;
  }

  skipIfUnsupportedWebGpu(ready as unknown as ExampleStatusBase);
  expectStatusJsonSafeForGpu(ready);
  expect(ready).toMatchObject({
    example: "persistent-render-shell",
    ok: true,
    phase: "ready",
    renderer: {
      appCreatedCount: 1,
      canvasId: "aperture-canvas",
      canvasConnected: true,
    },
  });

  const initialUrl = page.url();
  const rendererInstanceId = ready.renderer?.instanceId;

  const transparent = await runShellScenario(
    page,
    "transparent-pressure",
    "persistent-render-shell-transparent-pressure",
    webGpuValidationMessages,
  );

  expect(transparent).toMatchObject({
    example: "persistent-render-shell",
    ok: true,
    phase: "scenario-complete",
    renderer: {
      instanceId: rendererInstanceId,
      appCreatedCount: 1,
      canvasId: "aperture-canvas",
      canvasConnected: true,
    },
    scenario: {
      id: "transparent-pressure",
      ok: true,
      phase: "ready",
      renderer: {
        instanceId: rendererInstanceId,
        appCreatedCount: 1,
      },
      readbackStatus: {
        ok: true,
      },
      logicLayer: {
        producer: "fresh-ecs-extraction-worker",
      },
      proof: {
        kind: "transparent-pressure",
        transparentPressure: {
          ready: true,
          recordCount: 32,
          expectedRecordCount: 32,
          depthOrderInversions: 0,
          cameraMoved: true,
        },
        transparentSortPolicy: {
          name: "transparent-order-back-to-front-stable",
          depthOrder: "back-to-front",
          totalOrder: true,
        },
      },
      counts: {
        diagnostics: 0,
        meshDraws: 32,
      },
    },
  });
  expect(transparent.scenario?.frameCount ?? 0).toBeGreaterThanOrEqual(4);
  expect(
    transparent.scenario?.logicLayer?.receivedSnapshots ?? 0,
  ).toBeGreaterThanOrEqual(4);
  expect(
    transparent.scenario?.proof?.transparentPressure
      ?.renderOrderTieBreakCount ?? 0,
  ).toBeGreaterThan(0);
  expect(
    transparent.scenario?.proof?.transparentPressure?.stableIdTieBreakCount ??
      0,
  ).toBeGreaterThan(0);
  expect(
    transparent.scenario?.proof?.commandPressure?.drawCommands ?? 0,
  ).toBeGreaterThanOrEqual(32);

  const clustered = await runShellScenario(
    page,
    "clustered-pressure-history",
    "persistent-render-shell-clustered-pressure-history",
    webGpuValidationMessages,
  );
  const clusterHistory =
    clustered.scenario?.proof?.clusterPressureHistoryStatus;

  expect(clustered).toMatchObject({
    example: "persistent-render-shell",
    ok: true,
    phase: "scenario-complete",
    renderer: {
      instanceId: rendererInstanceId,
      appCreatedCount: 1,
      canvasId: "aperture-canvas",
      canvasConnected: true,
    },
    scenario: {
      id: "clustered-pressure-history",
      ok: true,
      phase: "ready",
      renderer: {
        instanceId: rendererInstanceId,
        appCreatedCount: 1,
      },
      readbackStatus: {
        ok: true,
      },
      logicLayer: {
        producer: "fresh-ecs-extraction-worker",
      },
      proof: {
        kind: "clustered-pressure-history",
        clusterPressureHistoryStatus: {
          ready: true,
          baselineMode: "derived-no-cache",
          stablePixels: {
            ready: true,
          },
        },
      },
      counts: {
        diagnostics: 0,
      },
    },
  });
  expect(clusterHistory).toBeDefined();
  expect(clusterHistory?.observedFrames ?? 0).toBeGreaterThanOrEqual(
    clusterHistory?.requiredFrames ?? Number.POSITIVE_INFINITY,
  );
  expect(clusterHistory?.avoided.clusterBufferWrites ?? 0).toBeGreaterThan(0);
  expect(clusterHistory?.reduction.avoidedWork ?? 0).toBeGreaterThan(0);
  expect(clusterHistory?.reduction.baselineWork ?? 0).toBeGreaterThan(
    clusterHistory?.reduction.cachedWork ?? Number.POSITIVE_INFINITY,
  );
  expect(
    clusterHistory?.stablePixels.maxLuminanceDelta ?? 0,
  ).toBeLessThanOrEqual(8);

  expect(page.url()).toBe(initialUrl);
  expect(clustered.completedRuns?.map((run) => run.id)).toEqual([
    "transparent-pressure",
  ]);
  expect(clustered.scenario?.logicLayer?.workerCreatedCount ?? 0).toBe(2);
  expect(webGpuValidationMessages).toEqual([]);
});

async function runShellScenario(
  page: Page,
  id: string,
  attachmentName: string,
  webGpuValidationMessages: readonly string[],
): Promise<PersistentRenderShellStatus> {
  const messageOffset = webGpuValidationMessages.length;
  const status = await page.evaluate(async (scenarioId) => {
    const shell = (
      globalThis as typeof globalThis & {
        readonly __APERTURE_RENDER_PROOF_SHELL__?: {
          runScenario(id: string): Promise<unknown>;
        };
      }
    ).__APERTURE_RENDER_PROOF_SHELL__;

    if (shell === undefined) {
      return {
        example: "persistent-render-shell",
        ok: false,
        phase: "missing-shell",
        reason: "missing-shell-api",
        message: "Persistent render shell API was not registered.",
      };
    }

    return shell.runScenario(scenarioId);
  }, id);
  const scenarioWarnings = webGpuValidationMessages.slice(messageOffset);

  await attachExampleStatus(attachmentName, {
    status,
    webGpuValidationMessages: scenarioWarnings,
  });
  expectStatusJsonSafeForGpu(status);
  expect(
    scenarioWarnings,
    `WebGPU validation warnings should not be emitted for shell scenario ${id}:\n${scenarioWarnings.join(
      "\n\n",
    )}`,
  ).toEqual([]);

  return status as PersistentRenderShellStatus;
}

function collectWebGpuValidationMessages(page: Page): string[] {
  const messages: string[] = [];

  page.on("console", (message: ConsoleMessage) => {
    if (isWebGpuValidationConsoleMessage(message)) {
      messages.push(message.text());
    }
  });

  return messages;
}
