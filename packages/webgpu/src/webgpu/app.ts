import {
  AssetRegistry,
  createWorld,
  registerMetadataComponents,
  registerTransformComponents,
  resolveWorldTransforms,
  type EcsWorld,
  type Entity,
  type TransformResolutionReport,
  type WorldOptions,
} from "@aperture-engine/simulation";
import {
  RenderWorld,
  extractRenderSnapshot,
  packSnapshotTransforms,
  packSnapshotViewUniforms,
  planRenderWorldDrawPackages,
  registerRenderAuthoringComponents,
  type MaterialAsset,
  type MeshAsset,
  type RenderSnapshot,
} from "@aperture-engine/render";
import {
  assembleFrameBoundary,
  type FrameBoundaryAssemblyReport,
} from "./frame-boundary.js";
import { createDrawCommandDescriptors } from "./draw-command.js";
import {
  createUnlitFrameGpuResources,
  type CreateUnlitFrameGpuResourcesResult,
} from "./unlit-frame-resources.js";
import {
  createUnlitRenderPipelineResource,
  type CreateUnlitRenderPipelineResourceResult,
} from "./unlit-pipeline.js";
import { planInjectedRenderFrameSnapshotResourceBindings } from "./renderer-frame-summary.js";
import { planRenderPassCommands } from "./render-pass-commands.js";
import { planRenderPassDrawList } from "./render-pass-draw-list.js";
import { resolveRenderPassResources } from "./render-pass-resources.js";
import {
  initializeWebGpu,
  type InitializeWebGpuOptions,
  type WebGpuCanvasLike,
  type WebGpuFailure,
  type WebGpuInitializationSuccess,
} from "./index.js";

export interface WebGpuAppStepResult {
  readonly transform: TransformResolutionReport;
}

export interface WebGpuAppSpawnContext {
  readonly app: WebGpuApp;
  readonly world: EcsWorld;
  readonly assets: AssetRegistry;
}

export type WebGpuAppEntityInitializer = (
  entity: Entity,
  context: WebGpuAppSpawnContext,
) => void;

export interface WebGpuAppRenderOptions {
  readonly frame?: number;
  readonly snapshot?: RenderSnapshot;
  readonly clearColor?: readonly number[];
  readonly label?: string;
}

export interface WebGpuAppRenderCounts {
  readonly views: number;
  readonly meshDraws: number;
  readonly drawPackages: number;
  readonly drawCommands: number;
  readonly drawCalls: number;
  readonly diagnostics: number;
}

export interface WebGpuAppRenderReport {
  readonly ok: boolean;
  readonly frame: number;
  readonly snapshot: RenderSnapshot;
  readonly counts: WebGpuAppRenderCounts;
  readonly diagnostics: readonly unknown[];
  readonly pipeline: CreateUnlitRenderPipelineResourceResult | null;
  readonly resources: CreateUnlitFrameGpuResourcesResult | null;
  readonly boundary: FrameBoundaryAssemblyReport | null;
}

export interface WebGpuApp {
  readonly world: EcsWorld;
  readonly assets: AssetRegistry;
  readonly initialization: WebGpuInitializationSuccess;
  readonly renderWorld: RenderWorld;
  spawn(...initializers: WebGpuAppEntityInitializer[]): Entity;
  registerSystem(system: Parameters<EcsWorld["registerSystem"]>[0]): WebGpuApp;
  step(delta?: number, time?: number): WebGpuAppStepResult;
  extract(frame?: number): RenderSnapshot;
  render(options?: WebGpuAppRenderOptions): Promise<WebGpuAppRenderReport>;
  stepAndRender(
    delta?: number,
    time?: number,
    frame?: number,
  ): Promise<WebGpuAppRenderReport>;
}

export interface CreateWebGpuAppOptions extends Omit<
  InitializeWebGpuOptions,
  "canvas"
> {
  readonly canvas: WebGpuCanvasLike;
  readonly assets?: AssetRegistry;
  readonly world?: EcsWorld;
  readonly worldOptions?: Partial<WorldOptions>;
}

export interface CreateWebGpuAppSuccess {
  readonly ok: true;
  readonly app: WebGpuApp;
  readonly initialization: WebGpuInitializationSuccess;
}

export type CreateWebGpuAppResult = CreateWebGpuAppSuccess | WebGpuFailure;

export async function createWebGpuApp(
  options: CreateWebGpuAppOptions,
): Promise<CreateWebGpuAppResult> {
  const initialization = await initializeWebGpu(options);

  if (!initialization.ok) {
    return initialization;
  }

  const world = options.world ?? createWorld(options.worldOptions);
  const assets = options.assets ?? new AssetRegistry();
  const renderWorld = new RenderWorld();

  registerTransformComponents(world);
  registerMetadataComponents(world);
  registerRenderAuthoringComponents(world);

  const app: WebGpuApp = {
    world,
    assets,
    initialization,
    renderWorld,
    spawn(...initializers) {
      const entity = world.createEntity();
      const context: WebGpuAppSpawnContext = { app, world, assets };

      for (const initializer of initializers) {
        initializer(entity, context);
      }

      return entity;
    },
    registerSystem(system) {
      world.registerSystem(system);
      return this;
    },
    step(delta = 0, time = 0) {
      world.update(delta, time);
      return { transform: resolveWorldTransforms(world) };
    },
    extract(frame = 0) {
      return extractRenderSnapshot(world, assets, { frame });
    },
    async render(renderOptions = {}) {
      return renderWebGpuAppFrame(app, renderOptions);
    },
    async stepAndRender(delta = 0, time = 0, frame = 0) {
      this.step(delta, time);
      return this.render({ frame });
    },
  };

  return { ok: true, app, initialization };
}

async function renderWebGpuAppFrame(
  app: WebGpuApp,
  options: WebGpuAppRenderOptions,
): Promise<WebGpuAppRenderReport> {
  const snapshot = options.snapshot ?? app.extract(options.frame ?? 0);
  const firstDraw = snapshot.meshDraws[0];
  const firstView = snapshot.views[0];

  if (firstDraw === undefined || firstView === undefined) {
    return renderReport({
      ok: false,
      snapshot,
      diagnostics: [
        ...snapshot.diagnostics,
        {
          code: "webGpuApp.emptySnapshot",
          message:
            "WebGPU app render requires at least one view and one mesh draw.",
        },
      ],
    });
  }

  const mesh = app.assets.get<"mesh", MeshAsset>(firstDraw.mesh)?.asset ?? null;
  const material =
    app.assets.get<"material", MaterialAsset>(firstDraw.material)?.asset ??
    null;

  if (mesh === null || material === null) {
    return renderReport({
      ok: false,
      snapshot,
      diagnostics: [
        {
          code: "webGpuApp.missingSourceAsset",
          message: "WebGPU app render requires ready mesh and material assets.",
        },
      ],
    });
  }

  const pipeline = await createUnlitRenderPipelineResource({
    device: app.initialization.device as Parameters<
      typeof createUnlitRenderPipelineResource
    >[0]["device"],
    colorFormat: app.initialization.format,
    batchKey: firstDraw.batchKey,
  });

  if (!pipeline.valid || pipeline.resource === null) {
    return renderReport({
      ok: false,
      snapshot,
      pipeline,
      diagnostics: pipeline.diagnostics,
    });
  }

  const pipelineHandle = pipeline.resource.pipeline as {
    getBindGroupLayout?: (group: number) => unknown;
  };

  if (pipelineHandle.getBindGroupLayout === undefined) {
    return renderReport({
      ok: false,
      snapshot,
      pipeline,
      diagnostics: [
        {
          code: "webGpuApp.missingPipelineLayouts",
          message: "The unlit pipeline does not expose bind group layouts.",
        },
      ],
    });
  }

  const packedViews = packSnapshotViewUniforms(snapshot);
  const packedTransforms = packSnapshotTransforms(snapshot);
  const resources = createUnlitFrameGpuResources({
    device: app.initialization.device as Parameters<
      typeof createUnlitFrameGpuResources
    >[0]["device"],
    mesh,
    material,
    viewUniforms: packedViews,
    worldTransforms: packedTransforms,
    layouts: [0, 1, 2].map((group) => ({
      group,
      layoutKey: `webgpu-app/unlit/group-${group}`,
      layout: pipelineHandle.getBindGroupLayout?.(group),
    })),
  });

  if (!resources.valid || resources.resources === null) {
    return renderReport({
      ok: false,
      snapshot,
      pipeline,
      resources,
      diagnostics: [
        ...packedViews.diagnostics,
        ...packedTransforms.diagnostics,
        ...resources.diagnostics,
      ],
    });
  }

  const bindingPlan = planInjectedRenderFrameSnapshotResourceBindings({
    snapshot,
    resolveMeshResourceKey: (draw) =>
      draw.mesh.id === firstDraw.mesh.id
        ? resources.resources?.mesh.resourceKey
        : null,
    resolveMaterialResourceKey: (draw) =>
      draw.material.id === firstDraw.material.id
        ? resources.resources?.material.resourceKey
        : null,
  });
  const apply = app.renderWorld.applySnapshot(snapshot);

  for (const binding of bindingPlan.bindings) {
    app.renderWorld.updateResourceBindings(binding.renderId, binding.update);
  }

  const readiness = app.renderWorld.createDrawReadinessReport();
  const packages = planRenderWorldDrawPackages(readiness, packedTransforms);
  const drawCommands = createDrawCommandDescriptors(packages.packages, [
    resources.resources.mesh,
  ]);
  const pipelineResult = {
    ok: true as const,
    status: "miss" as const,
    key: firstDraw.batchKey.pipelineKey,
    pipeline: pipeline.resource.pipeline,
    diagnostics: [],
  };
  const drawList = planRenderPassDrawList({
    drawCommands: drawCommands.descriptors,
    pipelines: [pipelineResult],
    bindGroups: resources.resources.bindGroups,
  });
  const resolved = resolveRenderPassResources({
    drawList: drawList.draws,
    pipelines: [pipelineResult],
    bindGroups: resources.resources.bindGroups,
    meshResources: [resources.resources.mesh],
  });
  const commandPlan = planRenderPassCommands({ draws: resolved.draws });
  const boundary = assembleFrameBoundary({
    context: app.initialization.context as Parameters<
      typeof assembleFrameBoundary
    >[0]["context"],
    device: app.initialization.device as Parameters<
      typeof assembleFrameBoundary
    >[0]["device"],
    queue: (app.initialization.device as { readonly queue: unknown })
      .queue as Parameters<typeof assembleFrameBoundary>[0]["queue"],
    commands: commandPlan.commands,
    label: options.label ?? "aperture-webgpu-app",
    clearColor: options.clearColor ?? [0, 0, 0, 1],
  });

  await waitForSubmittedWork(app.initialization.device);

  return renderReport({
    ok:
      apply.diagnostics.length === 0 &&
      bindingPlan.diagnostics.length === 0 &&
      packages.diagnostics.length === 0 &&
      drawCommands.diagnostics.length === 0 &&
      drawList.valid &&
      resolved.valid &&
      commandPlan.valid &&
      boundary.valid,
    snapshot,
    pipeline,
    resources,
    boundary,
    drawPackages: packages.packages.length,
    drawCommands: commandPlan.commands.length,
    drawCalls: commandPlan.drawCount,
    diagnostics: [
      ...snapshot.diagnostics,
      ...bindingPlan.diagnostics,
      ...readiness.diagnostics,
      ...packages.diagnostics,
      ...drawCommands.diagnostics,
      ...drawList.diagnostics,
      ...resolved.diagnostics,
      ...commandPlan.diagnostics,
      ...boundary.texture.diagnostics,
      ...(boundary.attachments?.diagnostics ?? []),
      ...(boundary.encoder?.diagnostics ?? []),
      ...(boundary.begin?.diagnostics ?? []),
      ...(boundary.execution?.diagnostics ?? []),
      ...(boundary.end?.diagnostics ?? []),
      ...(boundary.finish?.diagnostics ?? []),
      ...(boundary.submit?.diagnostics ?? []),
    ],
  });
}

function renderReport(input: {
  readonly ok: boolean;
  readonly snapshot: RenderSnapshot;
  readonly diagnostics: readonly unknown[];
  readonly pipeline?: CreateUnlitRenderPipelineResourceResult | null;
  readonly resources?: CreateUnlitFrameGpuResourcesResult | null;
  readonly boundary?: FrameBoundaryAssemblyReport | null;
  readonly drawPackages?: number;
  readonly drawCommands?: number;
  readonly drawCalls?: number;
}): WebGpuAppRenderReport {
  return {
    ok: input.ok,
    frame: input.snapshot.frame,
    snapshot: input.snapshot,
    counts: {
      views: input.snapshot.views.length,
      meshDraws: input.snapshot.meshDraws.length,
      drawPackages: input.drawPackages ?? 0,
      drawCommands: input.drawCommands ?? 0,
      drawCalls: input.drawCalls ?? 0,
      diagnostics: input.diagnostics.length,
    },
    diagnostics: input.diagnostics,
    pipeline: input.pipeline ?? null,
    resources: input.resources ?? null,
    boundary: input.boundary ?? null,
  };
}

async function waitForSubmittedWork(device: unknown): Promise<void> {
  const queue = (
    device as { readonly queue?: { onSubmittedWorkDone?: () => Promise<void> } }
  ).queue;

  if (typeof queue?.onSubmittedWorkDone === "function") {
    await queue.onSubmittedWorkDone();
  }
}
