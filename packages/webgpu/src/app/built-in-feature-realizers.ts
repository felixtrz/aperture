import type { AssetRegistry } from "@aperture-engine/simulation";
import type {
  PackedSnapshotViewUniforms,
  RenderSnapshot,
  RenderSortKey,
} from "@aperture-engine/render";
import {
  createWebGpuFeatureCommandGroupsFromCommands,
  type WebGpuFeatureRealizerRegistry,
  type WebGpuFeatureRegistryFrameResult,
} from "./feature-command-groups.js";
import {
  emptyParticleFrameReport,
  prepareParticleFrameResourcesForSnapshot,
  type ParticleFrameReport,
} from "./particles.js";
import {
  prepareDecalFrameResourcesForSnapshot,
  type DecalFrameReport,
} from "./decals.js";
import {
  prepareLineFrameResourcesForSnapshot,
  type LineFrameReport,
} from "./lines.js";
import {
  preparePointFrameResourcesForSnapshot,
  type PointFrameReport,
} from "./points.js";
import { renderSnapshotTimeSeconds } from "./snapshot.js";
import {
  prepareUiFrameResourcesForSnapshot,
  snapshotHasUiFrameWork,
} from "./ui.js";
import type { WebGpuAppResourceCache } from "./resource-cache.js";
import type {
  WebGpuApp,
  WebGpuAppFeatureRealizerInput,
  WebGpuAppResourceReuseReport,
} from "./app.js";

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
export function registerBuiltInWebGpuFeatureRealizers(
  cache: WebGpuAppResourceCache,
): void {
  const registry =
    cache.featureRealizers as WebGpuFeatureRealizerRegistry<WebGpuAppFeatureRealizerInput>;

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
    id: "decals",
    packetFamilies: ["decals"],
    async prepareFrame(input) {
      const decalFrame = await prepareDecalFrameResourcesForSnapshot({
        app: input.app,
        assets: input.assets,
        cache,
        snapshot: input.snapshot,
        viewUniforms: input.viewUniforms,
        reuse: input.reuse,
      });

      return {
        valid: decalFrame.valid,
        commandGroups:
          decalFrame.commands.length === 0
            ? []
            : createWebGpuFeatureCommandGroupsFromCommands({
                featureId: "decals",
                phase: "transparent",
                commands: decalFrame.commands,
                sortKeys: decalRenderSortKeys(input.snapshot),
              }),
        diagnostics: decalFrame.diagnostics,
        ...(decalFrame.report === undefined
          ? {}
          : { report: decalFrame.report }),
      };
    },
  });

  registry.register({
    id: "lines",
    packetFamilies: ["lines"],
    async prepareFrame(input) {
      const lineFrame = await prepareLineFrameResourcesForSnapshot({
        app: input.app,
        assets: input.assets,
        cache,
        snapshot: input.snapshot,
        viewUniforms: input.viewUniforms,
      });

      return {
        valid: lineFrame.valid,
        commandGroups:
          lineFrame.commands.length === 0
            ? []
            : createWebGpuFeatureCommandGroupsFromCommands({
                featureId: "lines",
                phase: "transparent",
                commands: lineFrame.commands,
                sortKeys: lineRenderSortKeys(input.snapshot),
              }),
        diagnostics: lineFrame.diagnostics,
        ...(lineFrame.report === undefined ? {} : { report: lineFrame.report }),
      };
    },
  });

  registry.register({
    id: "points",
    packetFamilies: ["points"],
    async prepareFrame(input) {
      const pointFrame = await preparePointFrameResourcesForSnapshot({
        app: input.app,
        assets: input.assets,
        cache,
        snapshot: input.snapshot,
        viewUniforms: input.viewUniforms,
      });

      return {
        valid: pointFrame.valid,
        commandGroups:
          pointFrame.commands.length === 0
            ? []
            : createWebGpuFeatureCommandGroupsFromCommands({
                featureId: "points",
                phase: "transparent",
                commands: pointFrame.commands,
                sortKeys: pointRenderSortKeys(input.snapshot),
              }),
        diagnostics: pointFrame.diagnostics,
        ...(pointFrame.report === undefined
          ? {}
          : { report: pointFrame.report }),
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

export async function prepareWebGpuFeatureFrameResources(options: {
  readonly app: WebGpuApp;
  readonly assets: AssetRegistry;
  readonly cache: WebGpuAppResourceCache;
  readonly snapshot: RenderSnapshot;
  readonly viewUniforms: PackedSnapshotViewUniforms;
  readonly reuse: WebGpuAppResourceReuseReport;
}): Promise<WebGpuFeatureRegistryFrameResult> {
  const registry = options.cache
    .featureRealizers as WebGpuFeatureRealizerRegistry<WebGpuAppFeatureRealizerInput>;

  return registry.prepareFrame({
    app: options.app,
    assets: options.assets,
    snapshot: options.snapshot,
    viewUniforms: options.viewUniforms,
    reuse: options.reuse,
  });
}

/** Typed accessor for the built-in particle realizer's per-frame report. */
export function webGpuParticleFrameReport(
  frame: WebGpuFeatureRegistryFrameResult,
): ParticleFrameReport {
  return (
    (frame.reports.get("particles") as ParticleFrameReport | undefined) ??
    emptyParticleFrameReport()
  );
}

/**
 * Per-feature reports as the render report's generic `features` section, or
 * undefined when no realizer reported anything this frame.
 */
export function webGpuFeatureReports(
  frame: WebGpuFeatureRegistryFrameResult,
): Readonly<Record<string, unknown>> | undefined {
  return frame.reports.size === 0
    ? undefined
    : Object.fromEntries(frame.reports);
}

function particleEmitterRenderSortKeys(
  snapshot: RenderSnapshot,
): ReadonlyMap<number, RenderSortKey> {
  const sortKeys = new Map<number, RenderSortKey>();

  for (const emitter of snapshot.particleEmitters ?? []) {
    sortKeys.set(emitter.emitterId, emitter.sortKey);
  }

  return sortKeys;
}

function decalRenderSortKeys(
  snapshot: RenderSnapshot,
): ReadonlyMap<number, RenderSortKey> {
  const sortKeys = new Map<number, RenderSortKey>();

  for (const decal of snapshot.decals ?? []) {
    sortKeys.set(decal.renderId, decal.sortKey);
  }

  return sortKeys;
}

function lineRenderSortKeys(
  snapshot: RenderSnapshot,
): ReadonlyMap<number, RenderSortKey> {
  const sortKeys = new Map<number, RenderSortKey>();

  for (const line of snapshot.lines ?? []) {
    sortKeys.set(line.renderId, line.sortKey);
  }

  return sortKeys;
}

function pointRenderSortKeys(
  snapshot: RenderSnapshot,
): ReadonlyMap<number, RenderSortKey> {
  const sortKeys = new Map<number, RenderSortKey>();

  for (const cloud of snapshot.points ?? []) {
    sortKeys.set(cloud.renderId, cloud.sortKey);
  }

  return sortKeys;
}

/** Typed accessor for the built-in decal realizer's per-frame report. */
export function webGpuDecalFrameReport(
  frame: WebGpuFeatureRegistryFrameResult,
): DecalFrameReport | undefined {
  return frame.reports.get("decals") as DecalFrameReport | undefined;
}

/** Typed accessor for the built-in fat-line realizer's per-frame report. */
export function webGpuLineFrameReport(
  frame: WebGpuFeatureRegistryFrameResult,
): LineFrameReport | undefined {
  return frame.reports.get("lines") as LineFrameReport | undefined;
}

/** Typed accessor for the built-in point-cloud realizer's per-frame report. */
export function webGpuPointFrameReport(
  frame: WebGpuFeatureRegistryFrameResult,
): PointFrameReport | undefined {
  return frame.reports.get("points") as PointFrameReport | undefined;
}
