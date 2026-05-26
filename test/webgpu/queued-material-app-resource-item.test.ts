import { describe, expect, it } from "vitest";
import {
  createBoxMeshAsset,
  type MaterialQueueItem,
  type MeshDrawPacket,
} from "@aperture-engine/render";
import {
  createQueuedMaterialAppRouteReportDiagnostic,
  createQueuedMaterialAdapterRegistry,
  createQueuedMaterialAppResourceItem,
  createWebGpuAppMaterialQueueRouteReportShell,
  createQueuedMaterialFrameResourceSetSummary,
  materialQueueItemToRouteQueueItem,
  queuedMaterialAppResourceItemToJsonValue,
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

  it("serializes generic app resource item keys without source assets or backend handles", () => {
    const adapter = { kind: "json-preview" as const };
    const queueItem = {
      ...customQueueItem(),
      renderId: 29,
      drawIndex: 3,
      materialFamily: "json-preview" as MaterialQueueItem["materialFamily"],
      pipelineKey: "json-preview|opaque|less",
      meshKey: "mesh:json-source",
      materialKey: "material:json-source",
      meshResourceKey: "mesh:json-prepared@7",
      materialResourceKey: "material:json-prepared@7",
      sortKey: {
        ...customQueueItem().sortKey,
        pipelineKey: "json-preview|opaque|less",
        meshResourceKey: "mesh:json-prepared@7",
        materialResourceKey: "material:json-prepared@7",
      },
    };
    const item = createQueuedMaterialAppResourceItem({
      queueItem,
      prepareRoute: {
        valid: true,
        status: "prepared",
        family: "json-preview",
        materialKey: "material:json-source",
        meshResourceKey: "mesh:json-prepared@7",
        materialResourceKey: "material:json-prepared@7",
        pipelineKey: "json-preview|opaque|less",
        sourceVersion: 7,
        frame: 12,
        diagnostics: [],
      },
      adapter,
      draw: customDrawPacket(),
      mesh: createBoxMeshAsset({ label: "Json preview mesh" }),
      meshKey: "mesh:json-prepared@7",
      sourceMeshKey: "mesh:json-source",
      material: {
        kind: "json-preview",
        label: "Json preview material",
        rawGpuHandle: "must-not-leak",
        sourcePayloadBytes: new Uint8Array([1, 2, 3]),
      },
      materialKey: "material:json-prepared@7",
      sourceMaterialKey: "material:json-source",
    });

    const json = queuedMaterialAppResourceItemToJsonValue(item);

    expect(json).toEqual({
      renderId: 29,
      drawIndex: 3,
      materialFamily: "json-preview",
      renderPhase: "opaque",
      pipelineKey: "json-preview|opaque|less",
      meshKey: "mesh:json-prepared@7",
      sourceMeshKey: "mesh:json-source",
      materialKey: "material:json-prepared@7",
      sourceMaterialKey: "material:json-source",
      meshResourceKey: "mesh:json-prepared@7",
      materialResourceKey: "material:json-prepared@7",
    });
    expect(JSON.stringify(json)).not.toMatch(
      /GPUDevice|GPUBuffer|GPUTexture|bindGroup|rawGpuHandle|sourcePayloadBytes|Json preview material|Json preview mesh/,
    );
  });

  it("builds a generic route report diagnostic without built-in fields or GPU handles", () => {
    const adapter = { kind: "report-builder-preview" as const };
    const queueItem = {
      ...customQueueItem(),
      renderId: 31,
      drawIndex: 0,
      materialFamily:
        "report-builder-preview" as MaterialQueueItem["materialFamily"],
      pipelineKey: "report-builder-preview|opaque",
      sortKey: {
        ...customQueueItem().sortKey,
        pipelineKey: "report-builder-preview|opaque",
      },
    };
    const skippedQueueItem = {
      ...customQueueItem(),
      renderId: 32,
      drawIndex: 1,
      materialFamily:
        "report-builder-preview" as MaterialQueueItem["materialFamily"],
      pipelineKey: "report-builder-preview|transparent",
      renderPhase: "transparent" as const,
      sortKey: {
        ...customQueueItem().sortKey,
        pipelineKey: "report-builder-preview|transparent",
        renderPhase: "transparent" as const,
        drawIndex: 1,
        stableId: 32,
      },
    };
    const item = createQueuedMaterialAppResourceItem({
      queueItem,
      prepareRoute: {
        valid: true,
        status: "prepared",
        family: "report-builder-preview",
        materialKey: "material:report-builder",
        meshResourceKey: "mesh:report-builder@1",
        materialResourceKey: "material:report-builder@1",
        pipelineKey: "report-builder-preview|opaque",
        sourceVersion: 1,
        frame: 11,
        diagnostics: [],
      },
      adapter,
      draw: customDrawPacket(),
      mesh: createBoxMeshAsset({ label: "Report builder mesh" }),
      meshKey: "mesh:report-builder@1",
      sourceMeshKey: "mesh:report-builder",
      material: {
        kind: "report-builder-preview",
        label: "Report builder material",
        rawGpuHandle: "must-not-leak",
      },
      materialKey: "material:report-builder@1",
      sourceMaterialKey: "material:report-builder",
    });

    const diagnostic = createQueuedMaterialAppRouteReportDiagnostic({
      queueItems: [queueItem, skippedQueueItem],
      routedItems: [item],
      diagnostics: [
        {
          code: "webGpuApp.reportBuilderPreviewSkipped",
          message: "Skipped one test-only preview item.",
          severity: "warning",
          renderId: 32,
          drawIndex: 1,
          materialFamily: "report-builder-preview",
          renderPhase: "transparent",
        },
      ],
      shell: createWebGpuAppMaterialQueueRouteReportShell(),
    });

    expect(materialQueueItemToRouteQueueItem(skippedQueueItem)).toEqual({
      renderId: 32,
      drawIndex: 1,
      materialFamily: "report-builder-preview",
      renderPhase: "transparent",
      entity: { index: 1, generation: 1 },
    });
    expect(diagnostic).toMatchObject({
      code: "webGpuApp.materialQueueRouteReport",
      message: "WebGPU app material queue routing failed.",
      routedItems: [
        {
          renderId: 31,
          drawIndex: 0,
          materialFamily: "report-builder-preview",
          renderPhase: "opaque",
          pipelineKey: "report-builder-preview|opaque",
          meshKey: "mesh:report-builder@1",
          sourceMeshKey: "mesh:report-builder",
          materialKey: "material:report-builder@1",
          sourceMaterialKey: "material:report-builder",
          meshResourceKey: "mesh:report-builder@1",
          materialResourceKey: "material:report-builder@1",
        },
      ],
      report: {
        valid: false,
        queueItemCount: 2,
        routedItemCount: 1,
        skippedItemCount: 1,
        byFamily: [
          {
            key: "report-builder-preview",
            queuedCount: 2,
            routedCount: 1,
            skippedCount: 1,
          },
        ],
        byPhase: [
          {
            key: "opaque",
            queuedCount: 1,
            routedCount: 1,
            skippedCount: 0,
          },
          {
            key: "transparent",
            queuedCount: 1,
            routedCount: 0,
            skippedCount: 1,
          },
        ],
        diagnosticSummary: {
          total: 1,
          bySeverity: { info: 0, warning: 1, error: 0 },
          byCode: { "webGpuApp.reportBuilderPreviewSkipped": 1 },
        },
      },
    });
    expect(JSON.stringify(diagnostic)).not.toMatch(
      /GPUDevice|GPUBuffer|GPUTexture|bindGroup|rawGpuHandle|Report builder material|Report builder mesh|reportBuilderPreviewResourceSet/,
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
