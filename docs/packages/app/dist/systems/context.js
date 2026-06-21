import { createInputResource, } from "../input/state.js";
import { createSpatialQueries } from "../spatial/index.js";
import { createDiagnostics } from "./diagnostics.js";
import { createScheduledEffects } from "./effects.js";
import { ApertureSystemError } from "./errors.js";
import { createCommandAccess } from "./commands.js";
import { createSystemAssetAccess, } from "./assets.js";
import { registerApertureAppComponents } from "./components.js";
import { createCameraAccess } from "./cameras.js";
import { createGltfInstanceAccess } from "./gltf.js";
import { createHierarchyAccess } from "./hierarchy.js";
import { createInteractionAccess, } from "../interaction/access.js";
import { createMaterialAccess } from "./materials.js";
import { createMeshAccess } from "./meshes.js";
import { createPhysicsAccess } from "./physics.js";
import { createPrefabAccess } from "./prefabs.js";
import { createParticleAccess } from "./particles.js";
import { createAudioAccess } from "./audio.js";
import { createTrailAccess } from "./trails.js";
import { createSignalStore } from "./signals.js";
import { createResourceStore } from "./resources.js";
import { createStartOptionsAccess, } from "./start-options.js";
import { createSpawnCommands } from "./spawn/index.js";
import { createFixedStepAccess, } from "./fixed-step.js";
import { createHtmlBridgeAccess, } from "./html-bridge.js";
const APERTURE_SYSTEM_CONTEXT_KEY = "aperture.systemContext";
export function installApertureSystemContext(world, context) {
    world.globals[APERTURE_SYSTEM_CONTEXT_KEY] = context;
}
export function createApertureSystemContext(options) {
    registerApertureAppComponents(options.world);
    const diagnostics = createDiagnostics();
    const signals = createSignalStore(options.config?.signals ?? {});
    const resources = createResourceStore();
    const startOptions = createStartOptionsAccess(options.startOptions);
    const input = createInputSignals(options.config);
    const assets = createSystemAssetAccess({
        config: options.config,
        registry: options.assetsRegistry,
        diagnostics,
        loader: options.assetLoader,
        ...(options.gltfAssetDecoders === undefined
            ? {}
            : { gltfAssetDecoders: options.gltfAssetDecoders }),
    });
    const commands = createCommandAccess(assets);
    const physics = createPhysicsAccess({ world: options.world });
    const spatial = createSpatialQueries({
        colliders: {
            world: options.world,
            getPhysicsBackend: () => physics.getBackend(),
        },
    });
    const spawn = createSpawnCommands({
        world: options.world,
        registry: options.assetsRegistry,
        diagnostics,
        get assets() {
            return assets;
        },
    });
    const cameras = createCameraAccess(options.world, {
        contextKey: APERTURE_SYSTEM_CONTEXT_KEY,
    });
    const gltf = createGltfInstanceAccess(options.world);
    const hierarchy = createHierarchyAccess(options.world);
    const prefabs = createPrefabAccess(options.assetsRegistry);
    const particles = createParticleAccess({ world: options.world, assets });
    const audio = createAudioAccess({ world: options.world, assets });
    const materials = createMaterialAccess(options.assetsRegistry);
    const meshes = createMeshAccess(options.assetsRegistry);
    const trails = createTrailAccess({
        registry: options.assetsRegistry,
        meshes,
        spawn,
    });
    const fixedStep = createFixedStepAccess(options.registerFixedStepTask);
    const interaction = createInteractionAccess(options.world);
    const html = createHtmlBridgeAccess(resources);
    const context = {
        world: options.world,
        assetsRegistry: options.assetsRegistry,
        signals,
        resources,
        startOptions,
        input,
        assets,
        commands,
        spawn,
        spatial,
        cameras,
        gltf,
        hierarchy,
        prefabs,
        particles,
        audio,
        materials,
        meshes,
        trails,
        physics,
        fixedStep,
        interaction,
        html,
        diagnostics,
        effects: createScheduledEffects(),
    };
    installApertureSystemContext(options.world, context);
    return context;
}
export function getApertureSystemContext(world) {
    const context = world.globals[APERTURE_SYSTEM_CONTEXT_KEY];
    if (isApertureSystemContext(context)) {
        return context;
    }
    throw new ApertureSystemError("aperture.systemContext.missing", "Aperture system context is not installed on the ECS world.", "Create the app through createApertureApp() or installApertureSystemContext() before registering app systems.");
}
function isApertureSystemContext(value) {
    return (typeof value === "object" &&
        value !== null &&
        "signals" in value &&
        "resources" in value &&
        "startOptions" in value &&
        "spawn" in value &&
        "meshes" in value &&
        "gltf" in value &&
        "trails" in value &&
        "particles" in value &&
        "audio" in value &&
        "html" in value &&
        "effects" in value);
}
function createInputSignals(config) {
    return createInputResource(config);
}
//# sourceMappingURL=context.js.map