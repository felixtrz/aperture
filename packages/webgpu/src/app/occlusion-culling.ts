import type {
  GpuOcclusionFeedbackCullingPlan,
  GpuOcclusionFeedbackFallbackReason,
} from "../gpu/occlusion-query.js";
import type { RenderPassCommand } from "../render/passes/render-pass-commands.js";

export interface WebGpuAppOcclusionCullingReport {
  queryCandidateDraws: number;
  queriedDraws: number;
  skippedFromQuery: number;
  readonly skippedRenderIds: number[];
  forcedProbeDraws: number;
  readonly forcedProbeRenderIds: number[];
  fallbackReason: GpuOcclusionFeedbackFallbackReason | null;
}

export function createWebGpuAppOcclusionCullingReport(): WebGpuAppOcclusionCullingReport {
  return {
    queryCandidateDraws: 0,
    queriedDraws: 0,
    skippedFromQuery: 0,
    skippedRenderIds: [],
    forcedProbeDraws: 0,
    forcedProbeRenderIds: [],
    fallbackReason: null,
  };
}

export function appendWebGpuAppOcclusionCullingPlan(
  report: WebGpuAppOcclusionCullingReport,
  plan: GpuOcclusionFeedbackCullingPlan,
): void {
  report.queryCandidateDraws += plan.candidateDraws;
  report.skippedFromQuery += plan.skippedRenderIds.length;
  report.skippedRenderIds.push(...plan.skippedRenderIds);
  report.forcedProbeDraws += plan.forcedProbeRenderIds.length;
  report.forcedProbeRenderIds.push(...plan.forcedProbeRenderIds);

  if (plan.fallbackReason !== null) {
    recordWebGpuAppOcclusionCullingFallback(report, plan.fallbackReason);
  }
}

export function recordWebGpuAppOcclusionCullingFallback(
  report: WebGpuAppOcclusionCullingReport,
  fallbackReason: GpuOcclusionFeedbackFallbackReason,
): void {
  if (
    report.fallbackReason === null ||
    fallbackReason === "unsupported" ||
    report.fallbackReason !== "unsupported"
  ) {
    report.fallbackReason = fallbackReason;
  }
}

export function collectOcclusionQueryRenderIds(
  commands: readonly RenderPassCommand[],
): readonly number[] {
  const renderIds: number[] = [];

  for (const command of commands) {
    if (command.kind === "beginOcclusionQuery") {
      renderIds.push(command.renderId);
    }
  }

  return renderIds;
}

export function commandsWithoutSkippedOcclusionDraws(
  commands: readonly RenderPassCommand[],
  skippedRenderIds: readonly number[],
  target: RenderPassCommand[],
): readonly RenderPassCommand[] {
  if (skippedRenderIds.length === 0) {
    return commands;
  }

  const skipped = new Set(skippedRenderIds);
  target.length = 0;

  for (const command of commands) {
    if (
      skipped.has(command.renderId) &&
      (isRenderPassOcclusionQueryCommand(command) ||
        isRenderPassDrawCommand(command))
    ) {
      continue;
    }

    target.push(command);
  }

  return target;
}

export function commandsWithoutOcclusionQueryCommands(
  commands: readonly RenderPassCommand[],
  target?: RenderPassCommand[],
): readonly RenderPassCommand[] {
  if (!commands.some(isRenderPassOcclusionQueryCommand)) {
    return commands;
  }

  if (target === undefined) {
    return commands.filter(
      (command) => !isRenderPassOcclusionQueryCommand(command),
    );
  }

  target.length = 0;

  for (const command of commands) {
    if (!isRenderPassOcclusionQueryCommand(command)) {
      target.push(command);
    }
  }

  return target;
}

export function normalizeOcclusionQueryCommands(
  commands: readonly RenderPassCommand[],
): readonly number[] {
  const renderIds: number[] = [];
  let queryIndex = 0;
  let activeQueryIndex = -1;

  for (const command of commands) {
    if (command.kind === "beginOcclusionQuery") {
      (command as { queryIndex: number }).queryIndex = queryIndex;
      activeQueryIndex = queryIndex;
      renderIds.push(command.renderId);
      queryIndex += 1;
      continue;
    }

    if (command.kind === "endOcclusionQuery") {
      (command as { queryIndex: number }).queryIndex =
        activeQueryIndex >= 0 ? activeQueryIndex : Math.max(0, queryIndex - 1);
      activeQueryIndex = -1;
    }
  }

  return renderIds;
}

function isRenderPassOcclusionQueryCommand(
  command: RenderPassCommand,
): boolean {
  return (
    command.kind === "beginOcclusionQuery" ||
    command.kind === "endOcclusionQuery"
  );
}

export function isRenderPassDrawCommand(command: RenderPassCommand): boolean {
  return (
    command.kind === "draw" ||
    command.kind === "drawIndexed" ||
    command.kind === "drawIndirect" ||
    command.kind === "drawIndexedIndirect"
  );
}
