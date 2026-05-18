import { describe, expect, it } from "vitest";

import {
  appendQueuedMaterialFrameResourceBucket,
  createQueuedMaterialFrameResourceBuckets,
  createQueuedMaterialFrameResourceBucketSummary,
  createQueuedMaterialFrameResourceScratch,
  getQueuedMaterialFrameResourceBucket,
  prepareQueuedMaterialFrameResourceSet,
  resetQueuedMaterialFrameResourceBuckets,
} from "@aperture-engine/webgpu";

describe("queued material frame-resource set preparation", () => {
  it("groups generic frame resources by material family with JSON-safe summaries", () => {
    const buckets = createQueuedMaterialFrameResourceBuckets<{
      readonly resourceKey: string;
    }>();

    appendQueuedMaterialFrameResourceBucket(buckets, "standard", {
      resourceKey: "standard:0",
    });
    appendQueuedMaterialFrameResourceBucket(buckets, "custom-preview", {
      resourceKey: "custom:0",
    });
    appendQueuedMaterialFrameResourceBucket(buckets, "standard", {
      resourceKey: "standard:1",
    });

    expect(createQueuedMaterialFrameResourceBucketSummary(buckets)).toEqual([
      { family: "custom-preview", itemCount: 1 },
      { family: "standard", itemCount: 2 },
    ]);
    expect(
      JSON.stringify(createQueuedMaterialFrameResourceBucketSummary(buckets)),
    ).not.toMatch(/GPUDevice|GPUBuffer|GPUTexture|bindGroup|WebGpuApp/);
  });

  it("resets generic frame-resource buckets without leaking stale families", () => {
    const buckets = createQueuedMaterialFrameResourceBuckets<{
      readonly resourceKey: string;
    }>();

    appendQueuedMaterialFrameResourceBucket(buckets, "standard", {
      resourceKey: "standard:stale",
    });
    appendQueuedMaterialFrameResourceBucket(buckets, "debug-normal", {
      resourceKey: "debug:stale",
    });

    expect(getQueuedMaterialFrameResourceBucket(buckets, "standard")).toEqual([
      { resourceKey: "standard:stale" },
    ]);

    resetQueuedMaterialFrameResourceBuckets(buckets);

    appendQueuedMaterialFrameResourceBucket(buckets, "custom-preview", {
      resourceKey: "custom:fresh",
    });

    expect(getQueuedMaterialFrameResourceBucket(buckets, "standard")).toEqual(
      [],
    );
    expect(createQueuedMaterialFrameResourceBucketSummary(buckets)).toEqual([
      { family: "custom-preview", itemCount: 1 },
    ]);
    expect(
      JSON.stringify(createQueuedMaterialFrameResourceBucketSummary(buckets)),
    ).not.toContain("standard:stale");
  });

  it("prepares generic material resources without built-in family buckets", async () => {
    type Item = {
      readonly pipelineKey: string;
      readonly sourceMeshKey: string;
      readonly sourceMaterialKey: string;
    };
    type Pipeline = {
      readonly valid: true;
      readonly resource: {
        readonly pipeline: {
          readonly getBindGroupLayout: (group: number) => unknown;
        };
      };
      readonly diagnostics: readonly [];
    };
    type Mesh = { readonly resourceKey: string };
    type BindGroup = {
      readonly group: number;
      readonly resourceKey: string;
      readonly layoutKey: string;
      readonly bindGroup: unknown;
      readonly entryResourceKeys: readonly string[];
    };
    type Resources = {
      readonly mesh: Mesh;
      readonly material: { readonly resourceKey: string };
      readonly bindGroups: readonly BindGroup[];
    };
    type ResourceResult = {
      readonly valid: true;
      readonly resources: Resources;
      readonly diagnostics: readonly [];
    };
    const scratch = createQueuedMaterialFrameResourceScratch<
      { readonly key: string },
      Mesh,
      BindGroup
    >();
    const appended: unknown[] = [];
    const result = await prepareQueuedMaterialFrameResourceSet<
      Item,
      Pipeline,
      { readonly key: string },
      { readonly layout: unknown },
      { readonly valid: true; readonly diagnostics: readonly [] },
      { readonly item: Item; readonly layouts: { readonly layout: unknown } },
      Resources,
      ResourceResult,
      Mesh,
      BindGroup
    >({
      items: [
        {
          pipelineKey: "custom|opaque",
          sourceMeshKey: "mesh:source",
          sourceMaterialKey: "material:source",
        },
      ],
      scratch,
      callbacks: {
        getPipelineKey: (item) => item.pipelineKey,
        getSourceMeshKey: (item) => item.sourceMeshKey,
        getSourceMaterialKey: (item) => item.sourceMaterialKey,
        getPipeline: () => ({
          valid: true,
          resource: {
            pipeline: { getBindGroupLayout: (group: number) => ({ group }) },
          },
          diagnostics: [],
        }),
        getPipelineView: (pipeline) => pipeline,
        createPipelinePlanResult: ({ item }) => ({ key: item.pipelineKey }),
        getPipelineLayouts: ({ getBindGroupLayout }) => ({
          layout: getBindGroupLayout(0),
        }),
        prepareTextureSamplerDependencies: () => ({
          valid: true,
          diagnostics: [],
        }),
        createFrameResourceOptions: ({ item, layouts }) => ({
          item,
          layouts,
        }),
        createFrameResources: () => ({
          valid: true,
          resources: {
            mesh: { resourceKey: "gpu-mesh:custom" },
            material: { resourceKey: "gpu-material:custom" },
            bindGroups: [
              {
                group: 0,
                resourceKey: "bind-group:custom",
                layoutKey: "layout:custom",
                bindGroup: {},
                entryResourceKeys: ["view"],
              },
            ],
          },
          diagnostics: [],
        }),
        appendFrameResources: ({ resources }) => {
          appended.push(resources);
        },
        createRouteDiagnostic: () => ({ code: "custom.failed" }),
        getMeshResource: (resources) => resources.mesh,
        getMeshResourceKey: (resources) => resources.mesh.resourceKey,
        getMaterialResourceKey: (resources) => resources.material.resourceKey,
        getBindGroups: (resources) => resources.bindGroups,
      },
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.pipelineResults).toEqual([{ key: "custom|opaque" }]);
    expect(result.meshResources).toEqual([{ resourceKey: "gpu-mesh:custom" }]);
    expect(result.bindGroups).toMatchObject([
      { resourceKey: "bind-group:custom|pipeline:custom|opaque" },
    ]);
    expect(result.meshResourceKeys.get("mesh:source")).toBe("gpu-mesh:custom");
    expect(result.materialResourceKeys.get("material:source")).toBe(
      "gpu-material:custom",
    );
    expect(appended).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain("GPUBuffer");
  });

  it("reuses one generic pipeline plan for duplicate pipeline keys while appending each item", async () => {
    type Item = {
      readonly pipelineKey: string;
      readonly sourceMeshKey: string;
      readonly sourceMaterialKey: string;
    };
    type Pipeline = {
      readonly valid: true;
      readonly resource: {
        readonly pipeline: {
          readonly getBindGroupLayout: (group: number) => unknown;
        };
      };
      readonly diagnostics: readonly [];
    };
    type Mesh = { readonly resourceKey: string };
    type BindGroup = {
      readonly group: number;
      readonly resourceKey: string;
      readonly layoutKey: string;
      readonly bindGroup: unknown;
      readonly entryResourceKeys: readonly string[];
    };
    type Resources = {
      readonly mesh: Mesh;
      readonly material: { readonly resourceKey: string };
      readonly bindGroups: readonly BindGroup[];
    };
    type ResourceResult = {
      readonly valid: true;
      readonly resources: Resources;
      readonly diagnostics: readonly [];
    };
    const scratch = createQueuedMaterialFrameResourceScratch<
      { readonly key: string },
      Mesh,
      BindGroup
    >();
    let pipelinePlanCalls = 0;
    let appendCalls = 0;
    const result = await prepareQueuedMaterialFrameResourceSet<
      Item,
      Pipeline,
      { readonly key: string },
      { readonly layout: unknown },
      { readonly valid: true; readonly diagnostics: readonly [] },
      { readonly item: Item; readonly layouts: { readonly layout: unknown } },
      Resources,
      ResourceResult,
      Mesh,
      BindGroup
    >({
      items: [
        {
          pipelineKey: "custom|shared",
          sourceMeshKey: "mesh:a",
          sourceMaterialKey: "material:a",
        },
        {
          pipelineKey: "custom|shared",
          sourceMeshKey: "mesh:b",
          sourceMaterialKey: "material:b",
        },
      ],
      scratch,
      callbacks: {
        getPipelineKey: (item) => item.pipelineKey,
        getSourceMeshKey: (item) => item.sourceMeshKey,
        getSourceMaterialKey: (item) => item.sourceMaterialKey,
        getPipeline: () => ({
          valid: true,
          resource: {
            pipeline: { getBindGroupLayout: (group: number) => ({ group }) },
          },
          diagnostics: [],
        }),
        getPipelineView: (pipeline) => pipeline,
        createPipelinePlanResult: ({ item }) => {
          pipelinePlanCalls += 1;
          return { key: item.pipelineKey };
        },
        getPipelineLayouts: ({ getBindGroupLayout }) => ({
          layout: getBindGroupLayout(0),
        }),
        prepareTextureSamplerDependencies: () => ({
          valid: true,
          diagnostics: [],
        }),
        createFrameResourceOptions: ({ item, layouts }) => ({
          item,
          layouts,
        }),
        createFrameResources: ({ item }) => ({
          valid: true,
          resources: {
            mesh: { resourceKey: `gpu-${item.sourceMeshKey}` },
            material: { resourceKey: `gpu-${item.sourceMaterialKey}` },
            bindGroups: [
              {
                group: 0,
                resourceKey: `bind-group:${item.sourceMaterialKey}`,
                layoutKey: "layout:custom",
                bindGroup: {},
                entryResourceKeys: [item.sourceMaterialKey],
              },
            ],
          },
          diagnostics: [],
        }),
        appendFrameResources: () => {
          appendCalls += 1;
        },
        createRouteDiagnostic: () => ({ code: "custom.failed" }),
        getMeshResource: (resources) => resources.mesh,
        getMeshResourceKey: (resources) => resources.mesh.resourceKey,
        getMaterialResourceKey: (resources) => resources.material.resourceKey,
        getBindGroups: (resources) => resources.bindGroups,
      },
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(pipelinePlanCalls).toBe(1);
    expect(appendCalls).toBe(2);
    expect(result.pipelineResults).toEqual([{ key: "custom|shared" }]);
    expect(result.meshResources).toEqual([
      { resourceKey: "gpu-mesh:a" },
      { resourceKey: "gpu-mesh:b" },
    ]);
    expect(result.meshResourceKeys.get("mesh:a")).toBe("gpu-mesh:a");
    expect(result.meshResourceKeys.get("mesh:b")).toBe("gpu-mesh:b");
    expect(result.materialResourceKeys.get("material:a")).toBe(
      "gpu-material:a",
    );
    expect(result.materialResourceKeys.get("material:b")).toBe(
      "gpu-material:b",
    );
    expect(result.bindGroups).toMatchObject([
      { resourceKey: "bind-group:material:a|pipeline:custom|shared" },
      { resourceKey: "bind-group:material:b|pipeline:custom|shared" },
    ]);
    expect(JSON.stringify(result)).not.toContain("GPUBuffer");
    expect(JSON.stringify(result)).not.toContain("rawGpuHandle");
  });

  it("appends injected route diagnostics for failed generic frame resources", async () => {
    type Item = {
      readonly pipelineKey: string;
      readonly sourceMeshKey: string;
      readonly sourceMaterialKey: string;
    };
    type Pipeline = {
      readonly valid: true;
      readonly resource: {
        readonly pipeline: {
          readonly getBindGroupLayout: (group: number) => unknown;
        };
      };
      readonly diagnostics: readonly [];
    };
    type Mesh = { readonly resourceKey: string };
    type BindGroup = {
      readonly group: number;
      readonly resourceKey: string;
      readonly layoutKey: string;
      readonly bindGroup: unknown;
      readonly entryResourceKeys: readonly string[];
    };
    type Resources = {
      readonly mesh: Mesh;
      readonly material: { readonly resourceKey: string };
      readonly bindGroups: readonly BindGroup[];
    };
    type ResourceResult = {
      readonly valid: false;
      readonly resources: null;
      readonly diagnostics: readonly {
        readonly code: "custom.missingMaterialBuffer";
        readonly resourceKey: string;
      }[];
    };
    const scratch = createQueuedMaterialFrameResourceScratch<
      { readonly key: string },
      Mesh,
      BindGroup
    >();
    const result = await prepareQueuedMaterialFrameResourceSet<
      Item,
      Pipeline,
      { readonly key: string },
      { readonly layout: unknown },
      { readonly valid: true; readonly diagnostics: readonly [] },
      { readonly item: Item; readonly layouts: { readonly layout: unknown } },
      Resources,
      ResourceResult,
      Mesh,
      BindGroup
    >({
      items: [
        {
          pipelineKey: "custom|opaque",
          sourceMeshKey: "mesh:source",
          sourceMaterialKey: "material:source",
        },
      ],
      scratch,
      callbacks: {
        getPipelineKey: (item) => item.pipelineKey,
        getSourceMeshKey: (item) => item.sourceMeshKey,
        getSourceMaterialKey: (item) => item.sourceMaterialKey,
        getPipeline: () => ({
          valid: true,
          resource: {
            pipeline: { getBindGroupLayout: (group: number) => ({ group }) },
          },
          diagnostics: [],
        }),
        getPipelineView: (pipeline) => pipeline,
        createPipelinePlanResult: ({ item }) => ({ key: item.pipelineKey }),
        getPipelineLayouts: ({ getBindGroupLayout }) => ({
          layout: getBindGroupLayout(0),
        }),
        prepareTextureSamplerDependencies: () => ({
          valid: true,
          diagnostics: [],
        }),
        createFrameResourceOptions: ({ item, layouts }) => ({
          item,
          layouts,
        }),
        createFrameResources: () => ({
          valid: false,
          resources: null,
          diagnostics: [
            {
              code: "custom.missingMaterialBuffer",
              resourceKey: "material-buffer:missing",
            },
          ],
        }),
        appendFrameResources: () => {
          throw new Error("Failed frame resources should not append.");
        },
        createRouteDiagnostic: ({ item, result }) => ({
          code: "custom.frameResourceRoute",
          pipelineKey: item.pipelineKey,
          diagnosticCount: result.diagnostics.length,
        }),
        getMeshResource: (resources) => resources.mesh,
        getMeshResourceKey: (resources) => resources.mesh.resourceKey,
        getMaterialResourceKey: (resources) => resources.material.resourceKey,
        getBindGroups: (resources) => resources.bindGroups,
      },
    });

    expect(result.valid).toBe(false);
    expect(result.firstResources).toBeNull();
    expect(result.meshResources).toEqual([]);
    expect(result.bindGroups).toEqual([]);
    expect(result.meshResourceKeys.size).toBe(0);
    expect(result.materialResourceKeys.size).toBe(0);
    expect(result.diagnostics).toEqual([
      {
        code: "custom.missingMaterialBuffer",
        resourceKey: "material-buffer:missing",
      },
      {
        code: "custom.frameResourceRoute",
        pipelineKey: "custom|opaque",
        diagnosticCount: 1,
      },
    ]);
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("GPUBuffer");
    expect(serialized).not.toContain("GPUDevice");
    expect(serialized).not.toContain("rawGpuHandle");
  });

  it("reports invalid texture/sampler dependencies before creating generic frame resources", async () => {
    type Item = {
      readonly pipelineKey: string;
      readonly sourceMeshKey: string;
      readonly sourceMaterialKey: string;
    };
    type Pipeline = {
      readonly valid: true;
      readonly resource: {
        readonly pipeline: {
          readonly getBindGroupLayout: (group: number) => unknown;
        };
      };
      readonly diagnostics: readonly [];
    };
    type Mesh = { readonly resourceKey: string };
    type BindGroup = {
      readonly group: number;
      readonly resourceKey: string;
      readonly layoutKey: string;
      readonly bindGroup: unknown;
      readonly entryResourceKeys: readonly string[];
    };
    type Resources = {
      readonly mesh: Mesh;
      readonly material: { readonly resourceKey: string };
      readonly bindGroups: readonly BindGroup[];
    };
    type ResourceResult = {
      readonly valid: true;
      readonly resources: Resources;
      readonly diagnostics: readonly [];
    };
    type DependencyResult = {
      readonly valid: false;
      readonly diagnostics: readonly {
        readonly code: "custom.textureDependencyNotReady";
        readonly dependencyKind: "texture" | "sampler";
        readonly dependencyKey: string;
        readonly status: "loading" | "failed";
      }[];
    };
    const scratch = createQueuedMaterialFrameResourceScratch<
      { readonly key: string },
      Mesh,
      BindGroup
    >();
    let createFrameResourceOptionsCalls = 0;
    let createFrameResourcesCalls = 0;
    let appendFrameResourcesCalls = 0;

    const result = await prepareQueuedMaterialFrameResourceSet<
      Item,
      Pipeline,
      { readonly key: string },
      { readonly layout: unknown },
      DependencyResult,
      { readonly item: Item; readonly layouts: { readonly layout: unknown } },
      Resources,
      ResourceResult,
      Mesh,
      BindGroup
    >({
      items: [
        {
          pipelineKey: "custom|textured|opaque",
          sourceMeshKey: "mesh:source",
          sourceMaterialKey: "material:source",
        },
      ],
      scratch,
      callbacks: {
        getPipelineKey: (item) => item.pipelineKey,
        getSourceMeshKey: (item) => item.sourceMeshKey,
        getSourceMaterialKey: (item) => item.sourceMaterialKey,
        getPipeline: () => ({
          valid: true,
          resource: {
            pipeline: { getBindGroupLayout: (group: number) => ({ group }) },
          },
          diagnostics: [],
        }),
        getPipelineView: (pipeline) => pipeline,
        createPipelinePlanResult: ({ item }) => ({ key: item.pipelineKey }),
        getPipelineLayouts: ({ getBindGroupLayout }) => ({
          layout: getBindGroupLayout(0),
        }),
        prepareTextureSamplerDependencies: () => ({
          valid: false,
          diagnostics: [
            {
              code: "custom.textureDependencyNotReady",
              dependencyKind: "texture",
              dependencyKey: "texture:loading",
              status: "loading",
            },
            {
              code: "custom.textureDependencyNotReady",
              dependencyKind: "sampler",
              dependencyKey: "sampler:failed",
              status: "failed",
            },
          ],
        }),
        createFrameResourceOptions: ({ item, layouts }) => {
          createFrameResourceOptionsCalls += 1;
          return { item, layouts };
        },
        createFrameResources: () => {
          createFrameResourcesCalls += 1;
          return {
            valid: true,
            resources: {
              mesh: { resourceKey: "gpu-mesh:custom" },
              material: { resourceKey: "gpu-material:custom" },
              bindGroups: [],
            },
            diagnostics: [],
          };
        },
        appendFrameResources: () => {
          appendFrameResourcesCalls += 1;
        },
        createRouteDiagnostic: () => ({ code: "custom.frameResourceRoute" }),
        getMeshResource: (resources) => resources.mesh,
        getMeshResourceKey: (resources) => resources.mesh.resourceKey,
        getMaterialResourceKey: (resources) => resources.material.resourceKey,
        getBindGroups: (resources) => resources.bindGroups,
      },
    });

    expect(result.valid).toBe(false);
    expect(result.firstResources).toBeNull();
    expect(result.pipelineResults).toEqual([{ key: "custom|textured|opaque" }]);
    expect(result.meshResources).toEqual([]);
    expect(result.bindGroups).toEqual([]);
    expect(result.meshResourceKeys.size).toBe(0);
    expect(result.materialResourceKeys.size).toBe(0);
    expect(createFrameResourceOptionsCalls).toBe(0);
    expect(createFrameResourcesCalls).toBe(0);
    expect(appendFrameResourcesCalls).toBe(0);
    expect(result.diagnostics).toEqual([
      {
        code: "custom.textureDependencyNotReady",
        dependencyKind: "texture",
        dependencyKey: "texture:loading",
        status: "loading",
      },
      {
        code: "custom.textureDependencyNotReady",
        dependencyKind: "sampler",
        dependencyKey: "sampler:failed",
        status: "failed",
      },
    ]);

    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("GPUTexture");
    expect(serialized).not.toContain("GPUSampler");
    expect(serialized).not.toContain("rawGpuHandle");
  });
});
