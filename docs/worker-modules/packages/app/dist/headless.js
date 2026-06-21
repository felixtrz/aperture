import { ApertureAppError, createApertureApp, } from "./advanced.js";
import { defineApertureConfig } from "./config.js";
import { createApertureEntityLookup, createApertureEntityLookupSnapshot, } from "./entity-lookup.js";
import { createSignalSummary } from "./systems.js";
import { createApertureGeneratedFailureStatus, } from "./diagnostics.js";
import { createInputSummary } from "./input.js";
export async function createApertureHeadlessRunner(options) {
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
    let nextFrame = 0;
    let lastSnapshot = null;
    const entities = createApertureEntityLookup(app.lowLevel.world);
    return {
        app,
        entities,
        getStatus() {
            return createHeadlessStatus(app, nextFrame, lastSnapshot);
        },
        step(delta = 0, time = 0) {
            const frame = nextFrame;
            nextFrame += 1;
            lastSnapshot = app.stepAndExtract(delta, time, frame);
            return {
                snapshot: lastSnapshot,
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
function snapshotCounts(snapshot) {
    return {
        views: snapshot.views.length,
        meshDraws: snapshot.meshDraws.length,
        lights: snapshot.lights.length,
        bounds: snapshot.bounds.length,
        diagnostics: snapshot.diagnostics.length,
    };
}
//# sourceMappingURL=headless.js.map