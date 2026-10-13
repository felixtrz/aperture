import { createWebGpuFeatureCommandGroupsFromCommands, } from "./feature-command-groups.js";
import { emptyParticleFrameReport, prepareParticleFrameResourcesForSnapshot, } from "./particles.js";
import { renderSnapshotTimeSeconds } from "./snapshot.js";
import { prepareUiFrameResourcesForSnapshot, snapshotHasUiFrameWork, } from "./ui.js";
/**
 * Reserved overlay ordinals for the built-in feature realizers. Overlay
 * command groups render in ascending ordinal order, so third-party realizers
 * slot themselves relative to these values: below `particles` renders under
 * both built-ins, between `particles` and `ui` renders above particles but
 * under UI, and above `ui` renders on top of everything.
 */
export const BUILT_IN_OVERLAY_ORDINALS = Object.freeze({
    particles: 1_000,
    ui: 2_000,
});
/**
 * Registers the built-in particle and UI realizers. Called once per resource
 * cache at creation time so user registrations can never race the built-ins:
 * a later `registerFeatureRealizer` with a built-in id fails synchronously
 * with the registry's duplicate-id error.
 */
export function registerBuiltInWebGpuFeatureRealizers(cache) {
    const registry = cache.featureRealizers;
    registry.register({
        id: "particles",
        packetFamilies: ["particleEmitters"],
        async prepareFrame(input) {
            const particleFrame = await prepareParticleFrameResourcesForSnapshot({
                app: input.app,
                assets: input.assets,
                cache,
                snapshot: input.snapshot,
                viewUniforms: input.viewUniforms,
                reuse: input.reuse,
                time: renderSnapshotTimeSeconds(input.snapshot),
            });
            return {
                valid: particleFrame.valid,
                commandGroups: [
                    ...(particleFrame.commands.length === 0
                        ? []
                        : createWebGpuFeatureCommandGroupsFromCommands({
                            featureId: "particles",
                            phase: "transparent",
                            commands: particleFrame.commands,
                            sortKeys: particleEmitterRenderSortKeys(input.snapshot),
                        })),
                    {
                        featureId: "particles",
                        phase: "overlay",
                        ordinal: BUILT_IN_OVERLAY_ORDINALS.particles,
                        commands: particleFrame.overlayCommands,
                    },
                ],
                diagnostics: particleFrame.diagnostics,
                report: particleFrame.report,
            };
        },
    });
    registry.register({
        id: "ui",
        packetFamilies: ["uiNodes", "uiHitRegions"],
        async prepareFrame(input) {
            if (!snapshotHasUiFrameWork(input.snapshot)) {
                return { valid: true, commandGroups: [] };
            }
            const uiFrame = await prepareUiFrameResourcesForSnapshot({
                app: input.app,
                assets: input.assets,
                cache,
                snapshot: input.snapshot,
                viewUniforms: input.viewUniforms,
                reuse: input.reuse,
            });
            return {
                valid: uiFrame.valid,
                commandGroups: [
                    {
                        featureId: "ui",
                        phase: "overlay",
                        ordinal: BUILT_IN_OVERLAY_ORDINALS.ui,
                        commands: uiFrame.commands,
                    },
                ],
                diagnostics: uiFrame.diagnostics,
            };
        },
    });
}
export async function prepareWebGpuFeatureFrameResources(options) {
    const registry = options.cache
        .featureRealizers;
    return registry.prepareFrame({
        app: options.app,
        assets: options.assets,
        snapshot: options.snapshot,
        viewUniforms: options.viewUniforms,
        reuse: options.reuse,
    });
}
/** Typed accessor for the built-in particle realizer's per-frame report. */
export function webGpuParticleFrameReport(frame) {
    return (frame.reports.get("particles") ??
        emptyParticleFrameReport());
}
/**
 * Per-feature reports as the render report's generic `features` section, or
 * undefined when no realizer reported anything this frame.
 */
export function webGpuFeatureReports(frame) {
    return frame.reports.size === 0
        ? undefined
        : Object.fromEntries(frame.reports);
}
function particleEmitterRenderSortKeys(snapshot) {
    const sortKeys = new Map();
    for (const emitter of snapshot.particleEmitters ?? []) {
        sortKeys.set(emitter.emitterId, emitter.sortKey);
    }
    return sortKeys;
}
//# sourceMappingURL=built-in-feature-realizers.js.map