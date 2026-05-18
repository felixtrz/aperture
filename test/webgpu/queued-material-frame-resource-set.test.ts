import { describe, expect, it } from "vitest";

import {
  createQueuedMaterialFrameResourceScratch,
  prepareQueuedMaterialFrameResourceSet,
} from "@aperture-engine/webgpu";

describe("queued material frame-resource set preparation", () => {
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
});
