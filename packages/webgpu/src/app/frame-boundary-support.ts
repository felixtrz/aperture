import { type RenderSnapshotUpdateSchedule } from "@aperture-engine/render";
import {
  createGpuOcclusionQueryResources,
  type GpuOcclusionQueryDeviceLike,
  type GpuOcclusionQueryDiagnostic,
  type GpuOcclusionQueryResources,
} from "../gpu/occlusion-query.js";
import {
  createRenderBundleCommandKey,
  type RenderBundleExecutionReport,
} from "../render/draw/render-bundle.js";
import { prepareIndirectDrawCommands } from "../render/draw/indirect-draw-commands.js";
import type { FrameBoundaryAssemblyReport } from "../render/frame/frame-boundary.js";
import type { RenderPassCommand } from "../render/passes/render-pass-commands.js";
import { WEBGPU_APP_DEPTH_FORMAT } from "../resources/textures/depth-texture-resource.js";
import { toWebGpuAppJsonValue } from "./report.js";
import type { WebGpuAppFrameBoundaryTarget } from "./frame-target.js";
import type { WebGpuAppResourceCache } from "./resource-cache.js";
import type { WebGpuAppRenderBundleReport } from "./app.js";

interface WebGpuAppFrameBoundarySupportContext {
  readonly initialization: {
    readonly device: unknown;
    readonly adapter: {
      readonly features?: {
        readonly has?: (feature: string) => boolean;
      };
    };
  };
}

export function shouldUseRenderBundlesForSnapshotSchedule(
  schedule: RenderSnapshotUpdateSchedule,
): boolean {
  const meshDraws = schedule.byFamily.meshDraws.action;

  return (
    schedule.previousFrame === null ||
    meshDraws === "reuse" ||
    meshDraws === "skip"
  );
}

export function prepareWebGpuAppIndirectDrawCommands(options: {
  readonly app: WebGpuAppFrameBoundarySupportContext;
  readonly cache: WebGpuAppResourceCache;
  readonly commands: readonly RenderPassCommand[];
  readonly label: string;
}): ReturnType<typeof prepareIndirectDrawCommands> {
  return prepareIndirectDrawCommands({
    device: options.app.initialization.device as Parameters<
      typeof prepareIndirectDrawCommands
    >[0]["device"],
    cache: options.cache.indirectDraws,
    commands: options.commands,
    label: options.label,
    supportsIndirectFirstInstance:
      options.app.initialization.adapter.features?.has?.(
        "indirect-first-instance",
      ) === true,
  });
}

export function createWebGpuAppOcclusionQueryResources(options: {
  readonly app: WebGpuAppFrameBoundarySupportContext;
  readonly cache: WebGpuAppResourceCache;
  readonly label: string;
  readonly target: WebGpuAppFrameBoundaryTarget;
  readonly queryCount: number;
}): {
  readonly valid: boolean;
  readonly resources: GpuOcclusionQueryResources | null;
  readonly diagnostics: readonly GpuOcclusionQueryDiagnostic[];
} {
  const cacheKey = [
    options.label,
    options.target.renderTargetKey ?? "swapchain",
    `view:${options.target.view.viewId}`,
  ].join(":");
  const cached = options.cache.occlusionQueries.get(cacheKey);

  if (cached !== undefined && cached.queryCount >= options.queryCount) {
    return { valid: true, resources: cached, diagnostics: [] };
  }

  const created = createGpuOcclusionQueryResources({
    device: options.app.initialization.device as GpuOcclusionQueryDeviceLike,
    label: `${options.label}:occlusion:${options.target.renderTargetKey ?? "swapchain"}:${options.target.view.viewId}`,
    queryCount: options.queryCount,
  });

  if (created.resources !== null) {
    options.cache.occlusionQueries.set(cacheKey, created.resources);
  }

  return {
    valid: created.resources !== null && created.diagnostics.length === 0,
    resources: created.resources,
    diagnostics: created.diagnostics,
  };
}

export function createWebGpuAppRenderBundleCommandKey(options: {
  readonly target: WebGpuAppFrameBoundaryTarget;
  readonly descriptor: {
    readonly colorFormats: readonly string[];
    readonly depthStencilFormat: string;
    readonly sampleCount: number;
  };
  readonly commands: readonly RenderPassCommand[];
  readonly cache: Parameters<typeof createRenderBundleCommandKey>[1];
}): string {
  return createRenderBundleCommandKey(
    {
      targetKey: createWebGpuAppRenderBundleTargetKey(
        options.target,
        options.descriptor.sampleCount,
      ),
      ...options.descriptor,
      commands: options.commands,
    },
    options.cache,
  );
}

export function createWebGpuAppRenderBundleReport(
  boundaries: readonly FrameBoundaryAssemblyReport[],
): WebGpuAppRenderBundleReport | undefined {
  const reports = boundaries
    .map((boundary) => boundary.renderBundle)
    .filter((report): report is RenderBundleExecutionReport => {
      return report !== undefined && report !== null;
    });

  if (
    reports.length === 0 ||
    reports.every(
      (report) =>
        (report.status === "unsupported" || report.status === "disabled") &&
        report.diagnostics.length === 0,
    )
  ) {
    return undefined;
  }

  return {
    created: countRenderBundleStatus(reports, "created"),
    reused: countRenderBundleStatus(reports, "reused"),
    unsupported: countRenderBundleStatus(reports, "unsupported"),
    failed: countRenderBundleStatus(reports, "failed"),
    disabled: countRenderBundleStatus(reports, "disabled"),
    encodedCommands: reports.reduce(
      (total, report) => total + report.encodedCommands,
      0,
    ),
    executedBundles: reports.reduce(
      (total, report) => total + report.executedBundles,
      0,
    ),
    drawCalls: reports.reduce((total, report) => total + report.drawCalls, 0),
    cacheSize: reports.reduce(
      (max, report) => Math.max(max, report.cacheSize),
      0,
    ),
    reports: reports.map((report) => ({
      valid: report.valid,
      status: report.status,
      key: report.key,
      commandCount: report.commandCount,
      encodedCommands: report.encodedCommands,
      executedBundles: report.executedBundles,
      drawCalls: report.drawCalls,
      cacheSize: report.cacheSize,
      diagnostics: report.diagnostics.map((diagnostic) =>
        toWebGpuAppJsonValue(diagnostic),
      ),
    })),
  };
}

function createWebGpuAppRenderBundleTargetKey(
  target: WebGpuAppFrameBoundaryTarget,
  sampleCount: number,
): string {
  return [
    target.source,
    target.renderTargetKey ?? "swapchain",
    `view:${target.view.viewId}`,
    `size:${target.width}x${target.height}`,
    `color:${target.format}`,
    `depth:${WEBGPU_APP_DEPTH_FORMAT}`,
    `samples:${sampleCount}`,
  ].join("|");
}

function countRenderBundleStatus(
  reports: readonly RenderBundleExecutionReport[],
  status: RenderBundleExecutionReport["status"],
): number {
  return reports.filter((report) => report.status === status).length;
}
