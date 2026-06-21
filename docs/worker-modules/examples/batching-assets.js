export const batchingClearColor = [0.014, 0.018, 0.025, 1];
export const batchingSourceShapeCount = 20;
export const batchingShapesPerBatch = 4;
export const batchingOrthographicHeight = 4.4;

export function registerBatchingAssets(aperture, registry, canvasSize) {
  const assets = aperture.createRenderAssetCollections({ registry });
  const aspect = canvasSize.width / canvasSize.height;
  const material = assets.materials.standard.add(
    aperture.createStandardMaterialAsset({
      label: "BatchingStandardMaterial",
      baseColorFactor: new Float32Array([0.18, 0.92, 0.62, 1]),
      emissiveFactor: [0.05, 0.18, 0.1],
      metallicFactor: 0,
      roughnessFactor: 1,
      renderState: { cullMode: "none" },
    }),
    { id: "batching-standard" },
  );
  const sources = createSourceMeshes(aperture);
  const batches = createMergedBatches(aperture, assets, sources);

  return {
    material,
    materialKey: aperture.assetHandleKey(material),
    sources,
    batches,
    sourceShapeCount: sources.length,
    shapesPerBatch: batchingShapesPerBatch,
    mergedMeshCount: batches.length,
    queuePlan: createQueuePlanStatus(aperture, sources),
    samples: samplePoints(sources, aspect),
  };
}

export function createBatchingSceneStatus(scene) {
  return {
    materialKey: scene.materialKey,
    sourceShapeCount: scene.sourceShapeCount,
    shapesPerBatch: scene.shapesPerBatch,
    mergedMeshCount: scene.mergedMeshCount,
    queuePlan: scene.queuePlan,
    samples: scene.samples,
  };
}

function createSourceMeshes(aperture) {
  const sources = [];
  const columns = 5;
  const rows = 4;

  for (let index = 0; index < batchingSourceShapeCount; index += 1) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const center = [
      (column - (columns - 1) / 2) * 1.22,
      ((rows - 1) / 2 - row) * 0.78,
    ];
    const sides = 3 + (index % 5);
    const radius = 0.2 + (index % 4) * 0.025;
    const mesh = createPolygonMeshAsset({
      label: `BatchSource${index + 1}`,
      center,
      sides,
      radius,
      rotation: index * 0.23,
    });

    sources.push({
      index,
      center,
      handle: aperture.createMeshHandle(`batch-source-${index + 1}`),
      mesh,
    });
  }

  return sources;
}

function createMergedBatches(aperture, assets, sources) {
  const batches = [];

  for (let start = 0; start < sources.length; start += batchingShapesPerBatch) {
    const batchSources = sources.slice(start, start + batchingShapesPerBatch);
    const merged = aperture.mergeMeshAssetsForBatch({
      label: `BatchingMerged${batches.length + 1}`,
      sources: batchSources.map((source) => ({
        handle: source.handle,
        mesh: source.mesh,
      })),
    });

    if (!merged.valid || merged.mesh === null) {
      throw new Error(
        `Failed to merge static batch ${batches.length + 1}: ${JSON.stringify(
          merged.diagnostics,
        )}`,
      );
    }

    const appMesh = collapseToSingleSubmesh(merged.mesh);
    const handle = assets.meshes.add(appMesh, {
      id: `batching-merged-${batches.length + 1}`,
    });

    batches.push({
      handle,
      ranges: merged.ranges,
    });
  }

  return batches;
}

function collapseToSingleSubmesh(mesh) {
  const vertexCount = mesh.vertexStreams[0]?.vertexCount ?? 0;
  const indexCount = mesh.indexBuffer?.data.length ?? 0;

  return {
    ...mesh,
    submeshes: [
      {
        label: "static-batch",
        topology: "triangle-list",
        materialSlot: 0,
        vertexStart: 0,
        vertexCount,
        indexStart: 0,
        indexCount,
      },
    ],
  };
}

function createQueuePlanStatus(aperture, sources) {
  const batchKey = {
    pipelineKey: "standard:opaque",
    materialKey: "material:batching-standard",
    meshLayoutKey: "POSITION,NORMAL,TEXCOORD_0",
    topology: "triangle-list",
    instanced: false,
    skinned: false,
    morphed: false,
  };
  const ready = sources.map((source) => {
    const renderId = source.index + 1;
    const meshKey = aperture.assetHandleKey(source.handle);

    return {
      renderId,
      packet: {
        renderId,
        entity: { index: renderId, generation: 1 },
        mesh: source.handle,
        material: aperture.createMaterialHandle("batching-standard"),
        submesh: 0,
        materialSlot: 0,
        worldTransformOffset: source.index * 16,
        boundsIndex: -1,
        layerMask: 1,
        sortKey: aperture.createRenderSortKey({
          stableId: renderId,
          order: renderId,
          pipelineKey: batchKey.pipelineKey,
          materialKey: batchKey.materialKey,
          meshKey,
        }),
        batchKey,
      },
      meshResourceKey: `mesh-buffer:${meshKey}`,
      materialResourceKey: "material-buffer:batching-standard",
      batchKey,
    };
  });
  const plan = aperture.planRenderQueueRecords(
    { ready, blocked: [], diagnostics: [] },
    {
      data: new Float32Array(sources.length * 16),
      offsets: sources.map((source) => ({
        renderId: source.index + 1,
        sourceOffset: source.index * 16,
        packedOffset: source.index * 16,
      })),
      diagnostics: [],
    },
    {
      staticBatching: {
        enabled: true,
        maxRecordsPerBatch: batchingShapesPerBatch,
      },
    },
  );

  return {
    sourceRecords: sources.length,
    plannedRecords: plan.records.length,
    sourceRecordCounts: plan.records.map((record) => record.sourceRecordCount),
    drawKinds: plan.records.map((record) => record.drawKind),
  };
}

function samplePoints(sources, aspect) {
  const viewWidth = batchingOrthographicHeight * aspect;

  return [0, 4, 10, 14, 19].map((index) => {
    const source = sources[index];

    return {
      id: `shape-${index + 1}`,
      x: 0.5 + (source.center[0] ?? 0) / viewWidth,
      y: 0.5 - (source.center[1] ?? 0) / batchingOrthographicHeight,
    };
  });
}

function createPolygonMeshAsset(options) {
  const vertices = new Float32Array((options.sides + 1) * 8);
  const indices = new Uint16Array(options.sides * 3);
  const min = [options.center[0], options.center[1], 0];
  const max = [options.center[0], options.center[1], 0];

  writeVertex(vertices, 0, options.center[0], options.center[1]);

  for (let side = 0; side < options.sides; side += 1) {
    const angle =
      options.rotation + (side / options.sides) * Math.PI * 2 + Math.PI * 0.5;
    const radius =
      side % 2 === 0 ? options.radius : options.radius * (0.82 + side * 0.015);
    const x = options.center[0] + Math.cos(angle) * radius;
    const y = options.center[1] + Math.sin(angle) * radius;
    const vertexIndex = side + 1;

    writeVertex(vertices, vertexIndex, x, y);
    min[0] = Math.min(min[0], x);
    min[1] = Math.min(min[1], y);
    max[0] = Math.max(max[0], x);
    max[1] = Math.max(max[1], y);
  }

  for (let side = 0; side < options.sides; side += 1) {
    const offset = side * 3;

    indices[offset] = 0;
    indices[offset + 1] = side + 1;
    indices[offset + 2] = side + 1 === options.sides ? 1 : side + 2;
  }

  return {
    kind: "mesh",
    label: options.label,
    vertexStreams: [
      {
        id: "primitive-interleaved",
        arrayStride: 32,
        vertexCount: options.sides + 1,
        attributes: [
          { semantic: "POSITION", format: "float32x3", offset: 0 },
          { semantic: "NORMAL", format: "float32x3", offset: 12 },
          { semantic: "TEXCOORD_0", format: "float32x2", offset: 24 },
        ],
        data: vertices,
      },
    ],
    indexBuffer: { format: "uint16", data: indices },
    submeshes: [
      {
        label: "default",
        topology: "triangle-list",
        materialSlot: 0,
        vertexStart: 0,
        vertexCount: options.sides + 1,
        indexStart: 0,
        indexCount: indices.length,
      },
    ],
    materialSlots: [{ index: 0, label: "default" }],
    localAabb: { min, max },
    localSphere: {
      center: [options.center[0], options.center[1], 0],
      radius: options.radius,
    },
  };
}

function writeVertex(vertices, vertexIndex, x, y) {
  const offset = vertexIndex * 8;

  vertices.set([x, y, 0, 0, 0, 1, 0.5, 0.5], offset);
}
