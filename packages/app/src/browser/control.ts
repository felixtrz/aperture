import {
  decodeTypedArrayTree,
  encodeTypedArrayTree,
  inspectRenderSnapshot,
  type RenderSnapshotInspectionReport,
} from "@aperture-engine/render";
import {
  webGpuAppRenderReportToJsonValue,
  type WebGpuAppRenderReport,
  type WebGpuAppRenderReportJsonValue,
} from "@aperture-engine/webgpu";
import type { EcsEntityRef } from "../config.js";
import type {
  ApertureEntityFindQuery,
  ApertureEntityFindReport,
  ApertureEntityGetReport,
} from "../entity-lookup.js";
import type { CameraToolState } from "../devtools/camera.js";
import type { createAssetSummary } from "../devtools/assets.js";
import {
  ApertureBrowserControlError,
  type GeneratedBrowserRequestClient,
  type GeneratedBrowserRequestOptions,
} from "./request.js";

export interface GeneratedBrowserEntitySelector {
  readonly key?: string;
  readonly entity?: EcsEntityRef;
}

export interface GeneratedBrowserCameraSummary extends CameraToolState {
  readonly key: string | null;
  readonly name: string;
}

/** Typed core tools share the existing semantic worker bridge. Other tools use requestRaw. */
export interface GeneratedBrowserToolContracts {
  readonly ecs_query: {
    readonly payload: ApertureEntityFindQuery | undefined;
    readonly result: ApertureEntityFindReport;
  };
  readonly ecs_get_entity: {
    readonly payload: GeneratedBrowserEntitySelector;
    readonly result: ApertureEntityGetReport;
  };
  readonly ecs_pause: {
    readonly payload: undefined;
    readonly result: Readonly<Record<string, unknown>>;
  };
  readonly asset_list: {
    readonly payload: undefined;
    readonly result: { readonly assets: ReturnType<typeof createAssetSummary> };
  };
  readonly camera_list: {
    readonly payload: undefined;
    readonly result: readonly GeneratedBrowserCameraSummary[];
  };
  readonly camera_get: {
    readonly payload: GeneratedBrowserEntitySelector;
    readonly result: GeneratedBrowserCameraSummary;
  };
  readonly camera_look_at: {
    readonly payload: GeneratedBrowserEntitySelector & {
      readonly translation?: readonly [number, number, number];
      readonly lookAt: readonly [number, number, number];
    };
    readonly result: GeneratedBrowserCameraSummary;
  };
  readonly camera_set_transform: {
    readonly payload: GeneratedBrowserEntitySelector & {
      readonly translation?: readonly [number, number, number];
      readonly rotation?: readonly [number, number, number, number];
      readonly scale?: readonly [number, number, number];
    };
    readonly result: GeneratedBrowserCameraSummary;
  };
}

export interface GeneratedBrowserFrameOptions extends GeneratedBrowserRequestOptions {
  readonly deltaSeconds?: number;
  readonly timeSeconds?: number;
}

export interface GeneratedBrowserRenderedFrame {
  readonly snapshotFrame: number;
  /** Detached existing report data; excludes renderer resources and shared snapshot buffers. */
  readonly report: WebGpuAppRenderReportJsonValue;
}

export interface GeneratedBrowserFrameInspection extends RenderSnapshotInspectionReport {
  readonly frame: number;
}

export function createGeneratedBrowserFrameControl(input: {
  readonly requests: GeneratedBrowserRequestClient;
  readonly manual: boolean;
  readonly getSourceAssetVersions?: () => readonly (readonly [
    string,
    number,
  ])[];
}) {
  let disposed = false;
  let tail = Promise.resolve();
  let queued = 0;
  let lastReport: WebGpuAppRenderReport | null = null;
  const completed = new Map<number, WebGpuAppRenderReport>();
  let active: {
    requestId: string | null;
    receivedFrame: number | null;
    expectedFrame: number | null;
    resolve(frame: GeneratedBrowserRenderedFrame): void;
    reject(error: Error): void;
  } | null = null;

  const settle = (): void => {
    if (active?.expectedFrame === null || active === null) return;
    const report = completed.get(active.expectedFrame);
    if (report === undefined) return;
    completed.delete(active.expectedFrame);
    if (report.ok)
      active.resolve({
        snapshotFrame: active.expectedFrame,
        report: decodeTypedArrayTree(
          encodeTypedArrayTree(webGpuAppRenderReportToJsonValue(report)),
        ) as WebGpuAppRenderReportJsonValue,
      });
    else
      active.reject(
        new ApertureBrowserControlError(
          "Aperture failed to render the requested frame.",
          report.diagnostics,
        ),
      );
  };

  return {
    renderFrame(
      options: GeneratedBrowserFrameOptions = {},
    ): Promise<GeneratedBrowserRenderedFrame> {
      if (!input.manual)
        return Promise.reject(
          new ApertureBrowserControlError(
            'renderFrame requires render.cadence: "manual".',
          ),
        );
      if (disposed)
        return Promise.reject(
          new ApertureBrowserControlError("Aperture browser app was disposed."),
        );
      const delta = options.deltaSeconds ?? 0;
      const time = options.timeSeconds;
      const timeoutMilliseconds = options.timeoutMilliseconds ?? 10_000;
      if (
        !Number.isFinite(delta) ||
        delta < 0 ||
        (time !== undefined && (!Number.isFinite(time) || time < 0)) ||
        !Number.isFinite(timeoutMilliseconds) ||
        timeoutMilliseconds <= 0
      ) {
        return Promise.reject(
          new ApertureBrowserControlError(
            "Frame delta/time must be finite and non-negative, and timeout must be positive.",
          ),
        );
      }
      if (queued >= 16)
        return Promise.reject(
          new ApertureBrowserControlError(
            "Aperture has reached its limit of 16 queued frames.",
          ),
        );
      queued += 1;
      const next = tail
        .then(async () => {
          if (disposed)
            throw new ApertureBrowserControlError(
              "Aperture browser app was disposed.",
            );
          if (options.signal?.aborted === true)
            throw new ApertureBrowserControlError(
              "Aperture frame was aborted.",
            );
          await input.requests.ready;
          let resolve!: (frame: GeneratedBrowserRenderedFrame) => void;
          let reject!: (error: Error) => void;
          const presented = new Promise<GeneratedBrowserRenderedFrame>(
            (yes, no) => {
              resolve = yes;
              reject = no;
            },
          );
          // A worker may fail before its step response arrives. Attach a handler
          // immediately while retaining the rejection for the caller below.
          void presented.catch(() => {});
          active = {
            requestId: null,
            receivedFrame: null,
            expectedFrame: null,
            resolve,
            reject,
          };
          const abort = (): void =>
            reject(
              new ApertureBrowserControlError("Aperture frame was aborted."),
            );
          const timeout = setTimeout(
            () =>
              reject(
                new ApertureBrowserControlError(
                  "Aperture frame presentation timed out.",
                ),
              ),
            timeoutMilliseconds,
          );
          options.signal?.addEventListener("abort", abort, { once: true });
          try {
            const response = await input.requests.requestRaw(
              "ecs_step",
              {
                delta,
                ...(time === undefined ? {} : { time }),
                ...(input.getSourceAssetVersions === undefined
                  ? {}
                  : {
                      sourceAssetVersions: input.getSourceAssetVersions(),
                    }),
              },
              options,
            );
            if (!response.ok)
              throw new ApertureBrowserControlError(
                "Aperture could not step the requested frame.",
                response.diagnostics,
              );
            const frame = (
              response.result as { snapshotFrame?: unknown } | undefined
            )?.snapshotFrame;
            if (
              typeof frame !== "number" ||
              !Number.isInteger(frame) ||
              frame < 0
            )
              throw new ApertureBrowserControlError(
                "Aperture step did not identify its published snapshot frame.",
              );
            active.expectedFrame = frame;
            if (active.receivedFrame !== null && active.receivedFrame !== frame)
              throw new ApertureBrowserControlError(
                "Step response and published snapshot frame differ.",
              );
            settle();
            return await presented;
          } finally {
            active = null;
            clearTimeout(timeout);
            options.signal?.removeEventListener("abort", abort);
          }
        })
        .finally(() => {
          queued -= 1;
        });
      tail = next.then(
        () => {},
        () => {},
      );
      return next;
    },
    requested(requestId: string) {
      if (active !== null) active.requestId = requestId;
    },
    acceptSnapshot(frame: number, message: unknown): boolean {
      if (!input.manual) return true;
      const id =
        typeof message === "object" && message !== null
          ? (message as { controlledFrameRequestId?: unknown })
              .controlledFrameRequestId
          : undefined;
      if (
        active === null ||
        active.requestId === null ||
        id !== active.requestId ||
        active.receivedFrame !== null
      )
        return false;
      if (active.expectedFrame !== null && active.expectedFrame !== frame) {
        active.reject(
          new ApertureBrowserControlError(
            "Step response and published snapshot frame differ.",
          ),
        );
        return false;
      }
      active.receivedFrame = frame;
      return true;
    },
    presented(report: WebGpuAppRenderReport) {
      if (disposed) return;
      lastReport = report;
      completed.set(report.snapshot.frame, report);
      while (completed.size > 2)
        completed.delete(completed.keys().next().value!);
      settle();
    },
    failed(error: Error) {
      active?.reject(error);
    },
    inspectRenderedFrame(): GeneratedBrowserFrameInspection | null {
      if (lastReport === null) return null;
      // Export only detached inspection data, never the live asset registry,
      // worker ECS, or SAB-backed transform buffers.
      return decodeTypedArrayTree(
        encodeTypedArrayTree({
          frame: lastReport.snapshot.frame,
          ...inspectRenderSnapshot(lastReport.snapshot),
        }),
      ) as GeneratedBrowserFrameInspection;
    },
    dispose() {
      disposed = true;
      active?.reject(
        new ApertureBrowserControlError("Aperture browser app was disposed."),
      );
      completed.clear();
      lastReport = null;
    },
  };
}
