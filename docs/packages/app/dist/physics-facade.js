import { createPhysicsWorldSyncState, stepPhysicsWorld, } from "@aperture-engine/physics";
import { createAssetBackedPhysicsColliderGeometryProvider } from "./physics-collider-geometry.js";
export async function installApertureAppPhysics(options) {
    const colliderGeometryProvider = createColliderGeometryProvider(options);
    const execution = options.config.execution ?? "simulation-worker";
    const backend = await createConfiguredPhysicsBackend(options.config, {
        execution,
        ...(colliderGeometryProvider === undefined
            ? {}
            : { colliderGeometryProvider }),
    });
    await backend.init({
        ...(options.config.gravity === undefined
            ? {}
            : { gravity: options.config.gravity }),
        execution,
        ...(colliderGeometryProvider === undefined
            ? {}
            : { colliderGeometryProvider }),
    });
    options.physics.setBackend(backend);
    const state = createPhysicsWorldSyncState();
    const unregister = options.registerFixedStepTask((context) => {
        const report = stepPhysicsWorld({
            world: context.world,
            backend,
            fixedDelta: context.fixedDelta,
            fixedStep: context.fixedStep,
            state,
        });
        options.physics.setStepReport(report);
    });
    return {
        backend,
        unregister,
        dispose() {
            unregister();
            options.physics.setBackend(null);
            options.physics.clearEvents();
            backend.dispose();
        },
    };
}
function createColliderGeometryProvider(options) {
    const config = options.config.colliderGeometry;
    if (config === undefined || config.kind === "none") {
        return undefined;
    }
    if (config.kind === "provider") {
        return config.provider;
    }
    return createAssetBackedPhysicsColliderGeometryProvider({
        assets: options.assets,
        ...(config.heightfields === undefined
            ? {}
            : { heightfields: config.heightfields }),
    });
}
async function createConfiguredPhysicsBackend(config, options) {
    const backend = config.backend ?? "rapier";
    if (backend === "rapier") {
        const { createRapierPhysicsBackend } = await import("@aperture-engine/physics-rapier");
        return createRapierPhysicsBackend({
            ...(config.gravity === undefined ? {} : { gravity: config.gravity }),
            execution: options.execution,
            ...(options.colliderGeometryProvider === undefined
                ? {}
                : { colliderGeometryProvider: options.colliderGeometryProvider }),
        });
    }
    if (typeof backend === "function") {
        return backend();
    }
    return backend;
}
//# sourceMappingURL=physics-facade.js.map