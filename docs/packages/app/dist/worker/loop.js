import { SIMULATION_WORKER_PROTOCOL, } from "@aperture-engine/runtime";
import { createApertureApp, } from "../advanced.js";
import { createDefaultSystemGltfAssetDecoderProvider } from "../systems.js";
import { createSourceAssetSerializationState } from "../asset-mirror.js";
import { errorToApertureDiagnostic } from "../diagnostics.js";
import { createGeneratedDevtoolsBridge, } from "./devtools/bridge.js";
import { createGeneratedWorkerSnapshotTransport, createGeneratedWorkerSummaryCadence, publishGeneratedWorkerSnapshot, } from "./snapshot.js";
export async function runGeneratedWorkerLoop(options) {
    try {
        const workerAssetDecoders = readWorkerAssetDecoderOptions(options.start);
        const fixedStep = readWorkerFixedStepOptions(options.start);
        const physicsInterpolation = readWorkerPhysicsInterpolationOption(options.start);
        const snapshotTransport = createGeneratedWorkerSnapshotTransport(options.start);
        const decoderBaseUrl = workerAssetDecoders?.baseUrl ?? options.config.assetDecoders?.baseUrl;
        const physicsOption = resolveConfigPhysicsOption(options.config.physics);
        const app = await createApertureApp({
            config: options.config,
            systems: options.systems,
            gltfAssetDecoders: createDefaultSystemGltfAssetDecoderProvider({
                ...(decoderBaseUrl === undefined ? {} : { baseUrl: decoderBaseUrl }),
                ...(workerAssetDecoders?.ktx2TextureCompression === undefined
                    ? {}
                    : {
                        ktx2TextureCompression: workerAssetDecoders.ktx2TextureCompression,
                    }),
            }),
            worldOptions: options.start.entityCapacity === undefined
                ? undefined
                : { entityCapacity: options.start.entityCapacity },
            ...(fixedStep === undefined ? {} : { fixedStep }),
            ...(physicsInterpolation === undefined ? {} : { physicsInterpolation }),
            ...(physicsOption === undefined ? {} : { physics: physicsOption }),
            startOptions: options.start,
        });
        // Legacy bridge: keep the raw `start` options visible on world globals for
        // older apps. New app systems should use the filtered public
        // `this.startOptions` accessor installed on ApertureSystemContext.
        publishWorkerStartOptions(app.lowLevel.world, options.start);
        const entityTools = options.createEntityTools(app.lowLevel.world);
        const sourceAssetState = createSourceAssetSerializationState();
        const workerFullSummaryIntervalMilliseconds = readWorkerFullSummaryIntervalMilliseconds(options.start);
        const workerSummaryCadence = createGeneratedWorkerSummaryCadence(workerFullSummaryIntervalMilliseconds === undefined
            ? {}
            : { intervalMilliseconds: workerFullSummaryIntervalMilliseconds });
        let frame = 0;
        let running = true;
        let paused = readWorkerInitialPaused(options.start);
        let tickScheduled = false;
        let previousTime = performance.now();
        const pendingDevtoolsInput = [];
        let previousPublishTiming = null;
        const tickScheduler = createGeneratedWorkerTickScheduler({
            tickRateHz: readWorkerTickRateHz(options.start),
        });
        const publishSnapshot = (delta, time) => {
            const immediateInputEvents = pendingDevtoolsInput.splice(0);
            const report = publishGeneratedWorkerSnapshot({
                app,
                config: options.config,
                port: options.port,
                transport: snapshotTransport,
                pendingInput: options.pendingInput,
                immediateInputEvents,
                sourceAssetState,
                entityTools,
                summaryCadence: workerSummaryCadence,
                delta,
                time,
                frame,
                previousPublishTiming,
            });
            frame = report.nextFrame;
            previousPublishTiming = report.timing;
            return report;
        };
        const devtools = createGeneratedDevtoolsBridge({
            app,
            entityTools,
            port: options.port,
            enqueueInputEvent(event) {
                pendingDevtoolsInput.push(event);
            },
            setPaused(nextPaused) {
                const wasPaused = paused;
                paused = nextPaused;
                if (wasPaused && !paused) {
                    previousTime = performance.now();
                    scheduleTick();
                }
            },
            step(delta) {
                paused = true;
                const now = performance.now();
                previousTime = now;
                const report = publishSnapshot(delta, now / 1000);
                return {
                    paused,
                    frame,
                    fixedStep: report.step.fixedStep,
                    physics: app.context.physics.summary(),
                };
            },
            getSimulationState() {
                return { paused, running, frame };
            },
        });
        options.setApp(app, entityTools, devtools);
        const reportRuntimeFailure = (error) => {
            const diagnostic = errorToApertureDiagnostic(error, {
                code: "aperture.generatedWorker.tickFailed",
                severity: "error",
                message: "Generated Aperture simulation worker threw during a frame tick.",
                suggestedFix: "Inspect the throwing app system or per-frame asset update, then restart the generated app.",
                source: { worker: "generated-simulation" },
            });
            options.port.postMessage({
                type: SIMULATION_WORKER_PROTOCOL.error,
                reason: diagnostic.code,
                message: diagnostic.message,
                diagnostics: [diagnostic],
            });
        };
        function scheduleTick() {
            if (!running || paused || tickScheduled) {
                return;
            }
            tickScheduled = true;
            tickScheduler.schedule(tick);
        }
        function tick() {
            tickScheduled = false;
            if (!running) {
                tickScheduler.dispose();
                return;
            }
            try {
                if (paused) {
                    return;
                }
                const now = performance.now();
                const delta = Math.max(0, (now - previousTime) / 1000);
                previousTime = now;
                publishSnapshot(delta, now / 1000);
            }
            catch (error) {
                // A steady-state tick failure is otherwise uncaught (the reschedule
                // below never runs and the scheduler callback swallows it), leaving the
                // simulation frozen with no signal. Halt the loop and surface the
                // failure to the main thread instead.
                running = false;
                tickScheduler.dispose();
                reportRuntimeFailure(error);
                return;
            }
            scheduleTick();
        }
        options.port.postMessage({ type: SIMULATION_WORKER_PROTOCOL.ready });
        if (!paused) {
            tick();
        }
        if (typeof options.start["stop"] === "boolean" && options.start["stop"]) {
            running = false;
        }
    }
    catch (error) {
        const diagnostic = errorToApertureDiagnostic(error, {
            code: "aperture.generatedWorker.failed",
            severity: "error",
            message: "Generated Aperture simulation worker failed during startup.",
            suggestedFix: "Inspect aperture.config.ts and discovered system modules, then restart the generated app.",
            source: { worker: "generated-simulation" },
        });
        options.port.postMessage({
            type: SIMULATION_WORKER_PROTOCOL.error,
            reason: diagnostic.code,
            message: diagnostic.message,
            diagnostics: [diagnostic],
        });
    }
}
export const DEFAULT_GENERATED_WORKER_TICK_RATE_HZ = 240;
const MIN_GENERATED_WORKER_TICK_RATE_HZ = 1;
const MAX_GENERATED_WORKER_TICK_RATE_HZ = 1000;
export function createGeneratedWorkerTickScheduler(options = {}) {
    const tickRateHz = normalizeGeneratedWorkerTickRateHz(options.tickRateHz);
    const intervalMilliseconds = 1000 / tickRateHz;
    let nextTickMilliseconds = nowMilliseconds() + intervalMilliseconds;
    if (typeof MessageChannel === "function") {
        const channel = new MessageChannel();
        let pending = null;
        let timeout = null;
        let disposed = false;
        channel.port1.onmessage = () => {
            const callback = pending;
            pending = null;
            if (disposed || callback === null) {
                return;
            }
            nextTickMilliseconds = nextGeneratedWorkerTickDeadline(nextTickMilliseconds, intervalMilliseconds);
            callback?.();
        };
        channel.port1.start?.();
        return {
            schedule(callback) {
                if (disposed) {
                    return;
                }
                const delayMilliseconds = Math.max(0, nextTickMilliseconds - nowMilliseconds());
                const postCallback = () => {
                    timeout = null;
                    if (disposed) {
                        return;
                    }
                    pending = callback;
                    channel.port2.postMessage(null);
                };
                if (delayMilliseconds > 0.25) {
                    timeout = setTimeout(postCallback, delayMilliseconds);
                }
                else {
                    postCallback();
                }
            },
            dispose() {
                disposed = true;
                pending = null;
                if (timeout !== null) {
                    clearTimeout(timeout);
                    timeout = null;
                }
                channel.port1.close();
                channel.port2.close();
            },
        };
    }
    let timeout = null;
    return {
        schedule(callback) {
            const delayMilliseconds = Math.max(0, nextTickMilliseconds - nowMilliseconds());
            timeout = setTimeout(() => {
                timeout = null;
                nextTickMilliseconds = nextGeneratedWorkerTickDeadline(nextTickMilliseconds, intervalMilliseconds);
                callback();
            }, delayMilliseconds);
        },
        dispose() {
            if (timeout !== null) {
                clearTimeout(timeout);
                timeout = null;
            }
        },
    };
}
function nextGeneratedWorkerTickDeadline(previousDeadlineMilliseconds, intervalMilliseconds) {
    const now = nowMilliseconds();
    const next = previousDeadlineMilliseconds + intervalMilliseconds;
    return now - next > intervalMilliseconds * 4
        ? now + intervalMilliseconds
        : next;
}
function readWorkerTickRateHz(start) {
    return normalizeGeneratedWorkerTickRateHz(start["workerTickRateHz"]);
}
function readWorkerInitialPaused(start) {
    const value = start["simulationPaused"];
    return value === true || value === "true";
}
function readWorkerFullSummaryIntervalMilliseconds(start) {
    const value = start["workerFullSummaryIntervalMilliseconds"];
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
        return value;
    }
    if (typeof value === "string" && value.trim().length > 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
    }
    return undefined;
}
function normalizeGeneratedWorkerTickRateHz(value) {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        return DEFAULT_GENERATED_WORKER_TICK_RATE_HZ;
    }
    return Math.min(MAX_GENERATED_WORKER_TICK_RATE_HZ, Math.max(MIN_GENERATED_WORKER_TICK_RATE_HZ, Math.floor(value)));
}
function nowMilliseconds() {
    return typeof performance === "undefined" ||
        typeof performance.now !== "function"
        ? Date.now()
        : performance.now();
}
/**
 * Legacy globals key under which raw simulation-worker start options are
 * published on the ECS world. Prefer `this.startOptions` in app systems; this
 * remains for old callers that reached into world globals directly.
 */
export const APERTURE_WORKER_START_OPTIONS_KEY = "aperture.workerStartOptions";
function publishWorkerStartOptions(world, start) {
    const globals = world.globals;
    if (globals !== undefined) {
        globals[APERTURE_WORKER_START_OPTIONS_KEY] = start;
    }
}
function readWorkerFixedStepOptions(start) {
    const value = start.fixedStep;
    if (value === undefined) {
        return undefined;
    }
    if (value === false) {
        return false;
    }
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return undefined;
    }
    const record = value;
    const fixedStep = {};
    copyBooleanOption(record, fixedStep, "enabled");
    copyNumberOption(record, fixedStep, "fixedDelta");
    copyNumberOption(record, fixedStep, "maxSubsteps");
    copyNumberOption(record, fixedStep, "maxAccumulatedTime");
    return fixedStep;
}
function resolveConfigPhysicsOption(physics) {
    if (physics === undefined || physics === false) {
        return undefined;
    }
    if (physics === true) {
        return true;
    }
    if (physics.enabled === false) {
        return undefined;
    }
    return {
        ...(physics.backend === undefined ? {} : { backend: physics.backend }),
        ...(physics.gravity === undefined ? {} : { gravity: physics.gravity }),
        ...(physics.colliderGeometry === undefined
            ? {}
            : { colliderGeometry: physics.colliderGeometry }),
    };
}
function readWorkerPhysicsInterpolationOption(start) {
    const value = start.physicsInterpolation;
    if (typeof value === "boolean") {
        return value;
    }
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return undefined;
    }
    const enabled = value["enabled"];
    return typeof enabled === "boolean" ? enabled : undefined;
}
function copyBooleanOption(source, target, key) {
    const value = source[key];
    if (typeof value === "boolean") {
        target[key] = value;
    }
}
function copyNumberOption(source, target, key) {
    const value = source[key];
    if (typeof value === "number") {
        target[key] = value;
    }
}
function readWorkerAssetDecoderOptions(start) {
    const value = start.assetDecoders;
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }
    const record = value;
    const baseUrl = typeof record.baseUrl === "string" && record.baseUrl.trim().length > 0
        ? record.baseUrl
        : undefined;
    const ktx2TextureCompression = readKtx2TextureCompressionSupport(record.ktx2TextureCompression);
    return {
        ...(baseUrl === undefined ? {} : { baseUrl }),
        ...(ktx2TextureCompression === null ? {} : { ktx2TextureCompression }),
    };
}
function readKtx2TextureCompressionSupport(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }
    const record = value;
    return {
        astc: record.astc === true,
        bc: record.bc === true,
        etc2: record.etc2 === true,
    };
}
//# sourceMappingURL=loop.js.map