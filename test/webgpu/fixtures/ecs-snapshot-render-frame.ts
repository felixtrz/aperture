import {
  AssetRegistry,
  Camera,
  Material,
  Mesh,
  RenderLayer,
  RenderWorld,
  Visibility,
  WorldTransform,
  createBoxMeshAsset,
  createCamera,
  createMaterialHandle,
  createMeshHandle,
  createRootTransform,
  createUnlitMaterialAsset,
  createWorld,
  extractRenderSnapshot,
  inspectRenderSnapshot,
  planInjectedRenderFrameSnapshotResourceBindings,
  registerMetadataComponents,
  registerRenderAuthoringComponents,
  registerTransformComponents,
  runInjectedRenderFrameFromSnapshot,
  type GetOrCreateRenderPipelineResult,
  type InjectedRenderFrameSnapshotResourceBindingPlan,
  type InjectedRenderFrameSnapshotRunnerReport,
  type MeshGpuBufferResource,
  type RenderPassEncoderLike,
  type RenderSnapshot,
  type RendererAssemblySmokeReport,
  type UnlitBindGroupResource,
} from "@aperture-engine/webgpu/test-support";

export type EcsSnapshotRenderFrameFailurePoint = "invalidRenderable" | "submit";

export interface EcsSnapshotRenderFrameFixtureOptions {
  readonly failAt?: EcsSnapshotRenderFrameFailurePoint;
}

export interface EcsSnapshotRenderFrameFixture {
  readonly snapshot: RenderSnapshot;
  readonly bindingPlan: InjectedRenderFrameSnapshotResourceBindingPlan;
  readonly report: InjectedRenderFrameSnapshotRunnerReport;
  readonly events: readonly string[];
}

export function createEcsSnapshotRenderFrameFixture(
  options: EcsSnapshotRenderFrameFixtureOptions = {},
): EcsSnapshotRenderFrameFixture {
  const events: string[] = [];
  const world = createRuntimeWorld();
  const assets = createReadyAssets();

  createCameraEntity(world);
  createMeshEntity(world, 0);
  createMeshEntity(world, 1);

  if (options.failAt === "invalidRenderable") {
    createMeshEntity(world, 2, { meshId: "mesh:missing" });
  }

  const snapshot = extractRenderSnapshot(world, assets, { frame: 1 });
  const bindingPlan = planInjectedRenderFrameSnapshotResourceBindings({
    snapshot,
    resolveMeshResourceKey: (draw) =>
      draw.mesh.id === "cube" ? "mesh:cube" : null,
    resolveMaterialResourceKey: (draw) =>
      draw.material.id === "unlit" ? "material:unlit" : null,
  });
  const report = runInjectedRenderFrameFromSnapshot({
    renderer: renderer(snapshot),
    renderWorld: new RenderWorld(),
    snapshot,
    bindings: bindingPlan.bindings,
    meshResources: [mesh()],
    pipelines: [pipeline(snapshot)],
    bindGroups: bindGroups(),
    pass: renderPass(events),
    frameExecution: {
      context: { getCurrentTexture: () => ({ createView: () => ({}) }) },
      device: device(events),
      queue: options.failAt === "submit" ? {} : queue(events),
      label: "ecs-snapshot-render-frame",
      clearColor: [0, 0, 0, 1],
    },
  });

  return {
    snapshot,
    bindingPlan,
    report,
    events,
  };
}

function createRuntimeWorld(): ReturnType<typeof createWorld> {
  const world = createWorld({ entityCapacity: 16 });

  registerTransformComponents(world);
  registerMetadataComponents(world);
  registerRenderAuthoringComponents(world);
  return world;
}

function createReadyAssets(): AssetRegistry {
  const registry = new AssetRegistry();
  const mesh = createMeshHandle("cube");
  const material = createMaterialHandle("unlit");

  registry.register(mesh);
  registry.register(material);
  registry.markReady(mesh, createBoxMeshAsset());
  registry.markReady(material, createUnlitMaterialAsset());
  return registry;
}

function createCameraEntity(world: ReturnType<typeof createWorld>) {
  const entity = world.createEntity();
  const root = createRootTransform({ translation: [0, 0, 5] });

  entity.addComponent(WorldTransform, root.world);
  entity.addComponent(Camera, createCamera({ priority: 0, layerMask: 1 }));
  return entity;
}

function createMeshEntity(
  world: ReturnType<typeof createWorld>,
  order: number,
  options: { readonly meshId?: string } = {},
) {
  const entity = world.createEntity();
  const root = createRootTransform({ translation: [order * 2, 0, 0] });

  entity.addComponent(WorldTransform, root.world);
  entity.addComponent(Mesh, {
    meshId: options.meshId ?? "mesh:cube",
  });
  entity.addComponent(Material, {
    materialId: "material:unlit",
  });
  entity.addComponent(RenderLayer, { mask: 1 });
  entity.addComponent(Visibility);
  return entity;
}

function renderer(snapshot: RenderSnapshot): RendererAssemblySmokeReport {
  return {
    ready: true,
    sections: {} as RendererAssemblySmokeReport["sections"],
    diagnostics: [],
    summary: {
      snapshot: inspectRenderSnapshot(snapshot).counts,
      cloneability: null,
      packages: null,
      resources: null,
      frame: {
        frame: snapshot.frame,
        ready: true,
        draws: snapshot.meshDraws.length,
        batches: 1,
        diagnostics: {
          total: 0,
          bySeverity: { info: 0, warning: 0, error: 0 },
          byCode: {},
        },
      },
    },
  };
}

function pipeline(snapshot: RenderSnapshot): GetOrCreateRenderPipelineResult {
  return {
    ok: true,
    status: "miss",
    key: snapshot.meshDraws[0]?.batchKey.pipelineKey ?? "pipeline:empty",
    pipeline: "pipeline-handle",
    diagnostics: [],
  };
}

function bindGroups(): readonly UnlitBindGroupResource[] {
  return [0, 1, 2].map((group) => ({
    group,
    resourceKey: `bind:${group}`,
    layoutKey: `layout:${group}`,
    bindGroup: `bind-group-handle:${group}`,
    entryResourceKeys:
      group === 2 ? ["material:unlit"] : [`frame-resource:${group}`],
  }));
}

function mesh(): MeshGpuBufferResource {
  return {
    resourceKey: "mesh:cube",
    vertexCount: 36,
    vertexBuffers: [
      {
        streamId: "positions",
        resourceKey: "mesh:cube:positions",
        buffer: "vertex-buffer-handle",
        vertexCount: 36,
      },
    ],
  };
}

function renderPass(events: string[]): RenderPassEncoderLike {
  return {
    setPipeline: () => events.push("render-pass:pipeline"),
    setBindGroup: (index) => events.push(`render-pass:bind:${index}`),
    setVertexBuffer: (slot) => events.push(`render-pass:vertex:${slot}`),
    draw: (vertexCount) => events.push(`render-pass:draw:${vertexCount}`),
  };
}

function device(events: string[]) {
  return {
    createCommandEncoder: () => ({
      beginRenderPass: () => {
        events.push("frame:begin");
        return {
          setPipeline: () => events.push("frame:pipeline"),
          setBindGroup: (index: number) => events.push(`frame:bind:${index}`),
          setVertexBuffer: (slot: number) =>
            events.push(`frame:vertex:${slot}`),
          draw: (vertexCount: number) =>
            events.push(`frame:draw:${vertexCount}`),
          end: () => events.push("frame:end"),
        };
      },
      finish: () => {
        events.push("frame:finish");
        return { label: "command-buffer" };
      },
    }),
  };
}

function queue(events: string[]) {
  return {
    submit: (buffers: readonly unknown[]) =>
      events.push(`frame:submit:${buffers.length}`),
  };
}
