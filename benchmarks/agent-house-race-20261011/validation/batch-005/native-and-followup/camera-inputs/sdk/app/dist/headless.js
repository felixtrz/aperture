import { decodeTypedArrayTree, encodeTypedArrayTree, renderSnapshotToJsonValue, } from "@aperture-engine/render";
import { componentRegistryFromWorld, findDefinedComponent, loadScene, saveScene, serializeEntityRef, } from "@aperture-engine/simulation";
import { ApertureAppError, createApertureApp, assertApertureBootstrapAllowed, disposeApertureApp, } from "./advanced.js";
import { defineApertureConfig } from "./config.js";
import { createApertureEntityLookup, createApertureEntityLookupSnapshot, } from "./entity-lookup.js";
import { createSignalSummary, } from "./systems.js";
import { findDefinedResource, } from "./systems/resources.js";
import { mirrorSourceAssetRegistryFromMessage, serializeSourceAssetRegistry, } from "./asset-mirror.js";
import { jsonSafeValue } from "./internal/json-safe.js";
import { createApertureGeneratedFailureStatus, } from "./diagnostics.js";
import { createInputSummary } from "./input.js";
import { advanceGeneratedInputFrame, createGeneratedInputEventMessage, drainGeneratedInputEventMessagesForFrame, } from "./input/events.js";
import { restoreApertureFrameTime, snapshotApertureFrameTime, } from "./systems/frame-time.js";
import { restoreApertureRandom, snapshotApertureRandom, } from "./systems/random.js";
export const APERTURE_SESSION_SNAPSHOT_FORMAT = "aperture.session-snapshot";
export const APERTURE_SESSION_SNAPSHOT_VERSION = 1;
export const APERTURE_SESSION_SNAPSHOT_APP_VERSION = "0.3.0";
/**
 * Create a headless runner from already imported modules, for example
 * `systems: [{ default: SceneSystem }]`. Scheduling belongs to the class's
 * `createSystem({ priority })` descriptor. Use `disposeApertureApp(runner.app)`
 * from `@aperture-engine/app/advanced` for complete system and feature cleanup.
 */
export async function createApertureHeadlessRunner(options) {
    assertApertureBootstrapAllowed();
    const config = defineApertureConfig(options.config);
    if (config.mode !== "headless") {
        throw new ApertureAppError({
            code: "aperture.headless.invalidMode",
            message: "Aperture headless runner requires mode: 'headless'.",
            suggestedFix: "Use a headless aperture config or run browser configs through the generated Vite browser bootstrap.",
            detail: { mode: config.mode },
        });
    }
    const app = await createApertureApp({
        ...options,
        config,
    });
    try {
        const sessionBootstrap = createSessionBootstrapManifest(options, config);
        let nextFrame = 0;
        let lastSnapshot = null;
        const pendingInput = [];
        const entities = createApertureEntityLookup(app.lowLevel.world);
        return {
            app,
            entities,
            sessionBootstrap,
            enqueueInput(event, frame) {
                pendingInput.push(createGeneratedInputEventMessage(event, frame));
            },
            enqueueInputBatch(events, frame) {
                for (const event of events) {
                    pendingInput.push(createGeneratedInputEventMessage(event, frame));
                }
            },
            getStatus() {
                return createHeadlessStatus(app, nextFrame, lastSnapshot);
            },
            step(delta = 0, time = 0) {
                const frame = nextFrame;
                const events = drainGeneratedInputEventMessagesForFrame(pendingInput, frame);
                advanceGeneratedInputFrame({
                    signals: app.context.input,
                    config,
                    events,
                });
                nextFrame += 1;
                lastSnapshot = app.stepAndExtract(delta, time, frame);
                return {
                    snapshot: lastSnapshot,
                    status: createHeadlessStatus(app, nextFrame, lastSnapshot),
                };
            },
            stepWithoutExtract(delta = 0, time = 0) {
                // Advance the simulation without running render extraction. Extraction is
                // ~99.8% of per-step cost at scale, so a warm loop that only needs to
                // reach a target state (then extract once) is far cheaper this way
                // (finding F18). lastSnapshot is intentionally left untouched; callers
                // extract() on demand when they want fresh render data.
                const frame = nextFrame;
                const events = drainGeneratedInputEventMessagesForFrame(pendingInput, frame);
                advanceGeneratedInputFrame({
                    signals: app.context.input,
                    config,
                    events,
                });
                nextFrame += 1;
                app.step(delta, time);
                return {
                    status: createHeadlessStatus(app, nextFrame, lastSnapshot),
                };
            },
            extract(frame = nextFrame) {
                lastSnapshot = app.extract(frame);
                return {
                    snapshot: lastSnapshot,
                    status: createHeadlessStatus(app, nextFrame, lastSnapshot),
                };
            },
            restoreSessionSnapshot(snapshot) {
                const report = restoreApertureSessionSnapshotIntoRunner(snapshot, {
                    app,
                    setNextFrame(value) {
                        nextFrame = value;
                    },
                    setLastSnapshot(value) {
                        lastSnapshot = value;
                    },
                });
                return report;
            },
        };
    }
    catch (error) {
        // App ownership begins before the runner manifest and lookup are assembled.
        await disposeApertureApp(app);
        throw error;
    }
}
export async function restoreApertureHeadlessRunnerFromSessionSnapshot(options) {
    assertSupportedSessionSnapshot(options.snapshot);
    const runner = await createApertureHeadlessRunner(options);
    try {
        const restore = runner.restoreSessionSnapshot(options.snapshot);
        return { runner, restore };
    }
    catch (error) {
        await disposeApertureApp(runner.app);
        throw error;
    }
}
export function createApertureSessionSnapshot(runner, options = {}) {
    const status = runner.getStatus();
    const random = snapshotApertureRandom(runner.app.context.random);
    return {
        format: APERTURE_SESSION_SNAPSHOT_FORMAT,
        version: APERTURE_SESSION_SNAPSHOT_VERSION,
        bootstrap: runner.sessionBootstrap,
        simulation: {
            scene: saveScene(runner.app.lowLevel.world),
            componentRegistry: createSessionComponentRegistryManifest(runner.app.lowLevel.world),
            resources: serializeSessionResources(status.resources),
            signals: serializeSessionSignals(runner.app.config, status.signals),
            sourceAssets: encodeTypedArrayTree(serializeSourceAssetRegistry(runner.app.lowLevel.assets)),
            diagnostics: status.diagnostics,
        },
        runtime: {
            frame: status.nextFrame,
            nextFrame: status.nextFrame,
            time: snapshotApertureFrameTime(runner.app.context.time),
            fixedStepClock: runner.app.snapshotFixedStepClock(),
            randomStreams: random === null ? [] : [{ id: "default", state: random }],
            random,
            systems: snapshotSessionSystemStates(runner.app),
        },
        physics: {
            mode: "rebuild-from-ecs-authoring",
            diagnostics: [],
        },
        ...(options.inspection === undefined
            ? {}
            : { inspection: encodeSessionInspection(options.inspection) }),
    };
}
export function createApertureHeadlessFailureStatus(error) {
    return {
        mode: "headless",
        ...createApertureGeneratedFailureStatus({
            error,
            fallback: {
                code: "aperture.headless.failed",
                severity: "error",
                message: "Aperture headless app failed.",
                suggestedFix: "Inspect aperture.config.ts, system modules, and asset URLs before rerunning headless mode.",
            },
        }),
    };
}
export function createApertureStableDigest(value) {
    const json = stableJsonStringify(value);
    return {
        algorithm: "fnv1a32-stable-json-v1",
        hash: fnv1a32(json),
        byteLength: json.length,
    };
}
export function createApertureHeadlessEcsDigest(status) {
    return createApertureStableDigest(normalizedEntityDigestValue(status.entities));
}
function normalizedEntityDigestValue(value) {
    if (!isJsonRecord(value) || !Array.isArray(value.summaries)) {
        return value;
    }
    const summaries = value.summaries.filter(isJsonRecord);
    const sorted = summaries.slice().sort((a, b) => {
        const aKey = stableJsonStringify(entityDigestSortValue(a));
        const bKey = stableJsonStringify(entityDigestSortValue(b));
        return aKey.localeCompare(bKey);
    });
    const labels = new Map();
    sorted.forEach((summary, index) => {
        const ref = entityRefDigestKey(summary.entity);
        if (ref !== null) {
            labels.set(ref, entityDigestLabel(summary, index));
        }
    });
    return {
        ...value,
        summaries: sorted.map((summary, index) => normalizeEntitySummaryForDigest(summary, labels, index)),
    };
}
function normalizeEntitySummaryForDigest(summary, labels, index) {
    const normalized = {};
    for (const [key, fieldValue] of Object.entries(summary)) {
        if (key === "entity") {
            normalized.entity = entityDigestLabel(summary, index);
            continue;
        }
        if (key === "name" &&
            typeof fieldValue === "string" &&
            /^Entity \d+$/u.test(fieldValue)) {
            continue;
        }
        normalized[key] = normalizeEntityRefsForDigest(fieldValue, labels);
    }
    return normalized;
}
function normalizeEntityRefsForDigest(value, labels) {
    const ref = entityRefDigestKey(value);
    if (ref !== null) {
        return { entityRef: labels.get(ref) ?? ref };
    }
    if (Array.isArray(value)) {
        return value.map((item) => normalizeEntityRefsForDigest(item, labels));
    }
    if (!isJsonRecord(value)) {
        return value;
    }
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
        key,
        normalizeEntityRefsForDigest(item, labels),
    ]));
}
function entityDigestSortValue(summary) {
    const { entity: _entity, name, ...rest } = summary;
    const normalizedRest = normalizeEntityRefsForDigest(rest, new Map());
    return {
        ...(isJsonRecord(normalizedRest) ? normalizedRest : {}),
        ...(typeof name === "string" && !/^Entity \d+$/u.test(name)
            ? { name }
            : {}),
    };
}
function entityDigestLabel(summary, index) {
    return typeof summary.key === "string" && summary.key.length > 0
        ? `key:${summary.key}`
        : typeof summary.name === "string" && !/^Entity \d+$/u.test(summary.name)
            ? `name:${summary.name}`
            : `entity:${index}`;
}
function entityRefDigestKey(value) {
    if (!isJsonRecord(value)) {
        return null;
    }
    return Number.isInteger(value.index) && Number.isInteger(value.generation)
        ? `${String(value.index)}:${String(value.generation)}`
        : null;
}
function isJsonRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function createApertureHeadlessStatusDigest(status) {
    return createApertureStableDigest({
        mode: status.mode,
        nextFrame: status.nextFrame,
        assets: status.assets,
        input: status.input,
        signals: status.signals,
        resources: status.resources,
        startOptions: status.startOptions,
        fixedStepClock: status.fixedStepClock,
        diagnostics: status.diagnostics,
        entities: normalizedEntityDigestValue(status.entities),
        lastSnapshot: status.lastSnapshot,
    });
}
export function createApertureRenderSnapshotDigest(snapshot) {
    return createApertureStableDigest(renderSnapshotToJsonValue(snapshot));
}
function createHeadlessStatus(app, nextFrame, lastSnapshot) {
    return {
        mode: "headless",
        nextFrame,
        preload: app.preload,
        assets: app.lowLevel.assets.createManifestReport(),
        input: createInputSummary(app.context.input),
        signals: createSignalSummary(app.context.signals),
        resources: app.context.resources.summary(),
        startOptions: app.context.startOptions.summary(),
        fixedStepClock: app.snapshotFixedStepClock(),
        diagnostics: app.context.diagnostics.list(),
        entities: createApertureEntityLookupSnapshot(app.lowLevel.world, {
            label: "headless",
        }),
        lastSnapshot: lastSnapshot === null
            ? null
            : {
                frame: lastSnapshot.frame,
                counts: snapshotCounts(lastSnapshot),
            },
    };
}
function createSessionBootstrapManifest(options, config) {
    const fixedStepOptions = options.fixedStep === undefined && options.physics !== undefined
        ? {}
        : options.fixedStep;
    return {
        apertureVersion: APERTURE_SESSION_SNAPSHOT_APP_VERSION,
        appConfigId: createApertureStableDigest(jsonSafeValue(config)).hash,
        appMode: "headless",
        packageVersions: {
            "@aperture-engine/app": APERTURE_SESSION_SNAPSHOT_APP_VERSION,
        },
        systemModules: (options.systems ?? []).map(systemModuleManifestEntry),
        worldOptions: jsonSafeValue(options.worldOptions ?? {}),
        ...(fixedStepOptions === undefined
            ? {}
            : { fixedStepOptions: jsonSafeValue(fixedStepOptions) }),
        ...(options.physics === undefined
            ? {}
            : { physics: jsonSafeValue(options.physics) }),
        ...(options.startOptions === undefined
            ? {}
            : { startOptions: jsonSafeValue(options.startOptions) }),
        assetLoader: {
            kind: options.assetLoader === undefined ? "default" : "provided",
        },
        limitations: [
            "Only systems with snapshotState()/restoreState() hooks serialize private instance fields in SessionSnapshot v1.",
            "Physics backend state is rebuilt from ECS authoring state.",
            "Live callbacks, promises, DOM handles, GPU objects, and backend-native physics handles are not serialized.",
        ],
    };
}
function systemModuleManifestEntry(moduleValue, index) {
    const System = moduleValue.default;
    const prototype = System === undefined
        ? null
        : System.prototype;
    const priority = System?.aperture?.schedule.priority !== undefined &&
        Number.isFinite(System.aperture.schedule.priority)
        ? System.aperture.schedule.priority
        : null;
    return {
        index,
        moduleId: System?.name || `system:${index}`,
        exportName: "default",
        className: System?.name ?? null,
        priority,
        hasSnapshotState: typeof prototype?.snapshotState === "function",
        hasRestoreState: typeof prototype?.restoreState === "function",
        hasAfterRestore: typeof prototype?.afterRestore === "function",
        ...(moduleValue.configData === undefined
            ? {}
            : { configData: jsonSafeValue(moduleValue.configData) }),
    };
}
function createSessionComponentRegistryManifest(world) {
    return {
        ids: [...componentRegistryFromWorld(world).ids].sort(),
    };
}
function serializeSessionResources(summary) {
    return summary.entries.map((entry) => ({
        id: entry.id,
        version: entry.version,
        fields: entry.fields.map((field) => ({ ...field })),
        values: jsonSafeValue(entry.values),
    }));
}
function serializeSessionSignals(config, summary) {
    const descriptors = config.signals ?? {};
    return Object.entries(summary)
        .map(([name, value]) => ({
        name,
        kind: descriptors[name]?.kind ?? "unknown",
        value: jsonSafeValue(value),
    }))
        .sort((a, b) => a.name.localeCompare(b.name));
}
function restoreApertureSessionSnapshotIntoRunner(snapshot, target) {
    assertSupportedSessionSnapshot(snapshot);
    destroyActiveEntities(target.app.lowLevel.world);
    // Pre-register every component the saving world knew about (#64): user
    // components are registered lazily (first addComponent/query), so a freshly
    // booted restore world may not have them yet and loadScene would skip their
    // records as `unregisteredComponent`. Module-scope defineComponent
    // singletons are recorded in the process-global registry, so the manifest
    // ids resolve back to the live component objects.
    for (const id of snapshot.simulation.componentRegistry.ids) {
        const component = findDefinedComponent(id);
        if (component !== undefined) {
            target.app.lowLevel.world.registerComponent(component);
        }
    }
    const scene = loadScene(target.app.lowLevel.world, snapshot.simulation.scene, {
        registry: componentRegistryFromWorld(target.app.lowLevel.world),
    });
    const sourceAssets = mirrorSourceAssetRegistryFromMessage(target.app.lowLevel.assets, {
        sourceAssets: decodeTypedArrayTree(snapshot.simulation.sourceAssets),
    });
    const resources = restoreSessionResources(target.app.context.resources, snapshot.simulation.resources);
    const signals = restoreSessionSignals(target.app.context.signals, snapshot.simulation.signals);
    const randomState = sessionRandomState(snapshot);
    const randomRestored = randomState === null
        ? false
        : restoreApertureRandom(target.app.context.random, randomState);
    const fixedStepClockRestored = target.app.restoreFixedStepClock(sessionFixedStepClockState(snapshot));
    restoreApertureFrameTime(target.app.context.time, snapshot.runtime.time);
    // The extraction app tracks its own extract-time seeded by step(); restore
    // replaces simulation time without stepping, so prime it here or the first
    // post-restore extract stamps time 0 into the snapshot.
    target.app.lowLevel.primeExtractionTime(snapshot.runtime.time.elapsed);
    const systems = restoreSessionSystemStates(target.app, snapshot.runtime.systems, snapshot.simulation.scene, scene.entities);
    target.setNextFrame(sessionFrame(snapshot));
    target.setLastSnapshot(null);
    return {
        ok: scene.ok &&
            resources.missing.length === 0 &&
            signals.missing.length === 0 &&
            (randomState === null || randomRestored) &&
            fixedStepClockRestored &&
            systems.missing.length === 0,
        scene,
        sourceAssets,
        resources,
        signals,
        random: { restored: randomRestored },
        fixedStepClock: { restored: fixedStepClockRestored },
        systems,
    };
}
export function assertSupportedSessionSnapshot(snapshot) {
    if (snapshot.format !== APERTURE_SESSION_SNAPSHOT_FORMAT ||
        snapshot.version !== APERTURE_SESSION_SNAPSHOT_VERSION) {
        throw new ApertureAppError({
            code: "aperture.session.unsupportedSnapshot",
            message: `Unsupported Aperture session snapshot '${String(snapshot.format)}' version ${String(snapshot.version)}.`,
            suggestedFix: "Restore a session snapshot written by the same Aperture version.",
        });
    }
}
function destroyActiveEntities(world) {
    const manager = world.entityManager;
    const entities = [];
    const count = manager.entityIndex ?? 0;
    for (let index = 0; index < count; index += 1) {
        const entity = manager.getEntityByIndex(index);
        if (entity !== null) {
            entities.push(entity);
        }
    }
    const activeEntities = entities
        .filter((entity) => entity.active)
        .sort((a, b) => b.index - a.index || b.generation - a.generation);
    for (const entity of activeEntities) {
        entity.destroy();
    }
}
function restoreSessionResources(resources, snapshotResources) {
    let restored = 0;
    const missing = [];
    for (const entry of sessionResourceEntries(snapshotResources)) {
        let patched = resources.patchById(entry.id, entry.values);
        if (patched === null) {
            // The owning system hasn't touched the store yet this session, so the
            // entry doesn't exist. Materialize it from the module-scope descriptor
            // recorded at defineResource time, then apply the snapshot values (#64).
            const descriptor = findDefinedResource(entry.id);
            if (descriptor !== undefined) {
                resources.reset(descriptor);
                patched = resources.patchById(entry.id, entry.values);
            }
        }
        if (patched === null) {
            missing.push(entry.id);
        }
        else {
            restored += 1;
        }
    }
    return { restored, missing };
}
function restoreSessionSignals(signals, snapshotSignals) {
    let restored = 0;
    const missing = [];
    for (const entry of sessionSignalEntries(snapshotSignals)) {
        const signal = signals[entry.name];
        if (signal === undefined) {
            missing.push(entry.name);
        }
        else {
            signal.value = entry.value;
            restored += 1;
        }
    }
    return { restored, missing };
}
function sessionResourceEntries(value) {
    if (Array.isArray(value)) {
        return value;
    }
    return value.entries;
}
function sessionSignalEntries(value) {
    if (Array.isArray(value)) {
        return value;
    }
    return Object.entries(value)
        .map(([name, signalValue]) => ({
        name,
        kind: "unknown",
        value: signalValue,
    }))
        .sort((a, b) => a.name.localeCompare(b.name));
}
function sessionFrame(snapshot) {
    const runtime = snapshot.runtime;
    if (typeof runtime.nextFrame === "number" &&
        Number.isInteger(runtime.nextFrame)) {
        return runtime.nextFrame;
    }
    if (typeof runtime.frame === "number" && Number.isInteger(runtime.frame)) {
        return runtime.frame;
    }
    return 0;
}
function sessionRandomState(snapshot) {
    const runtime = snapshot.runtime;
    if (runtime.random !== null && runtime.random !== undefined) {
        return runtime.random;
    }
    return (runtime.randomStreams?.find((stream) => stream.id === "default")?.state ??
        null);
}
function sessionFixedStepClockState(snapshot) {
    const runtime = snapshot.runtime;
    return runtime.fixedStepClock ?? null;
}
function snapshotSessionSystemStates(app) {
    const systems = app.lowLevel.world.getSystems();
    const entries = [];
    systems.forEach((system, index) => {
        if (!isApertureSystemInstance(system)) {
            return;
        }
        const payload = system.snapshotState?.({
            world: app.lowLevel.world,
            context: app.context,
        });
        if (payload === undefined) {
            return;
        }
        entries.push({
            system: systemName(system, index),
            index,
            version: 1,
            payload: encodeSystemStatePayload(payload, systemName(system, index)),
        });
    });
    return entries;
}
function restoreSessionSystemStates(app, entries, scene, loadedEntities) {
    const systems = app.lowLevel.world.getSystems();
    const missing = [];
    let restored = 0;
    let afterRestore = 0;
    const restoreContext = {
        world: app.lowLevel.world,
        context: app.context,
    };
    const remapEntityRef = createSessionEntityRemapper(scene, loadedEntities);
    for (const entry of entries) {
        const system = systems[entry.index];
        const label = `${entry.system}#${entry.index}`;
        if (entry.version !== 1) {
            missing.push(`${label}:unsupported-version-${entry.version}`);
            continue;
        }
        if (!isApertureSystemInstance(system) ||
            systemName(system, entry.index) !== entry.system ||
            typeof system.restoreState !== "function") {
            missing.push(label);
            continue;
        }
        system.restoreState(decodeTypedArrayTree(entry.payload), restoreContext, remapEntityRef);
        restored += 1;
    }
    systems.forEach((system) => {
        if (!isApertureSystemInstance(system) ||
            typeof system.afterRestore !== "function") {
            return;
        }
        system.afterRestore(restoreContext);
        afterRestore += 1;
    });
    return { restored, missing, afterRestore };
}
function encodeSystemStatePayload(payload, system) {
    const encoded = encodeTypedArrayTree(payload);
    try {
        JSON.stringify(encoded);
    }
    catch (error) {
        throw new ApertureAppError({
            code: "aperture.session.invalidSystemState",
            message: `System '${system}' returned a non-serializable SessionSnapshot state payload.`,
            suggestedFix: "Return JSON-safe state from snapshotState(); do not include functions, promises, DOM/GPU objects, or cyclic references.",
            detail: {
                system,
                error: error instanceof Error ? error.message : String(error),
            },
        });
    }
    return encoded;
}
function encodeSessionInspection(inspection) {
    return inspection.renderBundle === undefined
        ? {}
        : { renderBundle: encodeTypedArrayTree(inspection.renderBundle) };
}
function createSessionEntityRemapper(scene, loadedEntities) {
    const bySerializedRef = new Map();
    scene.entities.forEach((record, index) => {
        const entity = loadedEntities[index];
        if (entity !== undefined) {
            bySerializedRef.set(record.id, entity);
        }
    });
    return (oldEntityRef) => {
        const serialized = typeof oldEntityRef === "string"
            ? oldEntityRef
            : serializeEntityRef(oldEntityRef);
        return bySerializedRef.get(serialized);
    };
}
function isApertureSystemInstance(value) {
    return (typeof value === "object" &&
        value !== null &&
        "world" in value &&
        "update" in value);
}
function systemName(system, index) {
    return (system.constructor.name ||
        `ApertureSystem${index}`);
}
function snapshotCounts(snapshot) {
    return {
        views: snapshot.views.length,
        meshDraws: snapshot.meshDraws.length,
        lights: snapshot.lights.length,
        bounds: snapshot.bounds.length,
        diagnostics: snapshot.diagnostics.length,
    };
}
function stableJsonStringify(value) {
    if (value === undefined) {
        return "null";
    }
    if (value === null || typeof value !== "object") {
        return JSON.stringify(value) ?? "null";
    }
    if (ArrayBuffer.isView(value)) {
        return stableJsonStringify(Array.from(new Uint8Array(value.buffer, value.byteOffset, value.byteLength)));
    }
    if (Array.isArray(value)) {
        return `[${value.map((item) => stableJsonStringify(item)).join(",")}]`;
    }
    const entries = Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries
        .map(([key, item]) => `${JSON.stringify(key)}:${stableJsonStringify(item)}`)
        .join(",")}}`;
}
function fnv1a32(value) {
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
}
//# sourceMappingURL=headless.js.map