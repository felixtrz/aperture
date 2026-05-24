import { expect, type Page } from "@playwright/test";

import type { ExampleStatusBase } from "./example-status-types.js";
import {
  attachExampleStatus,
  expectStatusJsonSafeForGpu,
  isWebGpuValidationConsoleMessage,
  skipIfUnsupportedWebGpu,
  waitForExampleStatus,
} from "./webgpu-status.js";

export interface PersistentExampleRouteProof<T extends ExampleStatusBase> {
  readonly routeIndex: number;
  readonly url: string;
  readonly finalUrl: string;
  readonly attachmentName: string;
  readonly elapsedMs: number;
  readonly frame: number | null;
  readonly status: T | undefined;
  readonly readbackStatus: unknown;
  readonly readback: unknown;
  readonly webGpuValidationMessages: readonly string[];
}

export interface PersistentExampleRouteOptions {
  readonly url: string;
  readonly attachmentName: string;
}

export interface PersistentExampleRouteHarness {
  readonly messages: readonly string[];
  run<T extends ExampleStatusBase>(
    options: PersistentExampleRouteOptions,
  ): Promise<PersistentExampleRouteProof<T>>;
}

export function createPersistentExampleRouteHarness(
  page: Page,
): PersistentExampleRouteHarness {
  const messages: string[] = [];
  let routeIndex = 0;

  page.on("console", (message) => {
    if (isWebGpuValidationConsoleMessage(message)) {
      messages.push(message.text());
    }
  });

  return {
    messages,
    run: async <T extends ExampleStatusBase>({
      url,
      attachmentName,
    }: PersistentExampleRouteOptions): Promise<
      PersistentExampleRouteProof<T>
    > => {
      await page.goto("about:blank");

      routeIndex += 1;
      const messageOffset = messages.length;
      const startedAt = Date.now();

      await page.goto(url);

      const status = await waitForExampleStatus<T>(page);
      const elapsedMs = Date.now() - startedAt;
      const routeMessages = messages.slice(messageOffset);
      const proof: PersistentExampleRouteProof<T> = {
        routeIndex,
        url,
        finalUrl: page.url(),
        attachmentName,
        elapsedMs,
        frame: frameFromExampleStatus(status),
        status,
        readbackStatus: statusSection(status, "readbackStatus"),
        readback: statusSection(status, "readback"),
        webGpuValidationMessages: routeMessages,
      };

      await attachExampleStatus(attachmentName, proof);

      expect(status, `${attachmentName} status should publish`).toBeDefined();

      if (status !== undefined) {
        skipIfUnsupportedWebGpu(status);
        expectStatusJsonSafeForGpu(status);
      }

      expect(
        routeMessages,
        `WebGPU validation warnings should not be emitted for ${url}:\n${routeMessages.join(
          "\n\n",
        )}`,
      ).toEqual([]);

      return proof;
    },
  };
}

function frameFromExampleStatus(status: unknown): number | null {
  const topLevelFrame = numberStatusPath(status, ["frame"]);
  const workerStepFrame = numberStatusPath(status, ["worker", "step", "frame"]);
  const receivedSnapshots = numberStatusPath(status, [
    "worker",
    "receivedSnapshots",
  ]);
  const pressureHistoryFrame = numberStatusPath(status, [
    "clusterPressureHistoryStatus",
    "lastFrame",
  ]);

  return (
    topLevelFrame ??
    workerStepFrame ??
    receivedSnapshots ??
    pressureHistoryFrame ??
    null
  );
}

function statusSection(status: unknown, key: string): unknown {
  return isRecord(status) ? status[key] : undefined;
}

function numberStatusPath(
  status: unknown,
  path: readonly string[],
): number | null {
  let value = status;

  for (const key of path) {
    if (!isRecord(value)) {
      return null;
    }

    value = value[key];
  }

  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}
