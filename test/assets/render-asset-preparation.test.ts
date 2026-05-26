import { describe, expect, it } from "vitest";
import {
  AssetRegistry,
  createMaterialHandle,
  createMeshHandle,
  createSamplerHandle,
  createTextureHandle,
  type MaterialHandle,
  type MeshHandle,
} from "@aperture-engine/simulation";
import {
  PreparedRenderAssetStore,
  createBoxMeshAsset,
  createCustomWgslMaterialRenderAssetAdapter,
  createDefaultRenderState,
  defineInstanceAttributes,
  createMatcapMaterialAsset,
  createMaterialMetadataRenderAssetAdapter,
  createPreparedMeshStore,
  createPreparedMaterialStore,
  createPreparedMaterialAssetStore,
  createRenderAssetCollections,
  createStandardMaterialAsset,
  createUnlitMaterialAsset,
  preparedMeshStoreSummaryToJsonValue,
  preparedMaterialStoreSummaryToJsonValue,
  RenderWorld,
  prepareRenderAsset,
  unloadPreparedRenderAsset,
  validateCustomMaterialSource,
  type MeshAsset,
  type CustomWgslMaterialSource,
  type PreparedCustomWgslMaterial,
  type RenderAssetAdapter,
  type RenderSnapshot,
} from "@aperture-engine/render";

describe("render asset preparation contract", () => {
  it("prepares, updates, skips unchanged sources, and unloads deterministically", () => {
    interface MockMeshSource {
      readonly label: string;
      readonly revision: number;
    }

    interface MockPreparedMesh {
      readonly label: string;
      readonly revision: number;
      readonly previousRevision: number | null;
    }

    const registry = new AssetRegistry();
    const handle = createMeshHandle("mock");
    const store = new PreparedRenderAssetStore<"mesh", MockPreparedMesh>();
    const unloaded: string[] = [];
    const adapter: RenderAssetAdapter<
      "mesh",
      MockMeshSource,
      MockPreparedMesh
    > = {
      kind: "mesh",
      family: "mock.mesh",
      prepare(input) {
        return {
          status: "prepared",
          prepared: {
            label: input.source.label,
            revision: input.source.revision,
            previousRevision: input.previous?.prepared.revision ?? null,
          },
        };
      },
      unload(input) {
        unloaded.push(input.assetKey);
      },
    };

    registry.register(handle);
    registry.markReady(handle, { label: "Mock", revision: 1 });

    const created = prepareRenderAsset({
      registry,
      adapter,
      store,
      handle,
    });
    const unchanged = prepareRenderAsset({
      registry,
      adapter,
      store,
      handle,
    });

    registry.markReady(handle, { label: "Mock", revision: 2 });

    const updated = prepareRenderAsset({
      registry,
      adapter,
      store,
      handle,
    });
    const unloadedReport = unloadPreparedRenderAsset({
      adapter,
      store,
      handle,
    });

    expect(created).toMatchObject({
      outcome: "prepared",
      action: "created",
      assetKey: "mesh:mock",
    });
    expect(created.entry?.prepared).toEqual({
      label: "Mock",
      revision: 1,
      previousRevision: null,
    });
    expect(unchanged).toMatchObject({
      outcome: "unchanged",
      assetKey: "mesh:mock",
    });
    expect(updated).toMatchObject({
      outcome: "prepared",
      action: "updated",
      assetKey: "mesh:mock",
    });
    expect(updated.entry?.prepared).toEqual({
      label: "Mock",
      revision: 2,
      previousRevision: 1,
    });
    expect(unloadedReport).toMatchObject({
      removed: true,
      assetKey: "mesh:mock",
    });
    expect(unloaded).toEqual(["mesh:mock"]);
    expect(store.size).toBe(0);
  });

  it("removes prepared metadata when source assets are no longer ready", () => {
    const registry = new AssetRegistry();
    const handle = createMeshHandle("transient");
    const store = new PreparedRenderAssetStore<
      "mesh",
      { readonly revision: number }
    >();
    const adapter: RenderAssetAdapter<
      "mesh",
      { readonly revision: number },
      { readonly revision: number }
    > = {
      kind: "mesh",
      family: "mock.mesh",
      prepare(input) {
        return {
          status: "prepared",
          prepared: { revision: input.source.revision },
        };
      },
    };

    registry.register(handle);
    registry.markReady(handle, { revision: 1 });
    prepareRenderAsset({ registry, adapter, store, handle });

    registry.markLoading(handle);

    const skipped = prepareRenderAsset({ registry, adapter, store, handle });

    expect(skipped).toMatchObject({
      outcome: "skipped",
      assetKey: "mesh:transient",
    });
    expect(skipped.diagnostics[0]?.code).toBe("renderAsset.source.loading");
    expect(store.has(handle)).toBe(false);
  });

  it("unloads prepared assets through the adapter when source assets are unregistered", () => {
    const registry = new AssetRegistry();
    const handle = createMeshHandle("unregistered");
    const store = new PreparedRenderAssetStore<
      "mesh",
      { readonly revision: number }
    >();
    const unloaded: string[] = [];
    const adapter: RenderAssetAdapter<
      "mesh",
      { readonly revision: number },
      { readonly revision: number }
    > = {
      kind: "mesh",
      family: "mock.mesh",
      prepare(input) {
        return {
          status: "prepared",
          prepared: { revision: input.source.revision },
        };
      },
      unload(input) {
        unloaded.push(input.assetKey);
        return {
          diagnostics: [
            {
              code: "renderAsset.unloaded",
              message: `Unloaded ${input.assetKey}.`,
              severity: "info",
              assetKey: input.assetKey,
            },
          ],
        };
      },
    };

    registry.register(handle);
    registry.markReady(handle, { revision: 1 });
    prepareRenderAsset({ registry, adapter, store, handle });

    registry.unregister(handle);

    const skipped = prepareRenderAsset({ registry, adapter, store, handle });

    expect(skipped).toMatchObject({
      outcome: "skipped",
      assetKey: "mesh:unregistered",
    });
    expect(skipped.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "renderAsset.sourceMissing",
      "renderAsset.unloaded",
    ]);
    expect(unloaded).toEqual(["mesh:unregistered"]);
    expect(store.has(handle)).toBe(false);
  });

  it("prepares a custom WGSL material descriptor through the render asset adapter contract", () => {
    const registry = new AssetRegistry();
    const handle = createMaterialHandle("water");
    const store = new PreparedRenderAssetStore<
      "material",
      PreparedCustomWgslMaterial
    >();
    const adapter = createCustomWgslMaterialRenderAssetAdapter("custom.water");
    const source: CustomWgslMaterialSource = {
      family: "custom.water",
      label: "Water Material",
      renderState: createDefaultRenderState({
        cullMode: "none",
        depth: {
          test: true,
          write: false,
          compare: "less",
        },
        blend: { preset: "alpha" },
        alphaMode: "blend",
      }),
      shader: {
        code: `
          @group(2) @binding(0) var<uniform> water: vec4f;

          @vertex
          fn vs_main() -> @builtin(position) vec4f {
            return vec4f(0.0, 0.0, 0.0, 1.0);
          }

          @fragment
          fn fs_main() -> @location(0) vec4f {
            return water;
          }
        `,
        vertexEntryPoint: "vs_main",
        fragmentEntryPoint: "fs_main",
      },
      bindings: [
        {
          binding: 0,
          kind: "uniform-buffer",
          visibility: ["fragment"],
          label: "waterUniforms",
        },
      ],
      instanceAttributes: defineInstanceAttributes([
        { name: "wind", format: "float32x3" },
        { name: "phase", format: "float32" },
      ]),
    };

    registry.register<"material", CustomWgslMaterialSource>(handle);
    registry.markReady(handle, source);

    const prepared = prepareRenderAsset({
      registry,
      adapter,
      store,
      handle,
    });

    expect(prepared).toMatchObject({
      outcome: "prepared",
      assetKey: "material:water",
      action: "created",
      diagnostics: [],
    });
    expect(prepared.entry?.prepared).toMatchObject({
      resourceFamily: "custom-wgsl-material",
      sourceMaterialKey: "material:water",
      label: "Water Material",
      materialFamily: "custom.water",
      shader: {
        language: "wgsl",
        vertexEntryPoint: "vs_main",
        fragmentEntryPoint: "fs_main",
      },
      pipeline: {
        pipelineKey: expect.stringContaining("custom.water|shader:"),
        vertexEntryPoint: "vs_main",
        fragmentEntryPoint: "fs_main",
        renderState: source.renderState,
        instanceAttributes: {
          strideFloats: 4,
          attributes: [
            {
              name: "wind",
              format: "float32x3",
              shaderLocation: 6,
              floatOffset: 0,
            },
            {
              name: "phase",
              format: "float32",
              shaderLocation: 7,
              floatOffset: 3,
            },
          ],
        },
      },
      bindGroupLayout: {
        entries: [
          {
            binding: 0,
            kind: "uniform-buffer",
            visibility: ["fragment"],
            label: "waterUniforms",
          },
        ],
      },
      bindGroup: {
        layoutResourceKey: expect.stringContaining(
          "custom-wgsl-bind-group-layout:material:water",
        ),
        entries: [
          {
            binding: 0,
            kind: "uniform-buffer",
            resourceKey: "material:water:binding:0",
          },
        ],
      },
    });
    expect(prepared.entry?.prepared.pipeline.pipelineKey).toContain(
      "bindings:0:uniform-buffer|blend|none|less|alpha",
    );
    expect(prepared.entry?.prepared.pipeline.pipelineKey).toContain(
      "instance-attributes:",
    );
    expect(store.get(handle)?.prepared.shader.code).toContain("fn fs_main");
  });

  it("uses the custom instance attribute layout in the custom pipeline key", () => {
    const source = (attributes: ReturnType<typeof defineInstanceAttributes>) =>
      ({
        family: "custom.wind",
        label: "Wind Material",
        renderState: createDefaultRenderState(),
        shader: {
          code: `
            @vertex fn vs_main() -> @builtin(position) vec4f { return vec4f(); }
            @fragment fn fs_main() -> @location(0) vec4f { return vec4f(1.0); }
          `,
          vertexEntryPoint: "vs_main",
          fragmentEntryPoint: "fs_main",
        },
        instanceAttributes: attributes,
      }) satisfies CustomWgslMaterialSource;
    const first = prepareCustomSource(
      "a",
      source(defineInstanceAttributes([{ name: "phase", format: "float32" }])),
    );
    const second = prepareCustomSource(
      "b",
      source(
        defineInstanceAttributes([{ name: "phase", format: "float32x2" }]),
      ),
    );

    expect(first.pipeline.pipelineKey).not.toBe(second.pipeline.pipelineKey);
    expect(first.pipeline.instanceAttributes?.strideFloats).toBe(1);
    expect(second.pipeline.instanceAttributes?.strideFloats).toBe(2);
  });

  it("diagnoses invalid custom WGSL material entry points", () => {
    const registry = new AssetRegistry();
    const handle = createMaterialHandle("broken-water");
    const store = new PreparedRenderAssetStore<
      "material",
      PreparedCustomWgslMaterial
    >();
    const adapter = createCustomWgslMaterialRenderAssetAdapter("custom.water");

    registry.register<"material", CustomWgslMaterialSource>(handle);
    registry.markReady(handle, {
      family: "custom.water",
      label: "Broken Water",
      renderState: createDefaultRenderState(),
      shader: {
        code: "fn only_main() -> vec4f { return vec4f(1.0); }",
        vertexEntryPoint: "vs_main",
        fragmentEntryPoint: "fs_main",
      },
    });

    const failed = prepareRenderAsset({
      registry,
      adapter,
      store,
      handle,
    });

    expect(failed).toMatchObject({
      outcome: "failed",
      assetKey: "material:broken-water",
    });
    expect(failed.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "renderAsset.customWgslMaterial.missingVertexEntryPoint",
      "renderAsset.customWgslMaterial.missingFragmentEntryPoint",
    ]);
  });

  it("exposes package-level custom material source diagnostics", () => {
    const diagnostics = validateCustomMaterialSource(
      {
        family: "custom.water",
        label: " ",
        renderState: createDefaultRenderState(),
        shader: {
          code: `
            @vertex
            fn only_vertex() -> @builtin(position) vec4f {
              return vec4f(0.0, 0.0, 0.0, 1.0);
            }
          `,
          vertexEntryPoint: "vs_main",
          fragmentEntryPoint: "fs_main",
        },
        bindings: [
          {
            binding: 0,
            kind: "uniform-buffer",
            visibility: ["fragment"],
          },
          {
            binding: 0,
            kind: "uniform-buffer",
            visibility: [],
          },
          {
            binding: -1,
            kind: "uniform-buffer",
            visibility: ["fragment"],
          },
        ],
      },
      {
        assetKey: "material:broken-water",
        expectedFamily: "custom.water",
      },
    );

    expect(diagnostics).toMatchObject([
      {
        code: "renderAsset.customWgslMaterial.invalidLabel",
        severity: "error",
        assetKey: "material:broken-water",
      },
      {
        code: "renderAsset.customWgslMaterial.missingVertexEntryPoint",
        severity: "error",
        assetKey: "material:broken-water",
      },
      {
        code: "renderAsset.customWgslMaterial.missingFragmentEntryPoint",
        severity: "error",
        assetKey: "material:broken-water",
      },
      {
        code: "renderAsset.customWgslMaterial.duplicateBinding",
        severity: "error",
        assetKey: "material:broken-water",
      },
      {
        code: "renderAsset.customWgslMaterial.invalidBindingVisibility",
        severity: "error",
        assetKey: "material:broken-water",
      },
      {
        code: "renderAsset.customWgslMaterial.invalidBinding",
        severity: "error",
        assetKey: "material:broken-water",
      },
    ]);
  });

  it("retries material preparation until dependencies are ready", () => {
    const assets = createRenderAssetCollections();
    const texture = createTextureHandle("albedo");
    const sampler = createSamplerHandle("linear");

    assets.registry.register(texture);
    assets.registry.register(sampler);
    assets.registry.markLoading(texture);
    assets.registry.markReady(sampler, {});

    const material = assets.materials.standard.add(
      createStandardMaterialAsset({
        label: "Proof Standard",
        baseColorTexture: { texture, sampler },
        metallicFactor: 0.25,
        roughnessFactor: 0.6,
      }),
    );
    const store = createPreparedMaterialAssetStore();
    const adapter = createMaterialMetadataRenderAssetAdapter();

    const retry = prepareRenderAsset({
      registry: assets.registry,
      adapter,
      store,
      handle: material,
    });

    assets.registry.markReady(texture, {});

    const prepared = prepareRenderAsset({
      registry: assets.registry,
      adapter,
      store,
      handle: material,
    });

    expect(retry).toMatchObject({
      outcome: "retry",
      assetKey: "material:standard-material-1",
    });
    expect(retry.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "renderAsset.asset.dependencyLoading",
    ]);
    expect(store.size).toBe(1);
    expect(prepared).toMatchObject({
      outcome: "prepared",
      action: "created",
      assetKey: "material:standard-material-1",
    });
    expect(prepared.entry?.prepared).toMatchObject({
      resourceFamily: "material",
      sourceMaterialKey: "material:standard-material-1",
      label: "Proof Standard",
      materialFamily: "standard",
      materialKind: "standard",
      dependencies: ["texture:albedo", "sampler:linear"],
      pipelineKey: "standard|baseColorTexture|opaque|back|less|none",
      pipelineKeyInput: {
        shaderFamily: "standard",
        features: ["baseColorTexture"],
      },
      materialResourceKey: "prepared-material:material:standard-material-1",
      bindGroupResourceKey:
        "prepared-material-bind-group:material:standard-material-1|pipeline:standard|baseColorTexture|opaque|back|less|none",
    });
  });

  it("prepares, updates, removes, and clears mesh metadata through the facade", () => {
    const assets = createRenderAssetCollections();
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "Facade Mesh A" }),
    );
    const store = createPreparedMeshStore();

    const created = store.prepare({
      registry: assets.registry,
      handle: mesh,
    });
    const unchanged = store.prepare({
      registry: assets.registry,
      handle: mesh,
    });

    assets.meshes.markReady(
      mesh,
      createBoxMeshAsset({ label: "Facade Mesh B" }),
    );

    const updated = store.prepare({
      registry: assets.registry,
      handle: mesh,
    });
    const removed = store.remove(mesh);

    store.prepare({
      registry: assets.registry,
      handle: mesh,
    });
    store.clear();

    expect(created).toMatchObject({
      outcome: "prepared",
      action: "created",
      assetKey: "mesh:mesh-1",
    });
    expect(created.entry?.prepared).toMatchObject({
      resourceFamily: "mesh",
      sourceMeshKey: "mesh:mesh-1",
      meshResourceKey: "prepared-mesh:mesh:mesh-1",
      label: "Facade Mesh A",
      vertexStreams: 1,
      submeshes: 1,
      hasIndexBuffer: true,
    });
    expect(unchanged).toMatchObject({
      outcome: "unchanged",
      assetKey: "mesh:mesh-1",
    });
    expect(updated).toMatchObject({
      outcome: "prepared",
      action: "updated",
      assetKey: "mesh:mesh-1",
    });
    expect(updated.entry?.prepared).toMatchObject({
      resourceFamily: "mesh",
      sourceMeshKey: "mesh:mesh-1",
      meshResourceKey: "prepared-mesh:mesh:mesh-1",
      label: "Facade Mesh B",
      vertexStreams: 1,
      submeshes: 1,
      hasIndexBuffer: true,
    });
    expect(store.list().length).toBe(0);
    expect(removed).toMatchObject({
      removed: true,
      entry: {
        assetKey: "mesh:mesh-1",
      },
    });
    expect(JSON.stringify(updated.entry)).not.toContain("GPU");
    expect(JSON.stringify(updated.entry)).not.toContain("Float32Array");
  });

  it("removes invalid mesh facade entries with validation diagnostics", () => {
    const assets = createRenderAssetCollections();
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "Initially Valid Mesh" }),
    );
    const store = createPreparedMeshStore();

    store.prepare({ registry: assets.registry, handle: mesh });

    assets.meshes.markReady(mesh, invalidMeshAsset());

    const failed = store.prepare({
      registry: assets.registry,
      handle: mesh,
    });

    expect(failed).toMatchObject({
      outcome: "failed",
      assetKey: "mesh:mesh-1",
    });
    expect(failed.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "renderAsset.mesh.missingPosition",
      "renderAsset.mesh.missingBounds",
    ]);
    expect(store.get(mesh)).toBeUndefined();
  });

  it("prepares, updates, removes, and clears material descriptors through the facade", () => {
    const assets = createRenderAssetCollections();
    const material = assets.materials.standard.add(
      createStandardMaterialAsset({ label: "Facade Standard A" }),
    );
    const store = createPreparedMaterialStore();

    const created = store.prepare({
      registry: assets.registry,
      handle: material,
    });
    const unchanged = store.prepare({
      registry: assets.registry,
      handle: material,
    });

    assets.materials.standard.markReady(
      material,
      createStandardMaterialAsset({ label: "Facade Standard B" }),
    );

    const updated = store.prepare({
      registry: assets.registry,
      handle: material,
    });
    const removed = store.remove(material);

    store.prepare({
      registry: assets.registry,
      handle: material,
    });
    store.clear();

    expect(created).toMatchObject({
      outcome: "prepared",
      action: "created",
      assetKey: "material:standard-material-1",
    });
    expect(unchanged).toMatchObject({
      outcome: "unchanged",
      assetKey: "material:standard-material-1",
    });
    expect(updated).toMatchObject({
      outcome: "prepared",
      action: "updated",
      assetKey: "material:standard-material-1",
    });
    expect(updated.entry?.prepared).toMatchObject({
      resourceFamily: "material",
      label: "Facade Standard B",
      materialFamily: "standard",
      materialResourceKey: "prepared-material:material:standard-material-1",
    });
    expect(store.list().length).toBe(0);
    expect(removed).toMatchObject({
      removed: true,
      entry: {
        assetKey: "material:standard-material-1",
      },
    });
    expect(JSON.stringify(updated.entry)).not.toContain("GPU");
  });

  it("uses facade material resource keys as render-world string bindings", () => {
    const assets = createRenderAssetCollections();
    const mesh = createMeshHandle("facade-mesh");
    const material = assets.materials.standard.add(
      createStandardMaterialAsset({ label: "Facade Bound Standard" }),
    );
    const store = createPreparedMaterialStore();
    const prepared = store.prepare({
      registry: assets.registry,
      handle: material,
    });
    const renderWorld = new RenderWorld();

    renderWorld.applySnapshot(snapshotWithDraw(mesh, material));

    const blocked = renderWorld.createDrawReadinessReport();
    const materialResourceKey = prepared.entry?.prepared.materialResourceKey;

    expect(materialResourceKey).toBe(
      "prepared-material:material:standard-material-1",
    );

    if (materialResourceKey === undefined) {
      throw new Error("Expected material facade to prepare a resource key.");
    }

    renderWorld.updateResourceBindings(1, {
      meshResourceKey: "prepared-mesh:mesh:facade-mesh",
      materialResourceKey,
    });

    const ready = renderWorld.createDrawReadinessReport();

    expect(blocked.blocked[0]?.missing).toEqual([
      "missing-mesh-resource",
      "missing-material-resource",
    ]);
    expect(ready.ready[0]).toMatchObject({
      renderId: 1,
      meshResourceKey: "prepared-mesh:mesh:facade-mesh",
      materialResourceKey: "prepared-material:material:standard-material-1",
    });
    expect(JSON.stringify(renderWorld.listObjects())).not.toContain("buffer");
  });

  it("summarizes prepared mesh facade entries without source assets or backend buffers", () => {
    const assets = createRenderAssetCollections();
    const mesh = assets.meshes.add(
      createBoxMeshAsset({ label: "Summary Mesh" }),
    );
    const store = createPreparedMeshStore();

    store.prepare({ registry: assets.registry, handle: mesh });

    const summary = preparedMeshStoreSummaryToJsonValue(store);
    const json = JSON.stringify(summary);

    expect(summary).toEqual({
      totalEntries: 1,
      entries: [
        {
          assetKey: "mesh:mesh-1",
          sourceVersion: 1,
          label: "Summary Mesh",
          meshResourceKey: "prepared-mesh:mesh:mesh-1",
          vertexStreams: 1,
          submeshes: 1,
          hasIndexBuffer: true,
          diagnosticCount: 0,
        },
      ],
    });
    expect(json).not.toContain("Map");
    expect(json).not.toContain("Float32Array");
    expect(json).not.toContain("data");
    expect(json).not.toContain("GPU");
    expect(json).not.toContain("buffer");
  });

  it("summarizes prepared material facade entries without source assets or backend handles", () => {
    const assets = createRenderAssetCollections();
    const matcapTexture = createTextureHandle("summary-matcap");
    const matcapSampler = createSamplerHandle("summary-matcap-sampler");

    assets.registry.register(matcapTexture);
    assets.registry.register(matcapSampler);
    assets.registry.markReady(matcapTexture, {});
    assets.registry.markReady(matcapSampler, {});

    const unlit = assets.materials.unlit.add(
      createUnlitMaterialAsset({
        label: "Summary Unlit",
        baseColorFactor: [0.25, 0.5, 0.75, 1],
      }),
    );
    const matcap = assets.materials.matcap.add(
      createMatcapMaterialAsset({
        label: "Summary Matcap",
        matcapTexture: { texture: matcapTexture, sampler: matcapSampler },
      }),
    );
    const standard = assets.materials.standard.add(
      createStandardMaterialAsset({ label: "Summary Standard" }),
    );
    const store = createPreparedMaterialStore();

    store.prepare({ registry: assets.registry, handle: unlit });
    store.prepare({ registry: assets.registry, handle: matcap });
    store.prepare({ registry: assets.registry, handle: standard });

    const summary = preparedMaterialStoreSummaryToJsonValue(store);
    const json = JSON.stringify(summary);

    expect(summary).toMatchObject({
      totalEntries: 3,
      families: {
        unlit: { entries: 1 },
        matcap: { entries: 1 },
        standard: { entries: 1 },
        "debug-normal": { entries: 0 },
      },
    });
    expect(summary.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Summary Unlit",
          materialFamily: "unlit",
          dependencyCount: 0,
          textureBindingCount: 0,
        }),
        expect.objectContaining({
          label: "Summary Matcap",
          materialFamily: "matcap",
          dependencyCount: 2,
          textureBindingCount: 1,
        }),
        expect.objectContaining({
          label: "Summary Standard",
          materialFamily: "standard",
          dependencyCount: 0,
          textureBindingCount: 0,
        }),
      ]),
    );
    expect(json).not.toContain("Map");
    expect(json).not.toContain("baseColorFactor");
    expect(json).not.toContain("GPU");
  });
});

function snapshotWithDraw(
  mesh: MeshHandle,
  material: MaterialHandle,
): RenderSnapshot {
  return {
    frame: 1,
    views: [],
    meshDraws: [
      {
        renderId: 1,
        entity: { index: 1, generation: 1 },
        mesh,
        material,
        submesh: 0,
        materialSlot: 0,
        worldTransformOffset: 0,
        boundsIndex: -1,
        layerMask: 1,
        sortKey: {
          queue: "opaque",
          viewId: 0,
          layer: 1,
          order: 0,
          pipelineKey: "standard|opaque|back|less|none",
          materialKey: "material:standard-material-1",
          meshKey: "mesh:facade-mesh",
          depth: 0,
          stableId: 1,
        },
        batchKey: {
          pipelineKey: "standard|opaque|back|less|none",
          materialKey: "material:standard-material-1",
          meshLayoutKey: "mesh-layout:position-normal-uv",
          topology: "triangle-list",
          instanced: false,
          skinned: false,
          morphed: false,
        },
      },
    ],
    lights: [],
    environments: [],
    shadowRequests: [],
    bounds: [],
    transforms: new Float32Array(0),
    viewMatrices: new Float32Array(0),
    diagnostics: [],
    report: {
      views: 0,
      meshDraws: 1,
      lights: 0,
      environments: 0,
      shadowRequests: 0,
      bounds: 0,
      diagnostics: 0,
    },
  };
}

function prepareCustomSource(
  id: string,
  source: CustomWgslMaterialSource,
): PreparedCustomWgslMaterial {
  const registry = new AssetRegistry();
  const handle = createMaterialHandle(id);
  const store = new PreparedRenderAssetStore<
    "material",
    PreparedCustomWgslMaterial
  >();

  registry.register<"material", CustomWgslMaterialSource>(handle);
  registry.markReady(handle, source);

  const prepared = prepareRenderAsset({
    registry,
    adapter: createCustomWgslMaterialRenderAssetAdapter(source.family),
    store,
    handle,
  });

  if (prepared.entry === null || prepared.entry === undefined) {
    throw new Error("Expected custom material source to prepare.");
  }

  return prepared.entry.prepared;
}

function invalidMeshAsset(): MeshAsset {
  return {
    kind: "mesh",
    label: "Invalid Mesh",
    vertexStreams: [],
    submeshes: [],
    materialSlots: [],
  };
}
