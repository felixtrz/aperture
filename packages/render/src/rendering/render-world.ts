import type { RenderSnapshot } from "./snapshot.js";
import { applySnapshotToRenderWorldObjects } from "./render-world-apply.js";
import { planRenderWorldDrawReadiness } from "./render-world-readiness.js";
import type {
  RenderWorldApplyOptions,
  RenderWorldApplyReport,
  RenderWorldDrawReadinessReport,
  RenderWorldObject,
  RenderWorldResourceBindingResult,
  RenderWorldResourceBindingUpdate,
} from "./render-world-types.js";

export { planRenderWorldDrawReadiness } from "./render-world-readiness.js";
export type {
  RenderWorldApplyOptions,
  RenderWorldApplyReport,
  RenderWorldBlockedDraw,
  RenderWorldDrawBlockReason,
  RenderWorldDrawReadinessReport,
  RenderWorldGpuPlaceholders,
  RenderWorldObject,
  RenderWorldObjectStatus,
  RenderWorldReadyDraw,
  RenderWorldResourceBindingFailure,
  RenderWorldResourceBindingResult,
  RenderWorldResourceBindingSuccess,
  RenderWorldResourceBindingUpdate,
} from "./render-world-types.js";

export class RenderWorld {
  readonly #objects = new Map<number, RenderWorldObject>();

  get size(): number {
    return this.#objects.size;
  }

  getObject(renderId: number): RenderWorldObject | undefined {
    return this.#objects.get(renderId);
  }

  listObjects(): RenderWorldObject[] {
    return [...this.#objects.values()].sort((a, b) => a.renderId - b.renderId);
  }

  createDrawReadinessReport(): RenderWorldDrawReadinessReport {
    return planRenderWorldDrawReadiness(this.listObjects());
  }

  updateResourceBindings(
    renderId: number,
    update: RenderWorldResourceBindingUpdate,
  ): RenderWorldResourceBindingResult {
    const existing = this.#objects.get(renderId);

    if (existing === undefined) {
      return {
        ok: false,
        reason: "missing-render-id",
        diagnostics: [
          {
            code: "renderWorld.missingRenderId",
            message: `Cannot update resource bindings for missing render id ${renderId}.`,
            severity: "warning",
          },
        ],
      };
    }

    const object: RenderWorldObject = {
      ...existing,
      gpu: {
        meshResourceKey:
          update.meshResourceKey === undefined
            ? existing.gpu.meshResourceKey
            : update.meshResourceKey,
        materialResourceKey:
          update.materialResourceKey === undefined
            ? existing.gpu.materialResourceKey
            : update.materialResourceKey,
      },
    };

    this.#objects.set(renderId, object);
    return { ok: true, object };
  }

  applySnapshot(
    snapshot: RenderSnapshot,
    options: RenderWorldApplyOptions = {},
  ): RenderWorldApplyReport {
    return applySnapshotToRenderWorldObjects(this.#objects, snapshot, options);
  }
}
