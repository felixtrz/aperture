import type { AssetRegistry } from "@aperture-engine/simulation";
import type { PackedSnapshotViewUniforms, RenderSnapshot } from "@aperture-engine/render";
import { type WebGpuFeatureRegistryFrameResult } from "./feature-command-groups.js";
import { type ParticleFrameReport } from "./particles.js";
import type { WebGpuAppResourceCache } from "./resource-cache.js";
import type { WebGpuApp, WebGpuAppResourceReuseReport } from "./app.js";
/**
 * Reserved overlay ordinals for the built-in feature realizers. Overlay
 * command groups render in ascending ordinal order, so third-party realizers
 * slot themselves relative to these values: below `particles` renders under
 * both built-ins, between `particles` and `ui` renders above particles but
 * under UI, and above `ui` renders on top of everything.
 */
export declare const BUILT_IN_OVERLAY_ORDINALS: Readonly<{
    particles: 1000;
    ui: 2000;
}>;
/**
 * Registers the built-in particle and UI realizers. Called once per resource
 * cache at creation time so user registrations can never race the built-ins:
 * a later `registerFeatureRealizer` with a built-in id fails synchronously
 * with the registry's duplicate-id error.
 */
export declare function registerBuiltInWebGpuFeatureRealizers(cache: WebGpuAppResourceCache): void;
export declare function prepareWebGpuFeatureFrameResources(options: {
    readonly app: WebGpuApp;
    readonly assets: AssetRegistry;
    readonly cache: WebGpuAppResourceCache;
    readonly snapshot: RenderSnapshot;
    readonly viewUniforms: PackedSnapshotViewUniforms;
    readonly reuse: WebGpuAppResourceReuseReport;
}): Promise<WebGpuFeatureRegistryFrameResult>;
/** Typed accessor for the built-in particle realizer's per-frame report. */
export declare function webGpuParticleFrameReport(frame: WebGpuFeatureRegistryFrameResult): ParticleFrameReport;
/**
 * Per-feature reports as the render report's generic `features` section, or
 * undefined when no realizer reported anything this frame.
 */
export declare function webGpuFeatureReports(frame: WebGpuFeatureRegistryFrameResult): Readonly<Record<string, unknown>> | undefined;
//# sourceMappingURL=built-in-feature-realizers.d.ts.map