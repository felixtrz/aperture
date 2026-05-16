import type {
  MeshDrawPacket,
  PackedSnapshotTransforms,
  RenderDiagnostic,
  RenderSnapshot,
  RenderWorldDrawPackagePlan,
  RenderWorldDrawPackageScratch,
  RenderWorld,
} from "@aperture-engine/render";
import {
  createRenderWorldDrawPackageScratch,
  writeRenderWorldDrawPackages,
} from "@aperture-engine/render";
import {
  createDrawCommandDescriptorScratch,
  writeDrawCommandDescriptors,
  type DrawCommandDescriptorDiagnostic,
  type DrawCommandDescriptorPlan,
  type DrawCommandDescriptorScratch,
} from "./draw-command.js";
import type { MeshGpuBufferResource } from "./mesh-buffer-resources.js";
import type { GetOrCreateRenderPipelineResult } from "./pipeline-cache-integration.js";
import {
  createRenderPassCommandScratch,
  type RenderPassCommandDiagnostic,
  type RenderPassCommandPlan,
  type RenderPassCommandScratch,
  writeRenderPassCommands,
} from "./render-pass-commands.js";
import {
  createRenderPassDrawListScratch,
  type RenderPassDrawListDiagnostic,
  type RenderPassDrawListPlan,
  type RenderPassDrawListScratch,
  writeRenderPassDrawList,
} from "./render-pass-draw-list.js";
import {
  RENDER_FRAME_PHASES,
  type RenderFramePhase,
  type RenderFramePhaseReports,
} from "./render-frame-phases.js";
import {
  createResolveRenderPassResourcesScratch,
  type RenderPassResourceDiagnostic,
  type ResolveRenderPassResourcesResult,
  type ResolveRenderPassResourcesScratch,
  writeResolveRenderPassResources,
} from "./render-pass-resources.js";
import {
  createInjectedRenderFrameSnapshotResourceBindingPlanScratch,
  writeInjectedRenderFrameSnapshotResourceBindings,
  type InjectedRenderFrameSnapshotResourceBindingPlanScratch,
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
  readonly summaryScratch?: RenderFramePlanSummaryScratch;
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
  readonly phase: RenderFramePhase;
  readonly source?: string;
  readonly code: string;
  readonly message: string;
  readonly renderId?: number;
  readonly resourceKey?: string;
  readonly assetKey?: string;
  readonly entity?: RenderDiagnostic["entity"];
}

export interface RenderFramePlanSummary {
  readonly ready: boolean;
  readonly phaseOrder: readonly RenderFramePhase[];
  readonly phases: RenderFramePhaseReports<RenderFramePlanDiagnostic>;
  readonly counts: RenderFramePlanCounts;
  readonly diagnostics: readonly RenderFramePlanDiagnostic[];
}

export interface RenderFramePlanSummaryScratch {
  readonly applyDiagnostics: RenderFramePlanDiagnostic[];
  readonly prepareDiagnostics: RenderFramePlanDiagnostic[];
  readonly queueDiagnostics: RenderFramePlanDiagnostic[];
  readonly resolveDiagnostics: RenderFramePlanDiagnostic[];
  readonly commandDiagnostics: RenderFramePlanDiagnostic[];
  readonly submitDiagnostics: RenderFramePlanDiagnostic[];
  readonly diagnostics: RenderFramePlanDiagnostic[];
  readonly counts: RenderFramePlanCounts;
  readonly queueCounts: RenderFramePhaseReports<RenderFramePlanDiagnostic>["queue"]["counts"];
  readonly submitCounts: RenderFramePhaseReports<RenderFramePlanDiagnostic>["submit"]["counts"];
  readonly phases: RenderFramePhaseReports<RenderFramePlanDiagnostic>;
  readonly summary: RenderFramePlanSummary;
}

export interface PlanRenderFrameFromSnapshotResult {
  readonly apply: ReturnType<RenderWorld["applySnapshot"]>;
  readonly bindingPlan: InjectedRenderFrameSnapshotResourceBindingPlan;
  readonly bindingResults: readonly ReturnType<
    RenderWorld["updateResourceBindings"]
  >[];
  readonly readiness: ReturnType<RenderWorld["createDrawReadinessReport"]>;
  readonly packages: RenderWorldDrawPackagePlan;
  readonly drawCommands: DrawCommandDescriptorPlan;
  readonly drawList: RenderPassDrawListPlan;
  readonly resources: ResolveRenderPassResourcesResult;
  readonly commandPlan: RenderPassCommandPlan;
  readonly summary: RenderFramePlanSummary;
}

export interface RenderFramePlanScratch {
  readonly summaryScratch: RenderFramePlanSummaryScratch;
  readonly bindingScratch: InjectedRenderFrameSnapshotResourceBindingPlanScratch;
  readonly drawPackageScratch: RenderWorldDrawPackageScratch;
  readonly drawCommandScratch: DrawCommandDescriptorScratch;
  readonly drawListScratch: RenderPassDrawListScratch;
  readonly resourcesScratch: ResolveRenderPassResourcesScratch;
  readonly commandScratch: RenderPassCommandScratch;
  readonly result: PlanRenderFrameFromSnapshotResult;
}

export type WriteRenderFrameFromSnapshotInput =
  PlanRenderFrameFromSnapshotInput & {
    readonly scratch: RenderFramePlanScratch;
  };

export function planRenderFrameFromSnapshot(
  input: PlanRenderFrameFromSnapshotInput,
): PlanRenderFrameFromSnapshotResult {
  const scratch = createRenderFramePlanScratch(input.summaryScratch);

  return writeRenderFramePlanFromSnapshot({ ...input, scratch });
}

export function createRenderFramePlanScratch(
  summaryScratch = createRenderFramePlanSummaryScratch(),
): RenderFramePlanScratch {
  return {
    summaryScratch,
    bindingScratch:
      createInjectedRenderFrameSnapshotResourceBindingPlanScratch(),
    drawPackageScratch: createRenderWorldDrawPackageScratch(),
    drawCommandScratch: createDrawCommandDescriptorScratch(),
    drawListScratch: createRenderPassDrawListScratch(),
    resourcesScratch: createResolveRenderPassResourcesScratch(),
    commandScratch: createRenderPassCommandScratch(),
    result: {
      apply: null as unknown as ReturnType<RenderWorld["applySnapshot"]>,
      bindingPlan:
        null as unknown as InjectedRenderFrameSnapshotResourceBindingPlan,
      bindingResults: [],
      readiness: null as unknown as ReturnType<
        RenderWorld["createDrawReadinessReport"]
      >,
      packages: null as unknown as RenderWorldDrawPackagePlan,
      drawCommands: null as unknown as DrawCommandDescriptorPlan,
      drawList: null as unknown as RenderPassDrawListPlan,
      resources: null as unknown as ResolveRenderPassResourcesResult,
      commandPlan: null as unknown as RenderPassCommandPlan,
      summary: summaryScratch.summary,
    },
  };
}

export function writeRenderFramePlanFromSnapshot(
  input: WriteRenderFrameFromSnapshotInput,
): PlanRenderFrameFromSnapshotResult {
  const apply = input.renderWorld.applySnapshot(input.snapshot);
  const bindingPlan = writeInjectedRenderFrameSnapshotResourceBindings(
    {
      snapshot: input.snapshot,
      resolveMeshResourceKey: input.resolveMeshResourceKey,
      resolveMaterialResourceKey: input.resolveMaterialResourceKey,
    },
    input.scratch.bindingScratch,
  );
  const bindingResults = bindingPlan.bindings.map((binding) =>
    input.renderWorld.updateResourceBindings(binding.renderId, binding.update),
  );
  const readiness = input.renderWorld.createDrawReadinessReport();
  const packages = writeRenderWorldDrawPackages(
    readiness,
    input.transforms,
    input.scratch.drawPackageScratch,
  );
  const drawCommands = writeDrawCommandDescriptors(
    packages.packages,
    input.meshResources,
    input.scratch.drawCommandScratch,
  );
  const drawList = writeRenderPassDrawList(
    {
      drawCommands: drawCommands.descriptors,
      pipelines: input.pipelines,
      bindGroups: input.bindGroups,
      ...(input.requiredBindGroupGroups === undefined
        ? {}
        : { requiredBindGroupGroups: input.requiredBindGroupGroups }),
    },
    input.scratch.drawListScratch,
  );
  const resources = writeResolveRenderPassResources(
    {
      drawList: drawList.draws,
      pipelines: input.pipelines,
      bindGroups: input.bindGroups,
      meshResources: input.meshResources,
    },
    input.scratch.resourcesScratch,
  );
  const commandPlan = writeRenderPassCommands(
    { draws: resources.draws },
    input.scratch.commandScratch,
  );
  const summary = summarizeRenderFramePlan(
    {
      apply,
      bindingPlan,
      bindingResults,
      readiness,
      packages,
      drawCommands,
      drawList,
      resources,
      commandPlan,
    },
    input.scratch.summaryScratch,
  );
  const result = input.scratch
    .result as MutablePlanRenderFrameFromSnapshotResult;

  result.apply = apply;
  result.bindingPlan = bindingPlan;
  result.bindingResults = bindingResults;
  result.readiness = readiness;
  result.packages = packages;
  result.drawCommands = drawCommands;
  result.drawList = drawList;
  result.resources = resources;
  result.commandPlan = commandPlan;
  result.summary = summary;

  return input.scratch.result;
}

export function createRenderFramePlanSummaryScratch(): RenderFramePlanSummaryScratch {
  const applyDiagnostics: RenderFramePlanDiagnostic[] = [];
  const prepareDiagnostics: RenderFramePlanDiagnostic[] = [];
  const queueDiagnostics: RenderFramePlanDiagnostic[] = [];
  const resolveDiagnostics: RenderFramePlanDiagnostic[] = [];
  const commandDiagnostics: RenderFramePlanDiagnostic[] = [];
  const submitDiagnostics: RenderFramePlanDiagnostic[] = [];
  const diagnostics: RenderFramePlanDiagnostic[] = [];
  const counts: MutableRenderFramePlanCounts = {
    apply: {
      active: 0,
      created: 0,
      updated: 0,
      removed: 0,
    },
    binding: {
      planned: 0,
      applied: 0,
      ready: 0,
      blocked: 0,
    },
    draw: {
      packages: 0,
      descriptors: 0,
      drawList: 0,
      resolved: 0,
    },
    command: {
      commands: 0,
      drawCount: 0,
      indexedDrawCount: 0,
      nonIndexedDrawCount: 0,
    },
  };
  const queueCounts: MutableRenderFramePhaseCounts = {
    ready: 0,
    blocked: 0,
    packages: 0,
  };
  const submitCounts: MutableRenderFramePhaseCounts = {
    submitted: 0,
    plannedCommands: 0,
    plannedDraws: 0,
  };
  const phases: MutableRenderFramePhaseReports<RenderFramePlanDiagnostic> = {
    apply: {
      phase: "apply",
      ready: true,
      counts: counts.apply,
      diagnostics: applyDiagnostics,
    },
    prepare: {
      phase: "prepare",
      ready: true,
      counts: counts.binding,
      diagnostics: prepareDiagnostics,
    },
    queue: {
      phase: "queue",
      ready: true,
      counts: queueCounts,
      diagnostics: queueDiagnostics,
    },
    resolve: {
      phase: "resolve",
      ready: true,
      counts: counts.draw,
      diagnostics: resolveDiagnostics,
    },
    command: {
      phase: "command",
      ready: true,
      counts: counts.command,
      diagnostics: commandDiagnostics,
    },
    submit: {
      phase: "submit",
      ready: true,
      counts: submitCounts,
      diagnostics: submitDiagnostics,
    },
  };
  const summary: MutableRenderFramePlanSummary = {
    ready: true,
    phaseOrder: RENDER_FRAME_PHASES,
    phases,
    counts,
    diagnostics,
  };

  return {
    applyDiagnostics,
    prepareDiagnostics,
    queueDiagnostics,
    resolveDiagnostics,
    commandDiagnostics,
    submitDiagnostics,
    diagnostics,
    counts,
    queueCounts,
    submitCounts,
    phases,
    summary,
  };
}

function summarizeRenderFramePlan(
  result: Omit<PlanRenderFrameFromSnapshotResult, "summary">,
  scratch = createRenderFramePlanSummaryScratch(),
): RenderFramePlanSummary {
  resetRenderFramePlanSummaryScratch(scratch);

  pushRenderDiagnostics(
    scratch.applyDiagnostics,
    "apply",
    "applySnapshot",
    result.apply.diagnostics,
  );
  pushRenderDiagnostics(
    scratch.prepareDiagnostics,
    "prepare",
    "resourceBindings",
    result.bindingPlan.diagnostics,
  );

  for (const binding of result.bindingResults) {
    if (!binding.ok) {
      pushRenderDiagnostics(
        scratch.prepareDiagnostics,
        "prepare",
        "resourceBindingUpdate",
        binding.diagnostics,
      );
    }
  }

  pushRenderDiagnostics(
    scratch.queueDiagnostics,
    "queue",
    "drawReadiness",
    result.readiness.diagnostics,
  );
  pushRenderDiagnostics(
    scratch.queueDiagnostics,
    "queue",
    "drawPackages",
    result.packages.diagnostics,
  );
  pushDrawDiagnostics(
    scratch.resolveDiagnostics,
    "resolve",
    "descriptors",
    result.drawCommands.diagnostics,
  );
  pushDrawDiagnostics(
    scratch.resolveDiagnostics,
    "resolve",
    "draw-list",
    result.drawList.diagnostics,
  );
  pushDrawDiagnostics(
    scratch.resolveDiagnostics,
    "resolve",
    "resources",
    result.resources.diagnostics,
  );
  pushDrawDiagnostics(
    scratch.commandDiagnostics,
    "command",
    "commands",
    result.commandPlan.diagnostics,
  );
  appendDiagnostics(scratch.diagnostics, scratch.applyDiagnostics);
  appendDiagnostics(scratch.diagnostics, scratch.prepareDiagnostics);
  appendDiagnostics(scratch.diagnostics, scratch.queueDiagnostics);
  appendDiagnostics(scratch.diagnostics, scratch.resolveDiagnostics);
  appendDiagnostics(scratch.diagnostics, scratch.commandDiagnostics);
  appendDiagnostics(scratch.diagnostics, scratch.submitDiagnostics);

  const counts = scratch.counts as MutableRenderFramePlanCounts;
  const queueCounts = scratch.queueCounts as MutableRenderFramePhaseCounts;
  const submitCounts = scratch.submitCounts as MutableRenderFramePhaseCounts;
  const phases =
    scratch.phases as MutableRenderFramePhaseReports<RenderFramePlanDiagnostic>;
  const summary = scratch.summary as MutableRenderFramePlanSummary;
  const appliedBindings = countAppliedBindings(result.bindingResults);

  counts.apply.active = result.apply.active;
  counts.apply.created = result.apply.created;
  counts.apply.updated = result.apply.updated;
  counts.apply.removed = result.apply.removed;
  counts.binding.planned = result.bindingPlan.bindings.length;
  counts.binding.applied = appliedBindings;
  counts.binding.ready = result.readiness.ready.length;
  counts.binding.blocked = result.readiness.blocked.length;
  counts.draw.packages = result.packages.packages.length;
  counts.draw.descriptors = result.drawCommands.descriptors.length;
  counts.draw.drawList = result.drawList.draws.length;
  counts.draw.resolved = result.resources.draws.length;
  counts.command.commands = result.commandPlan.commands.length;
  counts.command.drawCount = result.commandPlan.drawCount;
  counts.command.indexedDrawCount = result.commandPlan.indexedDrawCount;
  counts.command.nonIndexedDrawCount = result.commandPlan.nonIndexedDrawCount;
  queueCounts.ready = result.readiness.ready.length;
  queueCounts.blocked = result.readiness.blocked.length;
  queueCounts.packages = result.packages.packages.length;
  submitCounts.submitted = 0;
  submitCounts.plannedCommands = result.commandPlan.commands.length;
  submitCounts.plannedDraws = result.commandPlan.drawCount;

  phases.apply.ready = scratch.applyDiagnostics.length === 0;
  phases.prepare.ready = scratch.prepareDiagnostics.length === 0;
  phases.queue.ready = scratch.queueDiagnostics.length === 0;
  phases.resolve.ready =
    scratch.resolveDiagnostics.length === 0 &&
    result.drawList.valid &&
    result.resources.valid;
  phases.command.ready =
    scratch.commandDiagnostics.length === 0 && result.commandPlan.valid;
  phases.submit.ready =
    scratch.submitDiagnostics.length === 0 && result.commandPlan.valid;
  summary.ready =
    scratch.diagnostics.length === 0 &&
    result.drawList.valid &&
    result.resources.valid &&
    result.commandPlan.valid;

  return scratch.summary;
}

type MutableRenderFramePlanCounts = {
  readonly [Key in keyof RenderFramePlanCounts]: {
    -readonly [CountKey in keyof RenderFramePlanCounts[Key]]: RenderFramePlanCounts[Key][CountKey];
  };
};

type MutableRenderFramePhaseCounts = Record<string, number>;

type MutableRenderFramePhaseReport<Diagnostic> = {
  -readonly [Key in keyof RenderFramePhaseReports<Diagnostic>[RenderFramePhase]]: RenderFramePhaseReports<Diagnostic>[RenderFramePhase][Key];
};

type MutableRenderFramePhaseReports<Diagnostic> = {
  readonly [Phase in RenderFramePhase]: MutableRenderFramePhaseReport<Diagnostic>;
};

type MutableRenderFramePlanSummary = {
  -readonly [Key in keyof RenderFramePlanSummary]: RenderFramePlanSummary[Key];
};

type MutablePlanRenderFrameFromSnapshotResult = {
  -readonly [Key in keyof PlanRenderFrameFromSnapshotResult]: PlanRenderFrameFromSnapshotResult[Key];
};

function resetRenderFramePlanSummaryScratch(
  scratch: RenderFramePlanSummaryScratch,
): void {
  scratch.applyDiagnostics.length = 0;
  scratch.prepareDiagnostics.length = 0;
  scratch.queueDiagnostics.length = 0;
  scratch.resolveDiagnostics.length = 0;
  scratch.commandDiagnostics.length = 0;
  scratch.submitDiagnostics.length = 0;
  scratch.diagnostics.length = 0;
}

function countAppliedBindings(
  bindings: readonly ReturnType<RenderWorld["updateResourceBindings"]>[],
): number {
  let applied = 0;

  for (const binding of bindings) {
    if (binding.ok) {
      applied += 1;
    }
  }

  return applied;
}

function appendDiagnostics(
  output: RenderFramePlanDiagnostic[],
  diagnostics: readonly RenderFramePlanDiagnostic[],
): void {
  for (const diagnostic of diagnostics) {
    output.push(diagnostic);
  }
}

function pushRenderDiagnostics(
  output: RenderFramePlanDiagnostic[],
  phase: RenderFramePhase,
  source: string,
  diagnostics: readonly RenderDiagnostic[],
): void {
  for (const diagnostic of diagnostics) {
    output.push(renderDiagnostic(phase, source, diagnostic));
  }
}

function pushDrawDiagnostics(
  output: RenderFramePlanDiagnostic[],
  phase: RenderFramePhase,
  source: string,
  diagnostics: readonly (
    | DrawCommandDescriptorDiagnostic
    | RenderPassDrawListDiagnostic
    | RenderPassResourceDiagnostic
    | RenderPassCommandDiagnostic
    | UnlitBindGroupResourceDiagnostic
  )[],
): void {
  for (const diagnostic of diagnostics) {
    output.push(drawDiagnostic(phase, source, diagnostic));
  }
}

function renderDiagnostic(
  phase: RenderFramePhase,
  source: string,
  diagnostic: RenderDiagnostic,
): RenderFramePlanDiagnostic {
  return {
    phase,
    source,
    code: diagnostic.code,
    message: diagnostic.message,
    ...(diagnostic.assetKey === undefined
      ? {}
      : { assetKey: diagnostic.assetKey }),
    ...(diagnostic.entity === undefined ? {} : { entity: diagnostic.entity }),
  };
}

function drawDiagnostic(
  phase: RenderFramePhase,
  source: string,
  diagnostic:
    | DrawCommandDescriptorDiagnostic
    | RenderPassDrawListDiagnostic
    | RenderPassResourceDiagnostic
    | RenderPassCommandDiagnostic
    | UnlitBindGroupResourceDiagnostic,
): RenderFramePlanDiagnostic {
  return {
    phase,
    source,
    code: diagnostic.code,
    message: diagnostic.message,
    ...("renderId" in diagnostic ? { renderId: diagnostic.renderId } : {}),
    ...("resourceKey" in diagnostic
      ? { resourceKey: diagnostic.resourceKey }
      : {}),
  };
}
