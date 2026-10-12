import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SIMULATION_WORKER_PROTOCOL,
  type SimulationWorker,
  type SimulationWorkerErrorCallback,
  type SimulationWorkerErrorMessage,
} from "@aperture-engine/runtime";
import { AssetRegistry } from "@aperture-engine/simulation";
import { createSystem } from "@aperture-engine/app/systems";
import { defineApertureConfig } from "@aperture-engine/app/config";
import {
  createApertureApp,
  disposeApertureApp,
  type ApertureApp,
} from "@aperture-engine/app/advanced";
import { createApertureHeadlessFailureStatus } from "@aperture-engine/app/headless";
import {
  createApertureDevtoolsRequest,
  type ApertureDevtoolsResponse,
} from "@aperture-engine/app/commands";
import {
  APERTURE_DIAGNOSTIC_ERROR_LIMITS,
  errorToApertureDiagnostic,
  normalizeApertureDiagnostic,
  type ApertureGeneratedDiagnostic,
} from "../../packages/app/src/diagnostics.js";
import { runGeneratedWorkerLoop } from "../../packages/app/src/worker/loop.js";
import type { GeneratedDevtoolsBridge } from "../../packages/app/src/worker/devtools/bridge.js";
import { createGeneratedEntityToolBridge } from "../../packages/app/src/devtools/entities.js";
import { mirrorSimulationWorkerSourceAssets } from "../../packages/app/src/browser/assets.js";
import {
  APERTURE_GENERATED_STATUS_GLOBAL,
  installGeneratedStatus,
} from "../../packages/app/src/browser/status.js";
import { TestGeneratedWorkerPort } from "../helpers/generated-worker-port.js";

function brokenAuthoringStep(): readonly number[] {
  return (undefined as unknown as { position: readonly number[] }).position;
}

class BrokenSceneSystem extends createSystem() {
  override update(): void {
    brokenAuthoringStep();
  }
}

const fallback = {
  code: "aperture.generatedWorker.failed",
  message: "Worker failed",
  suggestedFix: "Inspect the reported system",
};

afterEach(() => vi.unstubAllGlobals());

describe("lifecycle diagnostics preserve original error attribution", () => {
  it("survives the actual generated worker error endpoint and browser status normalization", async () => {
    class CloningWorkerPort extends TestGeneratedWorkerPort {
      override postMessage(message: unknown): void {
        super.postMessage(structuredClone(message));
      }
    }
    const port = new CloningWorkerPort();
    const owned: ApertureApp[] = [];
    await runGeneratedWorkerLoop({
      port,
      config: defineApertureConfig({ mode: "headless", systems: [] }),
      systems: [{ default: BrokenSceneSystem }],
      start: {},
      pendingInput: [],
      createEntityTools: createGeneratedEntityToolBridge,
      setApp(app) {
        owned.push(app);
      },
    });
    try {
      const posted = port.posted.find(
        (message) =>
          (message as SimulationWorkerErrorMessage).type ===
          SIMULATION_WORKER_PROTOCOL.error,
      );
      expect(posted).toBeDefined();
      const transported = JSON.parse(
        JSON.stringify(posted),
      ) as SimulationWorkerErrorMessage & {
        diagnostics: ApertureGeneratedDiagnostic[];
      };
      const diagnostic = transported.diagnostics[0]!;
      expect(transported.reason).toBe("aperture.generatedWorker.tickFailed");
      expect(diagnostic).toMatchObject({
        code: "aperture.system.lifecycleFailed",
        source: { worker: "generated-simulation" },
        data: { system: "BrokenSceneSystem", phase: "update" },
        error: {
          name: "ApertureSystemError",
          cause: {
            name: "TypeError",
            message: expect.stringContaining("position"),
            stack: expect.stringContaining("brokenAuthoringStep"),
          },
        },
      });
      expect(diagnostic.error?.cause?.stack).toContain(
        "lifecycle-error-diagnostics.test.ts:",
      );
      expect(diagnostic.suggestedFix).toContain("diagnostic.error.cause.stack");

      vi.stubGlobal(APERTURE_GENERATED_STATUS_GLOBAL, undefined);
      const status = installGeneratedStatus();
      let deliver: SimulationWorkerErrorCallback = () => {
        throw new Error("No browser error handler");
      };
      const worker: SimulationWorker = {
        worker: { postMessage() {}, terminate() {} },
        start() {},
        postMessage() {},
        terminate() {},
        onMessage() {
          return () => {};
        },
        onSnapshot() {
          return () => {};
        },
        onError(callback) {
          deliver = callback;
          return () => {};
        },
      };
      const mirrored = mirrorSimulationWorkerSourceAssets(
        worker,
        new AssetRegistry(),
        status,
      );
      mirrored.onError(() => {});
      deliver({
        reason: transported.reason,
        message: transported.message,
        source: "worker",
        diagnostics: transported.diagnostics,
      });
      expect(status.lastFailure?.diagnostics[0]).toEqual(diagnostic);
      expect(
        normalizeApertureDiagnostic(status.lastFailure?.diagnostics[0]),
      ).toEqual(diagnostic);
      mirrored.terminate();
    } finally {
      await Promise.all(owned.map(disposeApertureApp));
    }
  }, 15000);

  it("preserves a real headless lifecycle exception with the same serializable contract", async () => {
    const app = await createApertureApp({
      config: defineApertureConfig({ mode: "headless", systems: [] }),
      systems: [{ default: BrokenSceneSystem }],
    });
    try {
      let failure: unknown;
      try {
        app.step(1 / 60, 1 / 60);
      } catch (error) {
        failure = error;
      }
      expect(failure).toBeInstanceOf(Error);
      const status = createApertureHeadlessFailureStatus(failure);
      const diagnostic = status.diagnostics[0]!;
      expect(diagnostic.error?.cause?.stack).toContain("brokenAuthoringStep");
      expect(diagnostic.data).toEqual({
        system: "BrokenSceneSystem",
        phase: "update",
      });
      expect(
        normalizeApertureDiagnostic(JSON.parse(JSON.stringify(diagnostic))),
      ).toEqual(diagnostic);
    } finally {
      await disposeApertureApp(app);
    }
  }, 15000);

  it("preserves original failure stacks in a paused worker's explicit frame request", async () => {
    // This paused endpoint test needs no scheduler port or timer handles.
    vi.stubGlobal("MessageChannel", undefined);
    const port = new TestGeneratedWorkerPort();
    const owned: ApertureApp[] = [];
    const bridges: GeneratedDevtoolsBridge[] = [];
    await runGeneratedWorkerLoop({
      port,
      config: defineApertureConfig({ mode: "headless", systems: [] }),
      systems: [{ default: BrokenSceneSystem }],
      start: { simulationPaused: true },
      pendingInput: [],
      createEntityTools: createGeneratedEntityToolBridge,
      setApp(app, _entities, bridge) {
        owned.push(app);
        bridges.push(bridge);
      },
    });
    try {
      bridges[0]!.handle(
        createApertureDevtoolsRequest({
          requestId: "failed-manual-frame",
          tool: "ecs_step",
          payload: { delta: 1 / 60 },
        }),
      );
      const response = port.posted.find(
        (message) =>
          (message as ApertureDevtoolsResponse).requestId ===
          "failed-manual-frame",
      ) as ApertureDevtoolsResponse;
      expect(response.ok).toBe(false);
      const diagnostic = normalizeApertureDiagnostic(
        JSON.parse(JSON.stringify(response.diagnostics?.[0])),
      );
      expect(diagnostic.code).toBe("aperture.system.lifecycleFailed");
      expect(diagnostic.error?.cause?.stack).toContain("brokenAuthoringStep");
      expect(diagnostic.data).toEqual({
        system: "BrokenSceneSystem",
        phase: "update",
      });
      expect(diagnostic.suggestedFix).toContain("diagnostic.error.cause.stack");
    } finally {
      await Promise.all(owned.map(disposeApertureApp));
    }
  }, 15000);

  it("bounds oversized and cyclic cause chains and keeps truncation explicit after normalization", () => {
    const root = new Error("m".repeat(10000));
    root.stack = "s".repeat(30000);
    root.cause = root;
    const diagnostic = errorToApertureDiagnostic(root, fallback);
    expect(diagnostic.error?.message.length).toBe(
      APERTURE_DIAGNOSTIC_ERROR_LIMITS.messageCharacters,
    );
    expect(diagnostic.error?.stack?.length).toBe(
      APERTURE_DIAGNOSTIC_ERROR_LIMITS.stackCharacters,
    );
    expect(diagnostic.error).toMatchObject({
      truncated: true,
      cause: { message: "[Circular error cause]", truncated: true },
    });
    expect(normalizeApertureDiagnostic(structuredClone(diagnostic))).toEqual(
      diagnostic,
    );
    expect(() => JSON.stringify(diagnostic)).not.toThrow();

    let deep: Error = new Error("bottom");
    for (let index = 0; index < 20; index++)
      deep = new Error(`cause ${index}`, { cause: deep });
    let detail = errorToApertureDiagnostic(deep, fallback).error;
    let count = 0;
    while (detail) {
      count++;
      expect(detail.truncated).toBe(true);
      detail = detail.cause;
    }
    expect(count).toBe(APERTURE_DIAGNOSTIC_ERROR_LIMITS.causeRecords);
  });

  it("keeps legacy metadata and canonical data/source intact without repeated nesting", () => {
    const canonical = normalizeApertureDiagnostic({
      code: "test.problem",
      severity: "error",
      message: "Problem",
      worker: "generated-simulation",
      frame: 4,
      data: { system: "Scene" },
      suggestedFix: "Fix scene",
    });
    expect(canonical).toEqual({
      code: "test.problem",
      severity: "error",
      message: "Problem",
      source: { worker: "generated-simulation" },
      data: { system: "Scene", frame: 4 },
      suggestedFix: "Fix scene",
    });
    expect(normalizeApertureDiagnostic(canonical)).toEqual(canonical);
    expect(
      normalizeApertureDiagnostic({ error: "legacy string context" }).data?.[
        "error"
      ],
    ).toBe("legacy string context");
    const legacy = normalizeApertureDiagnostic({
      source: { worker: "worker", customContext: "asset loader" },
    });
    expect(legacy.data?.["source"]).toEqual({
      worker: "worker",
      customContext: "asset loader",
    });
    expect(normalizeApertureDiagnostic(legacy)).toEqual(legacy);
  });

  it("preserves non-Error thrown values and gives a usable message recovery target", async () => {
    class PrimitiveFailureSystem extends createSystem() {
      override init(): void {
        throw "missing position";
      }
    }
    let failure: unknown;
    try {
      await createApertureApp({
        config: defineApertureConfig({ mode: "headless", systems: [] }),
        systems: [{ default: PrimitiveFailureSystem }],
      });
    } catch (error) {
      failure = error;
    }
    const diagnostic =
      createApertureHeadlessFailureStatus(failure).diagnostics[0]!;
    expect(diagnostic.error?.cause).toEqual({
      name: "Error",
      message: "missing position",
    });
    expect(diagnostic.suggestedFix).toContain("diagnostic.error.cause.message");
    expect(diagnostic.suggestedFix).not.toContain(
      "original stack is preserved below",
    );
  }, 15000);
});
