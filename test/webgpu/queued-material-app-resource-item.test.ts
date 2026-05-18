import { describe, expect, it } from "vitest";

import {
  createBoxMeshAsset,
  type MaterialQueueItem,
  type MeshDrawPacket,
} from "@aperture-engine/core";
import {
  createQueuedMaterialAdapterRegistry,
  createQueuedMaterialAppResourceItem,
  createQueuedMaterialFrameResourceSetSummary,
  queuedMaterialAppResourceItemToRouteRoutedItem,
  type QueuedMaterialAdapterRegistration,
  type QueuedMaterialAppResourceSet,
  type QueuedMaterialPrepareRouteResult,
} from "@aperture-engine/webgpu";

describe("queued material app resource item", () => {
  it("creates a family-agnostic app route item for a test-only material family", () => {
    type CustomPreviewMaterial = {
      readonly kind: "custom-preview";
      readonly label: string;
    };
    type CustomPreviewAdapter =
      QueuedMaterialAdapterRegistration<"custom-preview"> & {
        readonly routeLabel: string;
      };
    const adapterRegistry =
      createQueuedMaterialAdapterRegistry<CustomPreviewAdapter>([
        { kind: "custom-preview", routeLabel: "test-only" },
      ]);
    const adapter = adapterRegistry.get("custom-preview");
    const queueItem = customQueueItem();
    const prepareRoute: QueuedMaterialPrepareRouteResult = {
      valid: true,
      status: "prepared",
      family: "custom-preview",
      materialKey: "material:preview",
      meshResourceKey: "mesh:preview@1",
      materialResourceKey: "material:preview@1",
      pipelineKey: "custom-preview|opaque",
      sourceVersion: 1,
      frame: 8,
      diagnostics: [],
    };
    const material: CustomPreviewMaterial = {
      kind: "custom-preview",
      label: "Preview",
    };

    if (adapter === null) {
      throw new Error("Expected test adapter.");
    }

    const item = createQueuedMaterialAppResourceItem({
      queueItem,
      prepareRoute,
      adapter,
      draw: customDrawPacket(),
      mesh: createBoxMeshAsset({ label: "Preview mesh" }),
      meshKey: "mesh:preview@1",
      sourceMeshKey: "mesh:preview",
      material,
      materialKey: "material:preview@1",
      sourceMaterialKey: "material:preview",
    });
    const resourceSet: QueuedMaterialAppResourceSet<typeof item> = {
      items: [item],
    };
    const routedResourceSet = createQueuedMaterialFrameResourceSetSummary(
      resourceSet.items.map((resourceItem) => ({
        materialFamily: resourceItem.queueItem.materialFamily,
        pipelineKey: resourceItem.queueItem.pipelineKey,
        renderPhase: resourceItem.queueItem.renderPhase,
      })),
      { byFamily: [{ family: item.adapter.kind, itemCount: 1 }] },
    );

    expect(item).toMatchObject({
      queueItem,
      prepareRoute,
      adapter: { kind: "custom-preview", routeLabel: "test-only" },
      meshKey: "mesh:preview@1",
      sourceMeshKey: "mesh:preview",
      material,
      materialKey: "material:preview@1",
      sourceMaterialKey: "material:preview",
    });
    expect(routedResourceSet).toEqual({
      itemCount: 1,
      byFamily: [{ family: "custom-preview", itemCount: 1 }],
      byPipeline: [{ pipelineKey: "custom-preview|opaque", itemCount: 1 }],
      byFamilyAndPipeline: [
        {
          family: "custom-preview",
          pipelineKey: "custom-preview|opaque",
          itemCount: 1,
        },
      ],
    });
    expect((item as unknown as { readonly unlit?: unknown }).unlit).toBe(
      undefined,
    );
    expect((item as unknown as { readonly standard?: unknown }).standard).toBe(
      undefined,
    );
    expect(JSON.stringify({ resourceSet, routedResourceSet })).not.toMatch(
      /GPUDevice|GPUBuffer|GPUTexture|bindGroup|WebGpuApp|customPreviewResourceSet/,
    );
  });

  it("validates generic route criteria with a test-only family fixture", () => {
    const adapter = { kind: "criteria-preview" as const };
    const queueItem = {
      ...customQueueItem(),
      materialFamily: "criteria-preview" as MaterialQueueItem["materialFamily"],
      pipelineKey: "criteria-preview|opaque",
      materialKey: "material:criteria",
      materialResourceKey: "material:criteria@2",
      sortKey: {
        ...customQueueItem().sortKey,
        pipelineKey: "criteria-preview|opaque",
        materialResourceKey: "material:criteria@2",
      },
    };
    const prepareRoute: QueuedMaterialPrepareRouteResult = {
      valid: true,
      status: "prepared",
      family: "criteria-preview",
      materialKey: queueItem.materialKey,
      meshResourceKey: queueItem.meshResourceKey,
      materialResourceKey: queueItem.materialResourceKey,
      pipelineKey: queueItem.pipelineKey,
      sourceVersion: 2,
      frame: 9,
      diagnostics: [],
    };
    const item = createQueuedMaterialAppResourceItem({
      queueItem,
      prepareRoute,
      adapter,
      draw: customDrawPacket(),
      mesh: createBoxMeshAsset({ label: "Criteria mesh" }),
      meshKey: queueItem.meshResourceKey,
      sourceMeshKey: queueItem.meshKey,
      material: {
        kind: "criteria-preview",
        label: "Criteria material",
        unsupportedFeatures: [],
      },
      materialKey: queueItem.materialResourceKey,
      sourceMaterialKey: queueItem.materialKey,
    });
    const routeCriteria = {
      sourceAssetContract: item.material.kind === "criteria-preview",
      queueContract:
        String(item.queueItem.materialFamily) === item.adapter.kind &&
        item.queueItem.pipelineKey === item.prepareRoute.pipelineKey,
      prepareContract:
        item.prepareRoute.meshResourceKey === item.queueItem.meshResourceKey &&
        item.prepareRoute.materialResourceKey ===
          item.queueItem.materialResourceKey,
      appRouteContract: item.sourceMeshKey === item.queueItem.meshKey,
      compatibilityContract:
        (item as unknown as { readonly criteriaPreview?: unknown })
          .criteriaPreview === undefined,
      verificationContract: prepareRoute.diagnostics.length === 0,
    };
    const routedResourceSet = createQueuedMaterialFrameResourceSetSummary(
      [
        {
          materialFamily: item.queueItem.materialFamily,
          pipelineKey: item.queueItem.pipelineKey,
          renderPhase: item.queueItem.renderPhase,
        },
      ],
      { byFamily: [{ family: item.adapter.kind, itemCount: 1 }] },
    );

    expect(routeCriteria).toEqual({
      sourceAssetContract: true,
      queueContract: true,
      prepareContract: true,
      appRouteContract: true,
      compatibilityContract: true,
      verificationContract: true,
    });
    expect(routedResourceSet).toEqual({
      itemCount: 1,
      byFamily: [{ family: "criteria-preview", itemCount: 1 }],
      byPipeline: [{ pipelineKey: "criteria-preview|opaque", itemCount: 1 }],
      byFamilyAndPipeline: [
        {
          family: "criteria-preview",
          pipelineKey: "criteria-preview|opaque",
          itemCount: 1,
        },
      ],
    });
    expect(JSON.stringify({ routeCriteria, routedResourceSet })).not.toMatch(
      /GPUDevice|GPUBuffer|GPUTexture|bindGroup|WebGpuApp|criteriaPreviewResourceSet/,
    );
  });

  it("serializes generic routed-item report metadata without built-in fields or GPU handles", () => {
    const adapter = { kind: "report-preview" as const };
    const queueItem = {
      ...customQueueItem(),
      renderId: 23,
      drawIndex: 4,
      materialFamily: "report-preview" as MaterialQueueItem["materialFamily"],
      renderPhase: "opaque" as const,
      pipelineKey: "report-preview|opaque",
      sortKey: {
        ...customQueueItem().sortKey,
        pipelineKey: "report-preview|opaque",
      },
    };
    const item = createQueuedMaterialAppResourceItem({
      queueItem,
      prepareRoute: {
        valid: true,
        status: "prepared",
        family: "report-preview",
        materialKey: "material:report",
        meshResourceKey: "mesh:report@1",
        materialResourceKey: "material:report@1",
        pipelineKey: "report-preview|opaque",
        sourceVersion: 1,
        frame: 10,
        diagnostics: [],
      },
      adapter,
      draw: customDrawPacket(),
      mesh: createBoxMeshAsset({ label: "Report mesh" }),
      meshKey: "mesh:report@1",
      sourceMeshKey: "mesh:report",
      material: {
        kind: "report-preview",
        label: "Report material",
        rawGpuHandle: "must-not-leak",
      },
      materialKey: "material:report@1",
      sourceMaterialKey: "material:report",
    });

    const routedItem = queuedMaterialAppResourceItemToRouteRoutedItem(item);

    expect(routedItem).toEqual({
      renderId: 23,
      drawIndex: 4,
      materialFamily: "report-preview",
      renderPhase: "opaque",
    });
    expect(JSON.stringify(routedItem)).not.toMatch(
      /GPUDevice|GPUBuffer|GPUTexture|bindGroup|rawGpuHandle|reportPreviewResourceSet/,
    );
  });
});

function customQueueItem(): MaterialQueueItem {
  const pipelineKey = "custom-preview|opaque";
  const materialResourceKey = "material:preview@1";
  const meshResourceKey = "mesh:preview@1";

  return {
    renderId: 7,
    drawIndex: 0,
    entity: { index: 1, generation: 1 },
    renderPhase: "opaque",
    materialFamily: "custom-preview" as MaterialQueueItem["materialFamily"],
    pipelineKey,
    meshKey: "mesh:preview",
    materialKey: "material:preview",
    meshResourceKey,
    materialResourceKey,
    meshLayoutKey: "mesh-layout:preview",
    topology: "triangle-list",
    depth: 0,
    sortKey: {
      renderPhase: "opaque",
      viewId: 0,
      layer: 0,
      order: 0,
      pipelineKey,
      materialResourceKey,
      meshResourceKey,
      depth: 0,
      stableId: 7,
      drawIndex: 0,
    },
  };
}

function customDrawPacket(): MeshDrawPacket {
  return {
    renderId: 7,
    entity: { index: 1, generation: 1 },
    mesh: { kind: "mesh", id: "preview" },
    material: { kind: "material", id: "preview" },
    submesh: 0,
    materialSlot: 0,
    worldTransformOffset: 0,
    boundsIndex: -1,
    layerMask: 1,
    sortKey: {
      queue: "opaque",
      viewId: 0,
      layer: 0,
      order: 0,
      depth: 0,
      stableId: 7,
    },
    batchKey: {
      pipelineKey: "custom-preview|opaque",
      materialKey: "material:preview",
      meshKey: "mesh:preview",
      meshLayoutKey: "mesh-layout:preview",
      topology: "triangle-list",
      renderStateKey: "opaque",
    },
  } as unknown as MeshDrawPacket;
}
