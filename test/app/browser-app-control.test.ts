import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AssetRegistry,
  createMeshHandle,
  assetHandleKey,
} from "@aperture-engine/simulation";
import {
  SIMULATION_WORKER_PROTOCOL,
  type SimulationWorker,
  type SimulationWorkerSnapshotEvent,
} from "@aperture-engine/runtime";
import type {
  CreateWebGpuAppOptions,
  WebGpuAppRenderReport,
} from "@aperture-engine/webgpu";
import type { RenderSnapshot } from "@aperture-engine/render";
import { createPlaneMeshAsset } from "@aperture-engine/render";
import {
  createApertureDevtoolsResponse,
  type ApertureDevtoolsRequest,
} from "@aperture-engine/app/commands";
import { serializeSourceAssetRegistry } from "@aperture-engine/app/asset-mirror";
import { startGeneratedBrowserApp } from "@aperture-engine/app/browser";

const mocked = vi.hoisted(() => ({
  worker: null as SimulationWorker | null,
  createRenderer: vi.fn(),
}));
vi.mock("@aperture-engine/runtime", async (original) => ({
  ...(await original<object>()),
  createSimulationWorker: () => mocked.worker,
}));
vi.mock("@aperture-engine/webgpu", async (original) => ({
  ...(await original<object>()),
  createWebGpuApp: mocked.createRenderer,
}));

class Canvas extends EventTarget {
  width = 0;
  height = 0;
  clientWidth = 1024;
  clientHeight = 768;
  tabIndex = 0;
  hasAttribute() {
    return true;
  }
  getBoundingClientRect() {
    return { width: 1024, height: 768 };
  }
}

function snapshot(frame: number): RenderSnapshot {
  return {
    frame,
    views: [],
    meshDraws: [],
    lights: [],
    environments: [],
    shadowRequests: [],
    runtimeUniforms: [],
    bounds: [],
    diagnostics: [],
    transforms: new Float32Array(0),
    viewMatrices: new Float32Array(0),
    report: {
      views: 0,
      meshDraws: 0,
      lights: 0,
      environments: 0,
      shadowRequests: 0,
      bounds: 0,
      diagnostics: 0,
    },
  };
}

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("generated browser app control composition", () => {
  it("keeps boot and duplicate snapshots out of manual rendering and mirrors exactly the requested asset version", async () => {
    vi.useFakeTimers();
    const canvas = new Canvas();
    const window = Object.assign(new EventTarget(), {
      devicePixelRatio: 1,
      location: { search: "" },
    });
    const document = Object.assign(new EventTarget(), {
      querySelector: () => canvas,
      visibilityState: "visible",
    });
    const raf = vi.fn<(callback: FrameRequestCallback) => number>(() => 1);
    vi.stubGlobal("HTMLCanvasElement", Canvas);
    vi.stubGlobal("window", window);
    vi.stubGlobal("document", document);
    vi.stubGlobal("navigator", { getGamepads: () => [] });
    vi.stubGlobal("requestAnimationFrame", raf);
    vi.stubGlobal("ResizeObserver", undefined);
    const messages = new Set<(message: unknown) => void>();
    const snapshots = new Set<(event: SimulationWorkerSnapshotEvent) => void>();
    const errors = new Set<Parameters<SimulationWorker["onError"]>[0]>();
    const source = new AssetRegistry();
    const mesh = createMeshHandle("controlled.mesh");
    source.register(mesh, { label: "Controlled mesh" });
    const publish = (frame: number, requestId?: string): void => {
      source.markReady(
        mesh,
        createPlaneMeshAsset({
          width: source.get(mesh)!.version + 1,
          label: `Version ${source.get(mesh)!.version + 1}`,
        }),
      );
      const current = snapshot(frame);
      const message = {
        type: SIMULATION_WORKER_PROTOCOL.snapshot,
        frame,
        snapshot: current,
        sourceAssets: serializeSourceAssetRegistry(source),
        ...(requestId === undefined
          ? {}
          : { controlledFrameRequestId: requestId }),
      };
      for (const callback of snapshots)
        callback({ frame, snapshot: current, message });
    };
    const worker: SimulationWorker = {
      worker: { postMessage() {}, terminate() {} },
      start: vi.fn(() => {
        for (const callback of messages)
          callback({ type: SIMULATION_WORKER_PROTOCOL.ready });
        publish(0); // Unsolicited initial assets cannot fulfill or render a frame.
      }),
      postMessage: vi.fn((message) => {
        const request = message as ApertureDevtoolsRequest;
        if (request.tool === "ecs_query") {
          for (const callback of messages)
            callback(
              createApertureDevtoolsResponse({
                requestId: request.requestId,
                ok: true,
                result: {
                  summaries: [],
                  total: 0,
                  truncated: false,
                  diagnostics: [],
                },
              }),
            );
          return;
        }
        if (request.tool === "camera_get") {
          for (const callback of messages)
            callback(
              createApertureDevtoolsResponse({
                requestId: request.requestId,
                ok: false,
                diagnostics: [
                  { code: "camera.missing", message: "No matching camera" },
                ],
              }),
            );
          return;
        }
        if (request.tool !== "ecs_step") return;
        publish(0, request.requestId);
        publish(0, request.requestId); // Same-frame loader duplicate must not replace the accepted mirror.
        for (const callback of messages)
          callback(
            createApertureDevtoolsResponse({
              requestId: request.requestId,
              ok: true,
              result: { frame: 1, snapshotFrame: 0 },
            }),
          );
      }),
      onMessage(callback) {
        messages.add(callback);
        return () => {
          messages.delete(callback);
        };
      },
      onSnapshot(callback) {
        snapshots.add(callback);
        return () => {
          snapshots.delete(callback);
        };
      },
      onError(callback) {
        errors.add(callback);
        return () => {
          errors.delete(callback);
        };
      },
      terminate: vi.fn(() => {
        messages.clear();
        snapshots.clear();
        errors.clear();
      }),
    };
    mocked.worker = worker;
    let rendererOptions!: CreateWebGpuAppOptions;
    let mirrorLabel: unknown;
    const rendered: number[] = [];
    const geometryResult = Object.freeze({
      status: "unavailable",
      scope: "submitted-static-triangle-meshes",
      frame: null,
      submissionSerial: null,
      meshes: [],
      draws: [],
      omissions: [
        { reason: "no-submitted-frame", message: "No frame submitted." },
      ],
      copiedBytes: 0,
      retainedBytes: 0,
      excludedScopes: [
        "shadow-only-draws",
        "sky-and-fullscreen",
        "sprites-ui-text-particles",
        "shader-displacement-and-fragment-visibility",
      ],
    });
    const inspectGeometry = vi.fn(() => geometryResult);
    const disposeRenderer = vi.fn(async () => {});
    let unsubscribe: (() => void) | undefined;
    mocked.createRenderer.mockImplementation(
      async (options: CreateWebGpuAppOptions) => {
        rendererOptions = options;
        return {
          ok: true,
          initialization: {},
          app: {
            start() {
              unsubscribe = options.simulationWorker.onSnapshot((event) => {
                rendered.push(event.frame);
                mirrorLabel = (
                  options.sourceAssets!.get(mesh)!.asset as { label: string }
                ).label;
                options.onPresentationComplete?.({
                  ok: true,
                  frame: event.frame,
                  snapshot: event.snapshot,
                  counts: {},
                  diagnostics: [],
                  resourceReuse: {},
                  pipeline: null,
                  resources: null,
                  boundary: null,
                } as unknown as WebGpuAppRenderReport);
              });
              options.simulationWorker.start(options.workerStartOptions);
            },
            getDiagnostics() {
              return { lastFrame: null };
            },
            inspectRenderedGeometry: inspectGeometry,
            async dispose() {
              unsubscribe?.();
              await disposeRenderer();
            },
          },
        };
      },
    );
    const app = await startGeneratedBrowserApp({
      config: {
        mode: "browser",
        canvas: "#scene",
        render: {
          cadence: "manual",
          defaultEnvironment: false,
          geometryInspection: { maxRetainedBytes: 4096 },
        },
      },
      workerEntry: "unused-worker.js",
    });
    await app.ready;
    expect(rendererOptions.geometryInspection).toEqual({
      maxRetainedBytes: 4096,
    });
    const geometryOptions = { maxBytes: 1024 };
    expect(app.inspectRenderedGeometry(geometryOptions)).toBe(geometryResult);
    expect(inspectGeometry).toHaveBeenCalledWith(geometryOptions);
    expect(rendererOptions.presentationCadence).toBe("immediate");
    expect(rendererOptions.workerStartOptions?.simulationPaused).toBe(true);
    expect(rendererOptions.workerStartOptions?.apertureManualFrameControl).toBe(
      true,
    );
    expect(rendered).toEqual([]);
    expect(rendererOptions.sourceAssets!.list()).toEqual([]);
    expect(raf).not.toHaveBeenCalled();
    const entities = await app.request("ecs_query", { tags: ["editable"] });
    expect(entities.total).toBe(0);
    await expect(
      app.request("camera_get", { key: "missing" }),
    ).rejects.toMatchObject({
      diagnostics: [{ code: "camera.missing", message: "No matching camera" }],
    });
    await expect(app.requestRaw("ecs_step")).rejects.toThrow("use renderFrame");
    await expect(app.requestRaw("ecs_resume")).rejects.toThrow(
      "use renderFrame",
    );
    const frame = await app.renderFrame();
    expect(frame.snapshotFrame).toBe(0);
    expect(rendered).toEqual([0]);
    expect(mirrorLabel).toBe("Version 2");
    expect(
      (rendererOptions.sourceAssets!.get(mesh)!.asset as { label: string })
        .label,
    ).toBe("Version 2");
    expect(raf).not.toHaveBeenCalled();
    await app.renderFrame();
    const steps = vi
      .mocked(worker.postMessage)
      .mock.calls.map(([message]) => message as ApertureDevtoolsRequest)
      .filter((request) => request.tool === "ecs_step");
    expect(steps[0]?.payload).toMatchObject({ sourceAssetVersions: [] });
    expect(steps[1]?.payload).toMatchObject({
      sourceAssetVersions: [[assetHandleKey(mesh), 2]],
    });
    await app.dispose();
    await app.dispose();
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(disposeRenderer).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    const forwarded = vi.mocked(worker.postMessage).mock.calls.length;
    window.dispatchEvent(new Event("resize"));
    window.dispatchEvent(new Event("blur"));
    expect(worker.postMessage).toHaveBeenCalledTimes(forwarded);

    // Demand mode can be disposed while its first step and input poll are queued.
    const queued: FrameRequestCallback[] = [];
    raf.mockImplementation((callback: FrameRequestCallback) => {
      queued.push(callback);
      return queued.length;
    });
    const cancelRaf = vi.fn();
    vi.stubGlobal("cancelAnimationFrame", cancelRaf);
    const demand = await startGeneratedBrowserApp({
      config: {
        mode: "browser",
        canvas: "#scene",
        render: { cadence: "demand", defaultEnvironment: false },
      },
      workerEntry: "unused-worker.js",
    });
    await demand.ready;
    expect(queued.length).toBeGreaterThan(0);
    await demand.dispose();
    const afterDispose = vi.mocked(worker.postMessage).mock.calls.length;
    for (const callback of queued) callback(0);
    expect(worker.postMessage).toHaveBeenCalledTimes(afterDispose);
    expect(cancelRaf).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
