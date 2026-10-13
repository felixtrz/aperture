import {
  startGeneratedBrowserApp,
  type GeneratedBrowserApp,
} from "@aperture-engine/app/browser";
import config from "./config.js";

interface NativeObservation {
  readonly submissions: number;
  readonly drawCalls: number;
  readonly workersCreated: number;
  readonly workerTerminationCalls: number;
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
  try {
    return await Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Camera diagnostic deadline: ${name}`)),
          30000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer!);
  }
}
async function record(
  name: string,
  body: Blob | string,
): Promise<{ sha256: string; bytes: number; path: string }> {
  const response = await bounded(`record-${name}`, () =>
    fetch(`/__fixture/record/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": body instanceof Blob ? "image/png" : "application/json",
      },
      body,
    }),
  );
  requireValue(response.ok, `Recorder rejected ${name}`);
  return response.json();
}
async function canvasPng(): Promise<Blob> {
  const canvas = document.querySelector<HTMLCanvasElement>("#scene")!;
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
  try {
    const observer = scope.__AGENT_NATIVE_OBSERVER__;
    requireValue(observer, "Approved observer must precede the scene");
    app = await bounded("bootstrap", () =>
      startGeneratedBrowserApp({
        config,
        workerEntry: new Worker(new URL("./worker.ts", import.meta.url), {
          type: "module",
        }),
      }),
    );
    await bounded("ready", () => app!.ready);
    requireValue(app.webgpu.ok, "WebGPU initialization failed");
    const transport = app.webgpu.app.getDiagnostics().transport.active;
    requireValue(
      transport === "transferable",
      "Expected default nonisolated transferable transport",
    );
    const initial = observer.snapshot();
    requireValue(
      initial.drawCalls === 0 &&
        initial.submissions === 0 &&
        scope.__APERTURE_VERIFIED_GPU__.draws === 0,
      "Manual fixture submitted before a requested frame",
    );
    const snapshots = new Map<
      number,
      { frame: number; matrix: number[]; meshDraws: number }
    >();
    const unsubscribe = app.worker.onSnapshot((event) => {
      if (
        !(event.message as { controlledFrameRequestId?: string })
          .controlledFrameRequestId
      )
        return;
      const view = event.snapshot.views[0];
      requireValue(view, "Controlled actual snapshot has no camera view");
      snapshots.set(event.frame, {
        frame: event.frame,
        meshDraws: event.snapshot.meshDraws.length,
        matrix: Array.from(
          event.snapshot.viewMatrices.slice(
            view.viewProjectionMatrixOffset,
            view.viewProjectionMatrixOffset + 16,
          ),
        ),
      });
    });
    const frames: unknown[] = [];
    const captures: { sha256: string; bytes: number; path: string }[] = [];
    const matrices: number[][] = [];
    const capture = async (expectedFrame: number, name: string) => {
      const before = observer.snapshot();
      const rendered = await bounded(`frame-${expectedFrame}`, () =>
        app!.renderFrame({ deltaSeconds: 0, timeSeconds: 0 }),
      );
      await bounded("native-completion", () => scope.__APERTURE_WAIT_GPU__());
      const snapshot = snapshots.get(rendered.snapshotFrame);
      const after = observer.snapshot();
      requireValue(
        rendered.snapshotFrame === expectedFrame &&
          rendered.report.ok &&
          snapshot?.frame === expectedFrame,
        "Next rendered frame did not use the matching actual worker extraction",
      );
      requireValue(
        snapshot.meshDraws === 3 &&
          snapshot.matrix.length === 16 &&
          snapshot.matrix.every(Number.isFinite),
        "Actual snapshot source geometry/camera matrix is invalid",
      );
      requireValue(
        after.drawCalls > before.drawCalls &&
          after.submissions > before.submissions,
        "Requested frame had no native draw/submission",
      );
      const camera = await app!.request("camera_get", { key: "camera.main" });
      matrices.push(snapshot.matrix);
      frames.push({
        snapshotFrame: rendered.snapshotFrame,
        snapshot,
        camera,
        nativeDrawCalls: after.drawCalls - before.drawCalls,
        nativeSubmissions: after.submissions - before.submissions,
      });
      captures.push(await record(name, await canvasPng()));
      return camera;
    };
    await capture(0, "baseline.png");
    const mutation = await app.request("camera_set_projection", {
      key: "camera.main",
      projection: "perspective",
      fovYDegrees: 35,
      near: 1,
      far: 60,
    });
    requireValue(
      mutation.camera["near"] === 1 &&
        mutation.camera["far"] === 60 &&
        mutation.camera["fovYRadians"] === Math.fround((35 * Math.PI) / 180),
      "Semantic projection readback differs",
    );
    const projected = await capture(1, "updated.png");
    const malformed = await app.requestRaw("camera_set_projection", {
      key: "camera.main",
      fovYDegrees: 45,
      fovYRadians: 1,
    });
    requireValue(
      !malformed.ok &&
        (malformed.diagnostics as { code: string }[]).some(
          (d) => d.code === "aperture.camera.projection.invalidPayload",
        ),
      "Malformed projection did not return the original actionable diagnostic",
    );
    requireValue(
      JSON.stringify(
        await app.request("camera_get", { key: "camera.main" }),
      ) === JSON.stringify(projected),
      "Malformed projection changed ECS camera/transform state",
    );
    let precision: { message: string; diagnostics: unknown } | undefined;
    try {
      await app.request("camera_set_projection", {
        key: "camera.main",
        fovYDegrees: 45,
        far: 1e40,
      });
    } catch (error) {
      requireValue(
        error instanceof Error,
        "Unexpected projection rejection type",
      );
      precision = {
        message: error.message,
        diagnostics: (error as Error & { diagnostics: unknown }).diagnostics,
      };
    }
    requireValue(
      precision &&
        (precision.diagnostics as { code: string }[]).some(
          (d) => d.code === "aperture.camera.projection.precisionLoss",
        ),
      "Float32-invalid projection was not rejected with precision diagnostics",
    );
    requireValue(
      JSON.stringify(
        await app.request("camera_get", { key: "camera.main" }),
      ) === JSON.stringify(projected),
      "Float32-invalid projection partially wrote the otherwise valid FOV field",
    );
    const rejected = await capture(2, "unchanged.png");
    requireValue(
      JSON.stringify(rejected) === JSON.stringify(projected),
      "Rejected patches changed subsequent camera readback",
    );
    requireValue(
      JSON.stringify(matrices[0]) !== JSON.stringify(matrices[1]) &&
        JSON.stringify(matrices[1]) === JSON.stringify(matrices[2]),
      "Actual next snapshot failed projection change/atomic rejection parity",
    );
    requireValue(
      captures[0]!.sha256 !== captures[1]!.sha256 &&
        captures[1]!.sha256 === captures[2]!.sha256,
      "Actual canvas framing failed change/rejected-patch pixel parity",
    );
    unsubscribe();
    await bounded("dispose", () => app!.dispose());
    const disposed = observer.snapshot();
    requireValue(
      disposed.workersCreated === 1 &&
        disposed.workerTerminationCalls === 1 &&
        disposed.workerEvidence.every(
          (worker) => worker.terminated && worker.snapshotPayloadObserved,
        ),
      "Normal snapshot-producing native worker was not observed and disposed once",
    );
    const status = {
      schema: "aperture.native-camera-projection.v1",
      ok: true,
      transport,
      initial,
      frames,
      captures,
      mutation,
      malformed,
      precision,
      disposed,
      checks: [
        "normal-worker-ECS-extraction",
        "degree-FOV-readback",
        "next-rendered-snapshot",
        "native-framing-change",
        "malformed-atomic-rejection",
        "Float32-atomic-rejection",
        "rejected-pixel-parity",
        "worker-disposal",
      ],
    };
    await record("validation.json", JSON.stringify(status));
    scope.__MANUAL_CONTROL_STATUS__ = status;
  } catch (error) {
    await app?.dispose().catch(() => {});
    const status = {
      schema: "aperture.native-camera-projection.v1",
      ok: false,
      transport: "transferable",
      error:
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : String(error),
    };
    await record("failure.json", JSON.stringify(status)).catch(() => {});
    scope.__MANUAL_CONTROL_STATUS__ = status;
  }
}
void validate();
