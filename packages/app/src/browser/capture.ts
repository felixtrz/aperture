import type { SimulationWorker } from "@aperture-engine/runtime";
import type { AssetRegistry } from "@aperture-engine/simulation";
import type { RenderSnapshot } from "@aperture-engine/render";
import type { WebGpuApp, WebGpuCapturedFrame } from "@aperture-engine/webgpu";
import {
  createApertureDevtoolsRequest,
  isApertureDevtoolsResponse,
} from "../commands.js";
import { mirrorSourceAssetRegistryFromMessage } from "../asset-mirror.js";

export const APERTURE_GENERATED_CAPTURE_GLOBAL = "__APERTURE_CAPTURE__";
export const APERTURE_STILL_CAPTURE_GLOBAL = "__APERTURE_STILL_CAPTURE__";
const READY_EVENT = "aperture:capture-ready";

export interface GeneratedFrameCaptureOptions {
  /** One explicit simulation step. Defaults to zero; no wall-clock advance. */
  readonly delta?: number;
  /** Explicit application time in seconds. Defaults to current simulation time. */
  readonly time?: number;
  readonly timeoutMs?: number;
}

export interface GeneratedCapturedFrame extends Omit<
  WebGpuCapturedFrame,
  "release"
> {
  /** Restores prior simulation cadence and presentation. Always await in finally. */
  release(): Promise<void>;
}

export interface GeneratedFrameCaptureController {
  captureFrame(
    options?: GeneratedFrameCaptureOptions,
  ): Promise<GeneratedCapturedFrame>;
}

/** Await generated-app startup, then select and hold one GPU-complete frame. */
export async function captureGeneratedFrame(
  options: GeneratedFrameCaptureOptions = {},
): Promise<GeneratedCapturedFrame> {
  const timeoutMs = captureTimeout(options);
  const scope = globalThis as Record<string, unknown>;
  const read = (): GeneratedFrameCaptureController | undefined =>
    scope[APERTURE_GENERATED_CAPTURE_GLOBAL] as
      | GeneratedFrameCaptureController
      | undefined;
  const controller =
    read() ??
    (await new Promise<GeneratedFrameCaptureController>((resolve, reject) => {
      const ready = (): void => {
        const current = read();
        if (current !== undefined) {
          cleanup();
          resolve(current);
        }
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("Generated app capture did not become ready."));
      }, timeoutMs);
      const cleanup = (): void => {
        clearTimeout(timer);
        globalThis.removeEventListener(READY_EVENT, ready);
      };
      globalThis.addEventListener(READY_EVENT, ready);
      ready();
    }));
  return controller.captureFrame(options);
}

export function createGeneratedFrameCaptureController(input: {
  readonly app: WebGpuApp;
  readonly worker: SimulationWorker;
  readonly sourceAssets: AssetRegistry;
  readonly onHoldChanged?: (held: boolean) => void;
}): GeneratedFrameCaptureController {
  let held = false;
  let nextId = 0;
  const id = (): string => `capture-${Date.now()}-${++nextId}`;
  const request = (
    tool: string,
    payload: unknown,
    requestId: string,
    timeoutMs: number,
  ): Promise<unknown> =>
    new Promise((resolve, reject) => {
      let offMessage = (): void => {};
      let offError = (): void => {};
      const cleanup = (): void => {
        clearTimeout(timer);
        offMessage();
        offError();
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Capture request '${tool}' timed out.`));
      }, timeoutMs);
      offError = input.worker.onError((error) => {
        cleanup();
        reject(new Error(error.message));
      });
      offMessage = input.worker.onMessage((message) => {
        if (
          !isApertureDevtoolsResponse(message) ||
          message.requestId !== requestId
        )
          return;
        cleanup();
        if (message.ok) resolve(message.result);
        else
          reject(
            new Error(
              `Capture request '${tool}' failed: ${JSON.stringify(message.diagnostics)}`,
            ),
          );
      });
      try {
        input.worker.postMessage(
          createApertureDevtoolsRequest({ tool, payload, requestId }),
        );
      } catch (error) {
        cleanup();
        reject(error);
      }
    });
  return {
    async captureFrame(options = {}) {
      const timeoutMs = captureTimeout(options);
      if (held)
        throw new Error("Release the captured frame before capturing another.");
      held = true;
      input.onHoldChanged?.(true);
      const token = id();
      let frame: WebGpuCapturedFrame | undefined;
      let releasePromise: Promise<void> | undefined;
      const release = (): Promise<void> =>
        (releasePromise ??= (async () => {
          try {
            await request("render_capture_release", { token }, id(), timeoutMs);
          } finally {
            frame?.release();
            held = false;
            input.onHoldChanged?.(false);
          }
        })());
      try {
        const selected = request(
          "render_capture_snapshot",
          {
            delta: options.delta ?? 0,
            ...(options.time === undefined ? {} : { time: options.time }),
          },
          token,
          timeoutMs,
        ).then((value) => {
          if (
            value === null ||
            typeof value !== "object" ||
            !("snapshot" in value)
          )
            throw new Error("Capture worker returned no snapshot.");
          mirrorSourceAssetRegistryFromMessage(input.sourceAssets, value);
          return value.snapshot as RenderSnapshot;
        });
        // The renderer may reject immediately (for example after disposal),
        // before it observes the pending worker selection.
        void selected.catch(() => {});
        frame = await input.app.captureSnapshot(selected);
        return { ...frame, release };
      } catch (error) {
        try {
          await release();
        } catch (cleanupError) {
          throw new AggregateError(
            [error, cleanupError],
            "Capture and release failed.",
            { cause: cleanupError },
          );
        }
        throw error;
      }
    },
  };
}

export function installGeneratedFrameCaptureController(
  controller: GeneratedFrameCaptureController,
): void {
  (globalThis as Record<string, unknown>)[APERTURE_GENERATED_CAPTURE_GLOBAL] =
    controller;
  globalThis.dispatchEvent(new Event(READY_EVENT));
}

function captureTimeout(options: GeneratedFrameCaptureOptions): number {
  const timeout = options.timeoutMs ?? 120000;
  if (!Number.isFinite(timeout) || timeout <= 0)
    throw new Error("Capture timeout must be positive and finite.");
  if (
    options.delta !== undefined &&
    (!Number.isFinite(options.delta) || options.delta < 0)
  )
    throw new Error("Capture delta must be finite and nonnegative.");
  if (options.time !== undefined && !Number.isFinite(options.time))
    throw new Error("Capture time must be finite.");
  return timeout;
}
