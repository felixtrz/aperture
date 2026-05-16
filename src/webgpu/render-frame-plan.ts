import type {
  MeshDrawPacket,
  PackedSnapshotTransforms,
  RenderDiagnostic,
  RenderSnapshot,
  RenderWorld,
} from "../rendering/index.js";
import { planRenderWorldDrawPackages } from "../rendering/index.js";
import {
  createDrawCommandDescriptors,
  type DrawCommandDescriptorDiagnostic,
  type DrawCommandDescriptorPlan,
} from "./draw-command.js";
import type { MeshGpuBufferResource } from "./mesh-buffer-resources.js";
import type { GetOrCreateRenderPipelineResult } from "./pipeline-cache-integration.js";
import {
  planRenderPassCommands,
  type RenderPassCommandDiagnostic,
  type RenderPassCommandPlan,
} from "./render-pass-commands.js";
import {
  planRenderPassDrawList,
  type RenderPassDrawListDiagnostic,
  type RenderPassDrawListPlan,
} from "./render-pass-draw-list.js";
import {
  resolveRenderPassResources,
  type RenderPassResourceDiagnostic,
  type ResolveRenderPassResourcesResult,
} from "./render-pass-resources.js";
import {
  planInjectedRenderFrameSnapshotResourceBindings,
  type InjectedRenderFrameSnapshotResourceBindingPlan,
} from "./renderer-frame-summary.js";
import type {
  UnlitBindGroupResource,
  UnlitBindGroupResourceDiagnostic,
} from "./unlit-bind-group.js";

export interface PlanRenderFrameFromSnapshotInput {
  readonly snapshot: RenderSnapshot;
  readonly renderWorld: RenderWorld;
  readonly transforms: PackedSnapshotTransforms;
  readonly resolveMeshResourceKey: (draw: MeshDrawPacket) => string | null;
  readonly resolveMaterialResourceKey: (draw: MeshDrawPacket) => string | null;
  readonly meshResources: readonly MeshGpuBufferResource[];
  readonly pipelines: readonly GetOrCreateRenderPipelineResult[];
  readonly bindGroups: readonly UnlitBindGroupResource[];
  readonly requiredBindGroupGroups?: readonly number[];
}

export interface RenderFramePlanCounts {
  readonly apply: {
    readonly active: number;
    readonly created: number;
    readonly updated: number;
    readonly removed: number;
  };
  readonly binding: {
    readonly planned: number;
    readonly applied: number;
    readonly ready: number;
    readonly blocked: number;
  };
  readonly draw: {
    readonly packages: number;
    readonly descriptors: number;
    readonly drawList: number;
    readonly resolved: number;
  };
  readonly command: {
    readonly commands: number;
    readonly drawCount: number;
    readonly indexedDrawCount: number;
    readonly nonIndexedDrawCount: number;
  };
}

export interface RenderFramePlanDiagnostic {
  readonly phase: string;
  readonly code: string;
  readonly message: string;
  readonly renderId?: number;
  readonly resourceKey?: string;
  readonly assetKey?: string;
  readonly entity?: RenderDiagnostic["entity"];
}

export interface RenderFramePlanSummary {
  readonly ready: boolean;
  readonly counts: RenderFramePlanCounts;
  readonly diagnostics: readonly RenderFramePlanDiagnostic[];
}

export interface PlanRenderFrameFromSnapshotResult {
  readonly apply: ReturnType<RenderWorld["applySnapshot"]>;
  readonly bindingPlan: InjectedRenderFrameSnapshotResourceBindingPlan;
  readonly bindingResults: readonly ReturnType<
    RenderWorld["updateResourceBindings"]
  >[];
  readonly readiness: ReturnType<RenderWorld["createDrawReadinessReport"]>;
  readonly packages: ReturnType<typeof planRenderWorldDrawPackages>;
  readonly drawCommands: DrawCommandDescriptorPlan;
  readonly drawList: RenderPassDrawListPlan;
  readonly resources: ResolveRenderPassResourcesResult;
  readonly commandPlan: RenderPassCommandPlan;
  readonly summary: RenderFramePlanSummary;
}

export function planRenderFrameFromSnapshot(
  input: PlanRenderFrameFromSnapshotInput,
): PlanRenderFrameFromSnapshotResult {
  const apply = input.renderWorld.applySnapshot(input.snapshot);
  const bindingPlan = planInjectedRenderFrameSnapshotResourceBindings({
    snapshot: input.snapshot,
    resolveMeshResourceKey: input.resolveMeshResourceKey,
    resolveMaterialResourceKey: input.resolveMaterialResourceKey,
  });
  const bindingResults = bindingPlan.bindings.map((binding) =>
    input.renderWorld.updateResourceBindings(binding.renderId, binding.update),
  );
  const readiness = input.renderWorld.createDrawReadinessReport();
  const packages = planRenderWorldDrawPackages(readiness, input.transforms);
  const drawCommands = createDrawCommandDescriptors(
    packages.packages,
    input.meshResources,
  );
  const drawList = planRenderPassDrawList({
    drawCommands: drawCommands.descriptors,
    pipelines: input.pipelines,
    bindGroups: input.bindGroups,
    ...(input.requiredBindGroupGroups === undefined
      ? {}
      : { requiredBindGroupGroups: input.requiredBindGroupGroups }),
  });
  const resources = resolveRenderPassResources({
    drawList: drawList.draws,
    pipelines: input.pipelines,
    bindGroups: input.bindGroups,
    meshResources: input.meshResources,
  });
  const commandPlan = planRenderPassCommands({ draws: resources.draws });
  const summary = summarizeRenderFramePlan({
    apply,
    bindingPlan,
    bindingResults,
    readiness,
    packages,
    drawCommands,
    drawList,
    resources,
    commandPlan,
  });

  return {
    apply,
    bindingPlan,
    bindingResults,
    readiness,
    packages,
    drawCommands,
    drawList,
    resources,
    commandPlan,
    summary,
  };
}

function summarizeRenderFramePlan(
  result: Omit<PlanRenderFrameFromSnapshotResult, "summary">,
): RenderFramePlanSummary {
  const diagnostics = [
    ...result.apply.diagnostics.map((diagnostic) =>
      renderDiagnostic("apply", diagnostic),
    ),
    ...result.bindingPlan.diagnostics.map((diagnostic) =>
      renderDiagnostic("binding", diagnostic),
    ),
    ...result.readiness.diagnostics.map((diagnostic) =>
      renderDiagnostic("readiness", diagnostic),
    ),
    ...result.packages.diagnostics.map((diagnostic) =>
      renderDiagnostic("packages", diagnostic),
    ),
    ...result.drawCommands.diagnostics.map((diagnostic) =>
      drawDiagnostic("descriptors", diagnostic),
    ),
    ...result.drawList.diagnostics.map((diagnostic) =>
      drawDiagnostic("draw-list", diagnostic),
    ),
    ...result.resources.diagnostics.map((diagnostic) =>
      drawDiagnostic("resources", diagnostic),
    ),
    ...result.commandPlan.diagnostics.map((diagnostic) =>
      drawDiagnostic("commands", diagnostic),
    ),
  ];
  const counts: RenderFramePlanCounts = {
    apply: {
      active: result.apply.active,
      created: result.apply.created,
      updated: result.apply.updated,
      removed: result.apply.removed,
    },
    binding: {
      planned: result.bindingPlan.bindings.length,
      applied: result.bindingResults.filter((binding) => binding.ok).length,
      ready: result.readiness.ready.length,
      blocked: result.readiness.blocked.length,
    },
    draw: {
      packages: result.packages.packages.length,
      descriptors: result.drawCommands.descriptors.length,
      drawList: result.drawList.draws.length,
      resolved: result.resources.draws.length,
    },
    command: {
      commands: result.commandPlan.commands.length,
      drawCount: result.commandPlan.drawCount,
      indexedDrawCount: result.commandPlan.indexedDrawCount,
      nonIndexedDrawCount: result.commandPlan.nonIndexedDrawCount,
    },
  };

  return {
    ready:
      diagnostics.length === 0 &&
      result.drawList.valid &&
      result.resources.valid &&
      result.commandPlan.valid,
    counts,
    diagnostics,
  };
}

function renderDiagnostic(
  phase: string,
  diagnostic: RenderDiagnostic,
): RenderFramePlanDiagnostic {
  return {
    phase,
    code: diagnostic.code,
    message: diagnostic.message,
    ...(diagnostic.assetKey === undefined
      ? {}
      : { assetKey: diagnostic.assetKey }),
    ...(diagnostic.entity === undefined ? {} : { entity: diagnostic.entity }),
  };
}

function drawDiagnostic(
  phase: string,
  diagnostic:
    | DrawCommandDescriptorDiagnostic
    | RenderPassDrawListDiagnostic
    | RenderPassResourceDiagnostic
    | RenderPassCommandDiagnostic
    | UnlitBindGroupResourceDiagnostic,
): RenderFramePlanDiagnostic {
  return {
    phase,
    code: diagnostic.code,
    message: diagnostic.message,
    ...("renderId" in diagnostic ? { renderId: diagnostic.renderId } : {}),
    ...("resourceKey" in diagnostic
      ? { resourceKey: diagnostic.resourceKey }
      : {}),
  };
}
