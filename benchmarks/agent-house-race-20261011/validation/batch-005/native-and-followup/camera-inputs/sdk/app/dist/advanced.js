import { beginApertureSystemBootstrap, finishApertureSystemBootstrap, disposeApertureAppOwners, } from "./internal/app-lifecycle.js";
import { assertApertureBootstrapAllowed } from "./internal/bootstrap-safety.js";
export { disposeApertureApp } from "./internal/app-lifecycle.js";
export { assertApertureBootstrapAllowed, getApertureCleanupFailures, } from "./internal/bootstrap-safety.js";
import { createExtractionApp, } from "@aperture-engine/runtime";
import { resolveWorldTransforms } from "@aperture-engine/simulation";
import { advanceApertureFrameTime, createApertureSystemContext, flushApertureSystemEffects, } from "./systems.js";
import { createSpatialIndexPopulationState, populateSpatialIndexFromWorld, } from "./systems/spatial-index-population.js";
import { applyPhysicsSnapshotInterpolation } from "./physics-interpolation.js";
import { applyRenderSnapshotInterpolation, installRenderInterpolationFixedStep, } from "./render-interpolation.js";
import { runInteractionFrame } from "./interaction/system.js";
import { runHtmlBridgeFrame } from "./systems/html-bridge.js";
import { runScreenSpaceFramingFrame } from "./systems/screen-space-framing.js";
import { defineApertureConfig, } from "./config.js";
import { resolveConfigPhysicsOption } from "./config-physics.js";
import { ApertureFeatureError, installApertureWorkerFeatures, resolveApertureWorkerFeatureOrder, } from "./features.js";
import { createAperturePhysicsFeature } from "./physics-feature.js";
import { installDefaultEnvironment } from "./default-environment.js";
export { DEFAULT_ENVIRONMENT_ASSET_ID, DEFAULT_ENVIRONMENT_IBL_COLORS, DEFAULT_ENVIRONMENT_IBL_INTENSITY, DEFAULT_ENVIRONMENT_LIGHT_KEY, DEFAULT_ENVIRONMENT_SKY_COLORS, DEFAULT_ENVIRONMENT_SKY_KEY, DEFAULT_ENVIRONMENT_SUN_ILLUMINANCE, DEFAULT_ENVIRONMENT_SUN_KEY, defaultEnvironmentEquirectRgba8, installDefaultEnvironment, } from "./default-environment.js";
export class ApertureAppError extends Error {
    code;
    suggestedFix;
    detail;
    constructor(input) {
        super(`${input.message} Suggested fix: ${input.suggestedFix}`);
        this.name = "ApertureAppError";
        this.code = input.code;
        this.suggestedFix = input.suggestedFix;
        this.detail = input.detail;
    }
}
/** Validate app configuration, feature dependencies, and modules without creating a world. */
export function preflightApertureApp(options) {
    assertApertureBootstrapAllowed();
    const config = defineApertureConfig(options.config);
    const physicsConfig = normalizePhysicsConfig(options.physics ?? resolveConfigPhysicsOption(config.physics));
    resolveApertureWorkerFeatureOrder(physicsConfig === null
        ? (config.features ?? [])
        : [...(config.features ?? []), { id: "physics" }]);
    resolveApertureSystemModules(options.systems ?? []);
}
export async function createApertureApp(options) {
    preflightApertureApp(options);
    const config = defineApertureConfig(options.config);
    // Honor a declarative `config.physics` block when no imperative `physics`
    // option was passed. The worker/browser loop resolves this itself before
    // calling in; deriving it here as well means the headless runner, the
    // one-shot CLI, and any direct `createApertureApp` caller wire physics
    // identically from a shared config — closing the headless/browser gap (F12).
    const physicsConfig = normalizePhysicsConfig(options.physics ?? resolveConfigPhysicsOption(config.physics));
    const featureExtractorRegistry = createFeatureExtractorRegistry(resolveRenderExtractionFeatures(config));
    if (physicsConfig !== null && options.fixedStep === false) {
        throw new ApertureAppError({
            code: "aperture.physics.fixedStepDisabled",
            message: "Aperture physics requires an enabled fixed-step clock.",
            suggestedFix: "Omit fixedStep to use the default clock, pass fixedStep options, or disable the physics config.",
        });
    }
    const fixedStep = options.fixedStep === undefined && physicsConfig !== null
        ? {}
        : options.fixedStep;
    // Mirrors createSimulationFixedStepRunner's disabled condition.
    const fixedStepEnabled = fixedStep !== undefined &&
        fixedStep !== false &&
        fixedStep.enabled !== false;
    const lowLevel = createExtractionApp({
        ...(options.worldOptions === undefined
            ? {}
            : { worldOptions: options.worldOptions }),
        ...(fixedStep === undefined ? {} : { fixedStep }),
        renderFeatures: () => featureExtractorRegistry.renderFeatures(),
    });
    const context = createApertureSystemContext({
        world: lowLevel.world,
        assetsRegistry: lowLevel.assets,
        config,
        registerFixedStepTask: (task, taskOptions) => {
            if (!fixedStepEnabled) {
                // Registration against a disabled runner used to succeed silently
                // and the task simply never ran (battletest finding F16).
                context.diagnostics.warn("aperture.fixedStep.taskWhileDisabled", { hasPhysicsConfig: physicsConfig !== null }, "A fixed-step task was registered but the fixed-step runner is disabled, so it will never run. Enable physics in the app config or pass fixedStep options to schedule fixed-step tasks.");
            }
            return lowLevel.registerFixedStepTask(task, taskOptions);
        },
        ...(options.startOptions === undefined
            ? {}
            : { startOptions: options.startOptions }),
        ...(options.assetLoader === undefined
            ? {}
            : { assetLoader: options.assetLoader }),
        ...(options.gltfAssetDecoders === undefined
            ? {}
            : { gltfAssetDecoders: options.gltfAssetDecoders }),
        ...(options.random === undefined ? {} : { random: options.random }),
        ...(options.determinism === undefined
            ? {}
            : { determinism: options.determinism }),
    });
    const preload = preloadReport(config);
    const spatialIndexPopulation = createSpatialIndexPopulationState();
    installRenderInterpolationFixedStep({
        world: lowLevel.world,
        registerFixedStepTask: (task, taskOptions) => lowLevel.registerFixedStepTask(task, taskOptions),
    });
    const physicsInterpolation = options.physicsInterpolation === true;
    const physicsFeature = physicsConfig === null
        ? null
        : createAperturePhysicsFeature({
            config: physicsConfig,
            physics: context.physics,
        });
    const workerFeatures = physicsFeature === null
        ? (config.features ?? [])
        : [...(config.features ?? []), physicsFeature];
    let installedFeatures = null;
    let lastFixedStep = null;
    const refreshSpatialIndex = () => populateSpatialIndexFromWorld({
        world: lowLevel.world,
        assetsRegistry: context.assetsRegistry,
        spatial: context.spatial,
    }, spatialIndexPopulation);
    beginApertureSystemBootstrap(lowLevel.world);
    try {
        installedFeatures = await installApertureWorkerFeatures({
            features: workerFeatures,
            world: lowLevel.world,
            assets: lowLevel.assets,
            registerFixedStepTask: (task, taskOptions) => lowLevel.registerFixedStepTask(task, taskOptions),
            registerExtractor: featureExtractorRegistry.registerExtractor,
        });
        const physicsFacade = physicsFeature?.getFacade() ?? null;
        await preloadAssets(context, "blocking");
        startBackgroundPreloads(context);
        installRenderDefaults(config, context);
        registerApertureSystemModules(lowLevel, options.systems ?? []);
        // After user setup systems have initialized, so an authored sky, skybox,
        // or environment light suppresses the zero-config default environment.
        installDefaultEnvironment({ config, context, world: lowLevel.world });
        resolveWorldTransforms(lowLevel.world);
        refreshSpatialIndex();
        // AI-60 (cheap half): the pre-step resolve + spatial refresh only repeat
        // when the world actually changed since the post-step refresh (between-step
        // spawns, devtools writes, interaction or postUpdate effects). Steady-state
        // frames run exactly one resolve (inside lowLevel.step, after fixed-step
        // physics writeback) and one spatial refresh per step.
        let worldVersionAtRefresh = lowLevel.world.worldChangeVersion();
        const apertureApp = {
            mode: config.mode,
            config,
            lowLevel,
            context,
            features: installedFeatures,
            physics: physicsFacade,
            preload,
            step(delta = 0, time = 0) {
                // Advance the sanctioned sim-clock before any system runs this frame.
                advanceApertureFrameTime(context.time, delta, time);
                const timingStartedAt = nowMilliseconds();
                let timingCursor = timingStartedAt;
                const markTiming = () => {
                    const now = nowMilliseconds();
                    const elapsed = Math.max(0, now - timingCursor);
                    timingCursor = now;
                    return elapsed;
                };
                const preStepWorldChanged = lowLevel.world.worldChangeVersion() !== worldVersionAtRefresh;
                runHtmlBridgeFrame({
                    commands: context.commands,
                    resources: context.resources,
                });
                if (preStepWorldChanged) {
                    resolveWorldTransforms(lowLevel.world);
                    refreshSpatialIndex();
                }
                const preStepResolveSpatialMilliseconds = markTiming();
                flushApertureSystemEffects(lowLevel.world, "input");
                const inputEffectsMilliseconds = markTiming();
                const result = lowLevel.step(delta, time);
                const lowLevelStepMilliseconds = markTiming();
                flushApertureSystemEffects(lowLevel.world, "update");
                const updateEffectsMilliseconds = markTiming();
                lastFixedStep = result.fixedStep;
                const framing = runScreenSpaceFramingFrame(context, delta);
                if (framing.updated > 0) {
                    resolveWorldTransforms(lowLevel.world);
                }
                refreshSpatialIndex();
                const postStepSpatialMilliseconds = markTiming();
                worldVersionAtRefresh = lowLevel.world.worldChangeVersion();
                // Synthesize pointer-on-object events from post-update world state, after
                // fixed-step physics writeback has refreshed transforms and picking data.
                runInteractionFrame(context, time);
                const interactionMilliseconds = markTiming();
                flushApertureSystemEffects(lowLevel.world, "postUpdate");
                const postUpdateEffectsMilliseconds = markTiming();
                return {
                    ...result,
                    timing: {
                        totalMilliseconds: Math.max(0, nowMilliseconds() - timingStartedAt),
                        preStepResolveSpatialMilliseconds,
                        inputEffectsMilliseconds,
                        lowLevelStepMilliseconds,
                        updateEffectsMilliseconds,
                        postStepSpatialMilliseconds,
                        interactionMilliseconds,
                        postUpdateEffectsMilliseconds,
                        preStepWorldChanged,
                        lowLevel: result.timing,
                    },
                };
            },
            extract(frame = 0) {
                const snapshot = lowLevel.extract(frame);
                if (physicsInterpolation && lastFixedStep !== null) {
                    applyPhysicsSnapshotInterpolation({
                        snapshot,
                        world: lowLevel.world,
                        alpha: lastFixedStep.overstepAlpha,
                    });
                }
                if (lastFixedStep !== null) {
                    applyRenderSnapshotInterpolation({
                        snapshot,
                        world: lowLevel.world,
                        alpha: lastFixedStep.overstepAlpha,
                    });
                }
                return snapshot;
            },
            registerFixedStepTask(task, taskOptions) {
                return lowLevel.registerFixedStepTask(task, taskOptions);
            },
            resetFixedStepClock() {
                lowLevel.resetFixedStepClock();
            },
            snapshotFixedStepClock() {
                return lowLevel.snapshotFixedStepClock();
            },
            restoreFixedStepClock(state) {
                return lowLevel.restoreFixedStepClock(state);
            },
            stepAndExtract(delta = 0, time = 0, frame = 0) {
                apertureApp.step(delta, time);
                return apertureApp.extract(frame);
            },
            dispose() {
                return installedFeatures?.dispose();
            },
        };
        finishApertureSystemBootstrap(lowLevel.world);
        return apertureApp;
    }
    catch (error) {
        // Preserve the startup failure. Cleanup evidence remains available even
        // when an initializer or a secondary disposer also fails.
        await disposeApertureAppOwners(lowLevel.world, () => installedFeatures?.dispose());
        throw error;
    }
}
function normalizePhysicsConfig(config) {
    if (config === undefined || config === false) {
        return null;
    }
    return config === true ? {} : config;
}
export function resolveApertureSystemModules(modules) {
    return modules
        .map((moduleValue, index) => resolveSystemModule(moduleValue, index))
        .sort((a, b) => a.priority - b.priority || a.moduleId.localeCompare(b.moduleId));
}
export function registerApertureSystemModules(app, modules) {
    const resolved = resolveApertureSystemModules(modules);
    for (const moduleValue of resolved) {
        app.world.registerSystem(moduleValue.System, {
            priority: moduleValue.priority,
            ...(moduleValue.configData === undefined
                ? {}
                : { configData: moduleValue.configData }),
        });
    }
    return resolved;
}
function resolveSystemModule(moduleValue, index) {
    if (moduleValue.default === undefined) {
        throw new ApertureAppError({
            code: "aperture.system.missingDefaultExport",
            message: `System entry at index ${index} requires a module object with a default-exported system class.`,
            suggestedFix: "Pass an imported module as systems: [sceneModule], or wrap a default-imported class as systems: [{ default: SceneSystem }]. Default-export a createSystem() class in source files; set priority with createSystem({ priority: 0 }), not on the module entry.",
            detail: { index },
        });
    }
    if (!isSystemConstructor(moduleValue.default)) {
        throw new ApertureAppError({
            code: "aperture.system.invalidDefaultExport",
            message: `Discovered system module at index ${index} does not export an EliCS system class.`,
            suggestedFix: "Use export default class MySystem extends createSystem(...) { ... }.",
            detail: { index },
        });
    }
    const priority = moduleValue.default.aperture?.schedule.priority ?? 0;
    if (!Number.isFinite(priority)) {
        throw new ApertureAppError({
            code: "aperture.system.invalidPriority",
            message: `Discovered system module at index ${index} has an invalid createSystem descriptor priority.`,
            suggestedFix: "Use createSystem({ priority: 0 }) or omit priority.",
            detail: { index, priority },
        });
    }
    return {
        moduleId: moduleValue.default.name || `system:${index}`,
        System: moduleValue.default,
        priority,
        ...(moduleValue.configData === undefined
            ? {}
            : { configData: moduleValue.configData }),
    };
}
function isSystemConstructor(value) {
    return (typeof value === "function" &&
        "isSystem" in value &&
        value.isSystem === true);
}
async function preloadAssets(context, policy) {
    const matching = context.assets
        .list()
        .filter((asset) => asset.preload === policy);
    await Promise.all(matching.map((asset) => context.assets.request(asset)));
}
function startBackgroundPreloads(context) {
    for (const asset of context.assets.list()) {
        if (asset.preload !== "background") {
            continue;
        }
        void context.assets.request(asset).catch(() => undefined);
    }
}
function preloadReport(config) {
    const byPolicy = {
        blocking: [],
        background: [],
        manual: [],
    };
    for (const [id, descriptor] of Object.entries(config.assets ?? {})) {
        byPolicy[descriptor.preload].push(id);
    }
    return {
        blocking: byPolicy.blocking,
        background: byPolicy.background,
        manual: byPolicy.manual,
    };
}
function nowMilliseconds() {
    return typeof performance === "undefined" ? Date.now() : performance.now();
}
const RENDER_PACKET_FAMILY_FEATURES = new Map([
    ["particleEmitters", "particles"],
    ["uiNodes", "ui"],
    ["uiHitRegions", "ui"],
]);
function createFeatureExtractorRegistry(initialFeatures) {
    const baseFeatures = initialFeatures === undefined ? undefined : { ...initialFeatures };
    const featureCounts = new Map();
    const registerExtractor = (hook) => {
        const featureKeys = new Set();
        const unknownFamilies = hook.packetFamilies.filter((packetFamily) => !RENDER_PACKET_FAMILY_FEATURES.has(packetFamily));
        // An unknown family can never produce packets, so a successful-looking
        // registration would be a silent no-op. Fail the install instead.
        if (unknownFamilies.length > 0) {
            const message = `Feature '${hook.id}' registered an extractor for unknown packet ${unknownFamilies.length === 1 ? "family" : "families"}: ${unknownFamilies
                .map((family) => `'${family}'`)
                .join(", ")}.`;
            const suggestedFix = `Use a packet family the render extraction contract defines (${[
                ...RENDER_PACKET_FAMILY_FEATURES.keys(),
            ].join(", ")}) or extend the contract before registering the extractor.`;
            throw new ApertureFeatureError({
                code: "aperture.feature.unknownPacketFamily",
                message,
                suggestedFix,
                diagnostics: [
                    {
                        code: "aperture.feature.unknownPacketFamily",
                        severity: "error",
                        featureId: hook.id,
                        message,
                        suggestedFix,
                        data: {
                            packetFamilies: [...hook.packetFamilies],
                            unknownFamilies,
                        },
                    },
                ],
            });
        }
        for (const packetFamily of hook.packetFamilies) {
            const featureKey = RENDER_PACKET_FAMILY_FEATURES.get(packetFamily);
            if (featureKey !== undefined) {
                featureKeys.add(featureKey);
            }
        }
        for (const featureKey of featureKeys) {
            featureCounts.set(featureKey, (featureCounts.get(featureKey) ?? 0) + 1);
        }
        let disposed = false;
        return () => {
            if (disposed) {
                return;
            }
            disposed = true;
            for (const featureKey of featureKeys) {
                const next = (featureCounts.get(featureKey) ?? 0) - 1;
                if (next <= 0) {
                    featureCounts.delete(featureKey);
                }
                else {
                    featureCounts.set(featureKey, next);
                }
            }
        };
    };
    return {
        registerExtractor,
        renderFeatures() {
            if (baseFeatures === undefined && featureCounts.size === 0) {
                return undefined;
            }
            const resolved = {
                ...(baseFeatures ?? {}),
            };
            for (const [featureKey, count] of featureCounts) {
                if (count > 0) {
                    resolved[featureKey] = true;
                }
            }
            return resolved;
        },
    };
}
function resolveRenderExtractionFeatures(config) {
    if (config.features === undefined) {
        return undefined;
    }
    const featureIds = new Set(config.features.map((feature) => feature.id));
    return {
        particles: featureIds.has("particles"),
        ui: featureIds.has("ui"),
    };
}
function installRenderDefaults(config, context) {
    if (config.render?.defaultCamera === true) {
        context.spawn.camera({
            key: "camera.main",
            name: "main-camera",
            transform: {
                translation: [0, 1.5, 5],
                lookAt: [0, 0.75, 0],
            },
            fovYDegrees: 60,
        });
    }
    if (config.render?.defaultLight === true) {
        context.spawn.light({
            key: "light.default",
            name: "default-light",
            kind: "directional",
            illuminance: 4,
            transform: {
                rotationEulerDegrees: [-45, 35, 0],
            },
        });
    }
}
// Advanced source-inspection support; descriptors stay inside their execution realm.
export { findDefinedResource } from "./systems/resources.js";
//# sourceMappingURL=advanced.js.map