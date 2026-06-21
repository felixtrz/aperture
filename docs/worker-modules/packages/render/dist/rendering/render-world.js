import { applySnapshotToRenderWorldObjects } from "./render-world-apply.js";
import { planRenderWorldDrawReadiness } from "./render-world-readiness.js";
export { planRenderWorldDrawReadiness } from "./render-world-readiness.js";
export class RenderWorld {
    #objects = new Map();
    get size() {
        return this.#objects.size;
    }
    getObject(renderId) {
        return this.#objects.get(renderId);
    }
    listObjects() {
        return [...this.#objects.values()].sort((a, b) => a.renderId - b.renderId);
    }
    createDrawReadinessReport() {
        return planRenderWorldDrawReadiness(this.listObjects());
    }
    updateResourceBindings(renderId, update) {
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
        const object = {
            ...existing,
            gpu: {
                meshResourceKey: update.meshResourceKey === undefined
                    ? existing.gpu.meshResourceKey
                    : update.meshResourceKey,
                materialResourceKey: update.materialResourceKey === undefined
                    ? existing.gpu.materialResourceKey
                    : update.materialResourceKey,
            },
        };
        this.#objects.set(renderId, object);
        return { ok: true, object };
    }
    applySnapshot(snapshot, options = {}) {
        return applySnapshotToRenderWorldObjects(this.#objects, snapshot, options);
    }
}
//# sourceMappingURL=render-world.js.map