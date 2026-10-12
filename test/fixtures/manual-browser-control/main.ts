import {
  startGeneratedBrowserApp,
  type GeneratedBrowserApp,
} from "@aperture-engine/app/browser";
import config from "./config.js";

interface NativeObservation {
  readonly submissions: number;
  readonly drawCalls: number;
  readonly workerTerminationCalls: number;
  readonly workersCreated: number;
  readonly buffersCreated: number;
  readonly buffersDestroyed: number;
  readonly texturesCreated: number;
  readonly texturesDestroyed: number;
  readonly liveRequestedBufferBytes: number;
  readonly workerEvidence: readonly {
    readonly terminated: boolean;
    readonly snapshotPayloadObserved: boolean;
  }[];
}
const scope = globalThis as typeof globalThis & {
  __AGENT_NATIVE_OBSERVER__: { snapshot(): NativeObservation };
  __APERTURE_VERIFIED_GPU__: { draws: number; submissions: number };
  __APERTURE_WAIT_GPU__(): Promise<unknown>;
  __MANUAL_CONTROL_STATUS__?: unknown;
};
function requireValue(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
async function bounded<T>(
  name: string,
  operation: () => Promise<T>,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Manual validation timed out: ${name}`)),
      30_000,
    );
  });
  try {
    return await Promise.race([operation(), deadline]);
  } finally {
    clearTimeout(timer!);
  }
}
async function record(
  name: string,
  body: Blob | string,
): Promise<{ sha256: string }> {
  const response = await bounded(`record-${name}`, () =>
    fetch(`/__fixture/record/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": body instanceof Blob ? "image/png" : "application/json",
      },
      body,
    }),
  );
  requireValue(response.ok, `Recording failed for ${name}`);
  return response.json();
}
async function canvasPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return bounded(
    "canvas-png",
    () =>
      new Promise((resolve, reject) =>
        canvas.toBlob(
          (blob) =>
            blob ? resolve(blob) : reject(new Error("Canvas PNG unavailable")),
          "image/png",
        ),
      ),
  );
}

async function validate(): Promise<void> {
  let app: GeneratedBrowserApp | undefined;
  const variant = new URL(location.href).searchParams.get("transport");
  try {
    requireValue(
      variant === "transferable" || variant === "shared-array-buffer",
      "Unknown transport variant",
    );
    const observer = scope.__AGENT_NATIVE_OBSERVER__;
    requireValue(observer, "Native observer must precede the application");
    app = await bounded("bootstrap", () =>
      startGeneratedBrowserApp({
        config,
        workerEntry: new Worker(new URL("./worker.ts", import.meta.url), {
          type: "module",
        }),
      }),
    );
    await bounded("ready", () => app!.ready);
    requireValue(app.webgpu.ok, "WebGPU bootstrap failed");
    const transport = app.webgpu.app.getDiagnostics().transport.active;
    requireValue(
      transport === variant,
      `Actual snapshot transport ${transport} differs from ${variant}`,
    );
    const baseline = observer.snapshot();
    requireValue(
      baseline.drawCalls === 0 &&
        baseline.submissions === 0 &&
        scope.__APERTURE_VERIFIED_GPU__.draws === 0,
      "Manual app drew or submitted before the first frame",
    );
    requireValue(
      app.inspectRenderedFrame() === null,
      "Manual app has an implicit initial report",
    );
    const publications: {
      frame: number;
      entries: {
        id: string;
        version: number;
        kind: string;
        label: string;
        maxX?: number;
      }[];
    }[] = [];
    const unsubscribePublications = app.worker.onSnapshot((event) => {
      const message = event.message as {
        controlledFrameRequestId?: string;
        sourceAssets?: {
          entries: {
            handle: { id: string };
            version: number;
            asset: {
              kind: string;
              label: string;
              localAabb?: { max: number[] };
            } | null;
          }[];
        };
      };
      if (message.controlledFrameRequestId === undefined) return;
      publications.push({
        frame: event.frame,
        entries: (message.sourceAssets?.entries ?? []).map((entry) => ({
          id: entry.handle.id,
          version: entry.version,
          kind: entry.asset?.kind ?? "none",
          label: entry.asset?.label ?? "",
          ...(entry.asset?.localAabb
            ? { maxX: entry.asset.localAabb.max[0] }
            : {}),
        })),
      });
    });
    const camera = await app.request("camera_look_at", {
      key: "camera.main",
      translation: [4, 3, 6],
      lookAt: [0, 0.6, 0],
    });
    requireValue(
      camera.key === "camera.main",
      "Typed camera operation targeted another entity",
    );
    const queried = await app.request("ecs_query", { key: "prop" });
    requireValue(
      queried.total === 1,
      "Typed entity query missed the authored prop",
    );
    const frames = [],
      captures: { sha256: string }[] = [];
    for (const frame of [0, 1, 2]) {
      if (frame === 2) {
        const changed = await app.requestRaw("resource_set", {
          id: "validation.manual.revision",
          values: { revision: 1 },
        });
        requireValue(changed.ok, "Worker resource edit failed");
      }
      const before = observer.snapshot();
      const rendered = await bounded(`frame-${frame}`, () =>
        app!.renderFrame({
          deltaSeconds: 0,
          timeSeconds: 0,
          timeoutMilliseconds: 30_000,
        }),
      );
      requireValue(
        rendered.snapshotFrame === frame && rendered.report.ok,
        "Controlled frame used another snapshot identity or failed",
      );
      await bounded(`frame-${frame}-native-completion`, () =>
        scope.__APERTURE_WAIT_GPU__(),
      );
      const after = observer.snapshot();
      requireValue(
        after.drawCalls > before.drawCalls &&
          after.submissions > before.submissions,
        "Controlled frame has no native submitted draws",
      );
      const inspection = app.inspectRenderedFrame()!;
      requireValue(
        inspection.frame === frame &&
          inspection.counts.meshDraws === 2 &&
          inspection.handles.meshKeys.includes("mesh:prop.mesh"),
        "Inspection differs from actual authored packets",
      );
      const saved = JSON.parse(JSON.stringify(inspection));
      (inspection.counts as { meshDraws: number }).meshDraws = -999;
      (inspection.handles.meshKeys as string[]).splice(0);
      requireValue(
        JSON.stringify(app.inspectRenderedFrame()) === JSON.stringify(saved),
        "Inspection exposes live mutable renderer state",
      );
      frames.push({
        snapshotFrame: rendered.snapshotFrame,
        report: rendered.report,
        inspection: saved,
        nativeSubmissions: after.submissions - before.submissions,
        nativeDrawCalls: after.drawCalls - before.drawCalls,
      });
      captures.push(
        await record(
          `${["baseline", "unchanged", "updated"][frame]}.png`,
          await canvasPng(document.querySelector<HTMLCanvasElement>("#scene")!),
        ),
      );
    }
    requireValue(
      captures[0]!.sha256 === captures[1]!.sha256,
      "Zero-delta unchanged scene pixels drifted",
    );
    requireValue(
      captures[0]!.sha256 !== captures[2]!.sha256,
      "Worker geometry/material edit did not change canvas pixels",
    );
    requireValue(
      publications.length === 3 && publications[1]!.entries.length === 0,
      "Unchanged controlled frame recopied source assets",
    );
    const firstMesh = publications[0]!.entries.find(
      (entry) => entry.id === "prop.mesh",
    )!;
    const updatedMesh = publications[2]!.entries.find(
      (entry) => entry.id === "prop.mesh",
    )!;
    const updatedMaterial = publications[2]!.entries.find(
      (entry) => entry.id === "prop.material",
    )!;
    requireValue(
      firstMesh.version === 1 &&
        updatedMesh.version === 2 &&
        updatedMaterial.version === 2 &&
        Math.abs(firstMesh.maxX! - 0.7) < 1e-5 &&
        Math.abs(updatedMesh.maxX! - 1.2) < 1e-5,
      "Actual worker source deltas omitted the authored geometry/material revisions",
    );
    unsubscribePublications();
    const assets = await app.request("asset_list");
    const priorDisposal = observer.snapshot();
    await bounded("dispose", () => app!.dispose());
    await app.dispose();
    const disposed = observer.snapshot();
    requireValue(
      disposed.workerTerminationCalls ===
        priorDisposal.workerTerminationCalls + 1 &&
        disposed.workersCreated === 1 &&
        disposed.workerEvidence.every(
          (worker) => worker.terminated && worker.snapshotPayloadObserved,
        ),
      "Disposal did not terminate the actual snapshot-producing worker exactly once",
    );
    // This fixture creates no caller-owned GPU resources: every observed device
    // buffer/texture allocation belongs to the renderer, including IBL and bloom.
    requireValue(
      disposed.buffersCreated > 0 &&
        disposed.texturesCreated > 0 &&
        disposed.buffersDestroyed === disposed.buffersCreated &&
        disposed.texturesDestroyed === disposed.texturesCreated &&
        disposed.liveRequestedBufferBytes === 0,
      "Disposal left app-owned native buffers/textures alive",
    );
    let frameRejected = false;
    try {
      await app.renderFrame();
    } catch {
      frameRejected = true;
    }
    requireValue(frameRejected, "Disposed app accepted another frame");
    const status = {
      schema: "aperture.native-manual-browser-control.v1",
      ok: true,
      transport,
      crossOriginIsolated,
      baseline,
      frames,
      captures,
      assets,
      publications,
      detachedInspection: true,
      disposed,
      checks: [
        "zero-initial-draws",
        "typed-worker-requests",
        "published-frame-progression",
        "native-submitted-draws",
        "unchanged-pixel-parity",
        "updated-source-pixel-change",
        "detached-inspection",
        "worker-disposal",
        "owned-gpu-release",
      ],
    };
    await record("validation.json", JSON.stringify(status, null, 2));
    scope.__MANUAL_CONTROL_STATUS__ = status;
  } catch (error) {
    await app?.dispose().catch(() => {});
    const status = {
      schema: "aperture.native-manual-browser-control.v1",
      ok: false,
      transport: variant,
      error:
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : String(error),
    };
    await record("failure.json", JSON.stringify(status, null, 2)).catch(
      () => {},
    );
    scope.__MANUAL_CONTROL_STATUS__ = status;
  }
}
void validate();
