import { describe, expect, it } from "vitest";

import {
  GLB_BINARY_CHUNK_TYPE,
  GLB_CHUNK_HEADER_BYTE_LENGTH,
  GLB_CONTAINER_MAGIC,
  GLB_CONTAINER_VERSION,
  GLB_HEADER_BYTE_LENGTH,
  GLB_JSON_CHUNK_TYPE,
  createGltfEcsAuthoringCommandPlan,
  createGltfSceneTraversalReport,
  createNoFetchGlbSourceLoaderReport,
} from "@aperture-engine/render";

interface TestGlbChunk {
  readonly typeCode: number;
  readonly data: Uint8Array;
}

function encodeText(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function padChunkData(data: Uint8Array, padByte: number): Uint8Array {
  const paddedLength = Math.ceil(data.byteLength / 4) * 4;
  const padded = new Uint8Array(paddedLength);
  padded.set(data);
  padded.fill(padByte, data.byteLength);
  return padded;
}

function jsonChunk(value: Record<string, unknown>): TestGlbChunk {
  return {
    typeCode: GLB_JSON_CHUNK_TYPE,
    data: padChunkData(encodeText(JSON.stringify(value)), 0x20),
  };
}

function bytesChunk(typeCode: number, bytes: readonly number[]): TestGlbChunk {
  return {
    typeCode,
    data: new Uint8Array(bytes),
  };
}

function createGlb(chunks: readonly TestGlbChunk[]): Uint8Array {
  const byteLength =
    GLB_HEADER_BYTE_LENGTH +
    chunks.reduce(
      (total, chunk) =>
        total + GLB_CHUNK_HEADER_BYTE_LENGTH + chunk.data.byteLength,
      0,
    );
  const buffer = new ArrayBuffer(byteLength);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  let offset = GLB_HEADER_BYTE_LENGTH;

  view.setUint32(0, GLB_CONTAINER_MAGIC, true);
  view.setUint32(4, GLB_CONTAINER_VERSION, true);
  view.setUint32(8, byteLength, true);

  for (const chunk of chunks) {
    view.setUint32(offset, chunk.data.byteLength, true);
    view.setUint32(offset + 4, chunk.typeCode, true);
    bytes.set(chunk.data, offset + GLB_CHUNK_HEADER_BYTE_LENGTH);
    offset += GLB_CHUNK_HEADER_BYTE_LENGTH + chunk.data.byteLength;
  }

  return bytes;
}

describe("no-fetch GLB source-loader facade", () => {
  it("loads already provided GLB bytes without fetching", () => {
    const source = createGlb([
      jsonChunk({
        asset: { version: "2.0" },
        scene: 0,
        scenes: [{ nodes: [0] }],
        nodes: [{ name: "Root" }],
      }),
    ]);

    const report = createNoFetchGlbSourceLoaderReport({ source });

    expect(report.glbImportReport.valid).toBe(true);
    expect(report.status).toMatchObject({
      status: "loaded",
      sourceKind: "glb",
      byteLength: source.byteLength,
      externalBuffers: [],
      diagnostics: [],
      glbSourceStatus: {
        valid: true,
        importStages: expect.arrayContaining([
          expect.objectContaining({ stage: "root", status: "provided" }),
        ]),
      },
    });
    expect(report.outputSummary).toEqual({
      meshConstruction: {
        status: "absent",
        valid: null,
        meshCount: 0,
        submeshCount: 0,
        vertexCount: 0,
        indexCount: 0,
        diagnosticsCount: 0,
      },
      sourceRegistration: {
        status: "absent",
        valid: null,
        writtenCount: 0,
        skippedCount: 0,
        diagnosticsCount: 0,
        stages: [],
      },
      ecsCommandPlan: {
        status: "absent",
        valid: null,
        sceneIndex: null,
        rootEntityCount: 0,
        commandCount: 0,
        createEntityCount: 0,
        addComponentCount: 0,
        componentCounts: [],
        dependencyCount: 0,
        skippedCount: 0,
        diagnosticsCount: 0,
      },
      ecsReplayReadiness: absentReplayReadiness(),
    });
    expect(JSON.stringify(report.status)).not.toContain("Uint8Array");
  });

  it("reports invalid GLB bytes as failed without import stages", () => {
    const source = createGlb([jsonChunk({ asset: { version: "2.0" } })]);

    new DataView(source.buffer).setUint32(0, 0, true);

    const report = createNoFetchGlbSourceLoaderReport({ source });

    expect(report.glbImportReport.importReport).toBe(null);
    expect(report.status).toMatchObject({
      status: "failed",
      sourceKind: "glb",
      byteLength: source.byteLength,
      diagnostics: [{ code: "glb.invalidMagic", severity: "error" }],
      glbSourceStatus: {
        valid: false,
        importStages: [],
      },
    });
  });

  it("reports missing external bytes as blocked", () => {
    const { root, positionBytes } = splitIndexedRoot();
    const source = createGlb([
      jsonChunk(root),
      bytesChunk(GLB_BINARY_CHUNK_TYPE, Array.from(positionBytes)),
    ]);

    const report = createNoFetchGlbSourceLoaderReport({
      source,
      createMeshAssets: true,
    });

    expect(report.glbImportReport.valid).toBe(false);
    expect(report.status).toMatchObject({
      status: "blocked",
      externalBuffers: [
        {
          uri: "indices.bin",
          status: "blocked",
          byteLength: null,
          diagnosticCode: "glbImport.externalBufferUnsupported",
        },
      ],
      diagnostics: [
        {
          code: "glbImport.externalBufferUnsupported",
          severity: "error",
          uri: "indices.bin",
        },
      ],
    });
    expect(report.outputSummary.meshConstruction).toMatchObject({
      status: "invalid",
      valid: false,
      diagnosticsCount: expect.any(Number),
    });
  });

  it("uses provided external bytes without exposing them in status", () => {
    const { root, positionBytes, indexBytes } = splitIndexedRoot();
    const source = createGlb([
      jsonChunk(root),
      bytesChunk(GLB_BINARY_CHUNK_TYPE, Array.from(positionBytes)),
    ]);

    const report = createNoFetchGlbSourceLoaderReport({
      source,
      createMeshAssets: true,
      externalBufferBytes: new Map([[1, indexBytes]]),
    });
    const serialized = JSON.stringify(report.status);

    expect(report.glbImportReport.valid).toBe(true);
    expect(report.status).toMatchObject({
      status: "loaded",
      externalBuffers: [
        {
          uri: "indices.bin",
          status: "loaded",
          byteLength: indexBytes.byteLength,
        },
      ],
      diagnostics: [],
    });
    expect(report.outputSummary).toMatchObject({
      meshConstruction: {
        status: "ready",
        valid: true,
        meshCount: 1,
        submeshCount: 1,
        vertexCount: 3,
        indexCount: 3,
        diagnosticsCount: expect.any(Number),
      },
    });
    expect(serialized).not.toContain("Uint8Array");
    expect(serialized).not.toContain("[0,1,2]");
  });

  it("reuses provided decoded image bytes for GLB texture source data", () => {
    const source = createGlb([
      jsonChunk({
        asset: { version: "2.0" },
        scene: 0,
        scenes: [{ nodes: [] }],
        nodes: [],
        images: [{ uri: "data:image/png,%01%02%03%04" }],
        textures: [{ source: 0 }],
        materials: [
          {
            pbrMetallicRoughness: {
              baseColorTexture: { index: 0 },
            },
          },
        ],
      }),
    ]);
    const decoded = decodedImage();

    const report = createNoFetchGlbSourceLoaderReport({
      source,
      createAssetMapping: true,
      decodedImageData: new Map([[0, decoded]]),
    });

    const sourceData =
      report.glbImportReport.importReport?.assetMapping?.textures[0]?.texture
        ?.sourceData;
    expect(report.glbImportReport.valid).toBe(true);
    expect(sourceData?.bytes).toBe(decoded.sourceData.bytes);
  });

  it("preserves malformed chunk-order diagnostics in facade status", () => {
    const reports = [
      createNoFetchGlbSourceLoaderReport({
        source: createGlb([
          jsonChunk({ asset: { version: "2.0" } }),
          jsonChunk({ asset: { version: "2.0" }, scene: 0 }),
        ]),
      }),
      createNoFetchGlbSourceLoaderReport({
        source: createGlb([
          jsonChunk({ asset: { version: "2.0" } }),
          bytesChunk(GLB_BINARY_CHUNK_TYPE, [1, 2, 3, 4]),
          bytesChunk(GLB_BINARY_CHUNK_TYPE, [5, 6, 7, 8]),
        ]),
      }),
      createNoFetchGlbSourceLoaderReport({
        source: createGlb([
          bytesChunk(GLB_BINARY_CHUNK_TYPE, [1, 2, 3, 4]),
          jsonChunk({ asset: { version: "2.0" } }),
        ]),
      }),
    ];
    const statuses = reports.map((report) => report.status);
    const serialized = JSON.stringify(statuses);

    expect(statuses).toMatchObject([
      {
        status: "failed",
        diagnostics: [{ code: "glb.duplicateJsonChunk", severity: "error" }],
        glbSourceStatus: {
          valid: false,
          importStages: [],
          diagnostics: [{ code: "glb.duplicateJsonChunk", severity: "error" }],
        },
      },
      {
        status: "failed",
        diagnostics: [{ code: "glb.duplicateBinaryChunk", severity: "error" }],
        glbSourceStatus: {
          valid: false,
          importStages: [],
          diagnostics: [
            { code: "glb.duplicateBinaryChunk", severity: "error" },
          ],
        },
      },
      {
        status: "failed",
        diagnostics: [{ code: "glb.missingJsonChunk", severity: "error" }],
        glbSourceStatus: {
          valid: false,
          importStages: [],
          diagnostics: [{ code: "glb.missingJsonChunk", severity: "error" }],
        },
      },
    ]);
    expect(serialized).not.toContain("binaryChunk");
    expect(serialized).not.toContain("jsonText");
    expect(serialized).not.toContain("Uint8Array");
    expect(serialized).not.toContain('"asset":{"version":"2.0"}');
  });

  it("summarizes invalid browser-shaped mesh input without raw source bytes", () => {
    const source = createGlb([jsonChunk(browserShapedRootWithoutBufferData())]);
    const report = createNoFetchGlbSourceLoaderReport({
      source,
      createMeshAssets: true,
    });
    const serialized = JSON.stringify(report.outputSummary);

    expect(report.glbImportReport.valid).toBe(false);
    expect(report.outputSummary.meshConstruction).toMatchObject({
      status: "invalid",
      valid: false,
      diagnosticsCount: expect.any(Number),
    });
    expect(
      report.outputSummary.meshConstruction.diagnosticsCount,
    ).toBeGreaterThan(0);
    expect(serialized).not.toContain("Uint8Array");
    expect(serialized).not.toContain("Float32Array");
    expect(serialized).not.toContain('"accessors":[{},{},{}]');
  });

  it("attaches provided source-registration summaries without registry mutation", () => {
    const source = createGlb([
      jsonChunk({
        asset: { version: "2.0" },
        scene: 0,
        scenes: [{ nodes: [0] }],
        nodes: [{ name: "Root" }],
      }),
    ]);
    const report = createNoFetchGlbSourceLoaderReport({
      source,
      sourceRegistration: {
        valid: true,
        sourceRegistration: null,
        meshRegistration: null,
        stages: [
          {
            stage: "materialTextureSamplerRegistration",
            status: "provided",
            writtenCount: 2,
            skippedCount: 0,
            diagnosticCount: 0,
          },
          {
            stage: "meshRegistration",
            status: "provided",
            writtenCount: 1,
            skippedCount: 0,
            diagnosticCount: 0,
          },
        ],
        diagnostics: [],
      },
    });
    const serialized = JSON.stringify(report.outputSummary);

    expect(report.outputSummary.sourceRegistration).toEqual({
      status: "ready",
      valid: true,
      writtenCount: 3,
      skippedCount: 0,
      diagnosticsCount: 0,
      stages: [
        {
          stage: "materialTextureSamplerRegistration",
          status: "provided",
          writtenCount: 2,
          skippedCount: 0,
          diagnosticCount: 0,
        },
        {
          stage: "meshRegistration",
          status: "provided",
          writtenCount: 1,
          skippedCount: 0,
          diagnosticCount: 0,
        },
      ],
    });
    expect(serialized).not.toContain("AssetRegistry");
    expect(serialized).not.toContain("entitiesByKey");
    expect(serialized).not.toContain("GPU");
  });

  it("attaches provided ECS command-plan summaries without replay", () => {
    const source = createGlb([
      jsonChunk({
        asset: { version: "2.0" },
        scene: 0,
        scenes: [{ nodes: [0] }],
        nodes: [{ name: "Root" }],
      }),
    ]);
    const ecsCommandPlan = createGltfEcsAuthoringCommandPlan({
      traversalReport: createGltfSceneTraversalReport({
        root: {
          asset: { version: "2.0" },
          scene: 0,
          scenes: [{ nodes: [0] }],
          nodes: [{ name: "Root" }],
        },
      }),
    });

    const report = createNoFetchGlbSourceLoaderReport({
      source,
      ecsCommandPlan,
    });
    const serialized = JSON.stringify(report.outputSummary);

    expect(report.outputSummary.ecsCommandPlan).toMatchObject({
      status: "ready",
      valid: true,
      sceneIndex: 0,
      rootEntityCount: 1,
      commandCount: 12,
      createEntityCount: 2,
      addComponentCount: 10,
      dependencyCount: 0,
      skippedCount: 0,
      diagnosticsCount: 0,
    });
    expect(report.outputSummary.ecsReplayReadiness).toMatchObject({
      status: "ready",
      ready: true,
      expectedCreateEntityCount: 2,
      expectedAddComponentCount: 10,
      blockerCount: 0,
      blockers: [],
    });
    expect(serialized).not.toContain("entityKey");
    expect(serialized).not.toContain('LocalTransform":{"translation"');
    expect(serialized).not.toContain("Elics");
    expect(serialized).not.toContain("AssetRegistry");
    expect(serialized).not.toContain("GPU");
  });

  it("attaches invalid ECS command-plan summaries without exposing commands", () => {
    const source = createGlb([
      jsonChunk({
        asset: { version: "2.0" },
        scene: 0,
        scenes: [{ nodes: [0] }],
        nodes: [{ name: "Root" }],
      }),
    ]);
    const ecsCommandPlan = createGltfEcsAuthoringCommandPlan({
      traversalReport: createGltfSceneTraversalReport({
        root: {
          asset: { version: "2.0" },
          scene: 0,
          scenes: [{ nodes: [0] }],
          nodes: [
            {
              name: "MatrixRoot",
              matrix: [1, 0.25, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 4, 5, 6, 1],
            },
          ],
        },
      }),
    });

    const report = createNoFetchGlbSourceLoaderReport({
      source,
      ecsCommandPlan,
    });
    const serialized = JSON.stringify(report.outputSummary.ecsCommandPlan);

    expect(ecsCommandPlan.valid).toBe(false);
    expect(report.outputSummary.ecsCommandPlan).toMatchObject({
      status: "invalid",
      valid: false,
      sceneIndex: 0,
      rootEntityCount: 1,
      commandCount: 0,
      createEntityCount: 0,
      addComponentCount: 0,
      dependencyCount: 0,
      skippedCount: 0,
      diagnosticsCount: 1,
    });
    expect(report.outputSummary.ecsReplayReadiness).toMatchObject({
      status: "blocked",
      ready: false,
      expectedCreateEntityCount: 0,
      expectedAddComponentCount: 0,
      blockerCount: 1,
      blockers: [{ code: "gltfEcsReplayReadiness.invalidPlan", count: 1 }],
    });
    expect(serialized).not.toContain("MatrixRoot");
    expect(serialized).not.toContain("entityKey");
    expect(serialized).not.toContain("commands");
  });
});

function absentReplayReadiness() {
  return {
    status: "absent",
    ready: null,
    reason: "No ECS command plan was provided.",
    requiredWorld: true,
    wouldRegisterComponents: true,
    expectedCreateEntityCount: 0,
    expectedAddComponentCount: 0,
    requiredComponents: [],
    blockerCount: 0,
    blockers: [],
  };
}

function splitIndexedRoot() {
  const positionBytes = new Uint8Array(36);
  const positionView = new DataView(positionBytes.buffer);
  [0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((value, index) =>
    positionView.setFloat32(index * 4, value, true),
  );

  const indexBytes = new Uint8Array(6);
  const indexView = new DataView(indexBytes.buffer);
  [0, 1, 2].forEach((value, index) =>
    indexView.setUint16(index * 2, value, true),
  );

  return {
    positionBytes,
    indexBytes,
    root: {
      asset: { version: "2.0" },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ name: "Split Indexed", mesh: 0 }],
      buffers: [
        { byteLength: positionBytes.byteLength },
        { byteLength: indexBytes.byteLength, uri: "indices.bin" },
      ],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: positionBytes.byteLength },
        { buffer: 1, byteOffset: 0, byteLength: indexBytes.byteLength },
      ],
      accessors: [
        { bufferView: 0, componentType: 5126, type: "VEC3", count: 3 },
        { bufferView: 1, componentType: 5123, type: "SCALAR", count: 3 },
      ],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    },
  };
}

function browserShapedRootWithoutBufferData() {
  return {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0, 1, 2] }],
    nodes: [
      { name: "Plane", mesh: 0 },
      { name: "Box", mesh: 1 },
      { name: "Cone", mesh: 2 },
    ],
    accessors: [{}, {}, {}],
    meshes: [
      { primitives: [{ attributes: { POSITION: 0 }, material: 0 }] },
      { primitives: [{ attributes: { POSITION: 1 }, material: 1 }] },
      { primitives: [{ attributes: { POSITION: 2 }, material: 0 }] },
    ],
    materials: [
      { pbrMetallicRoughness: { baseColorFactor: [0.2, 0.42, 1, 1] } },
      {
        pbrMetallicRoughness: { baseColorFactor: [1, 0.36, 0.18, 1] },
        extensions: { KHR_materials_unlit: {} },
      },
    ],
  };
}

function decodedImage() {
  return {
    width: 1,
    height: 1,
    sourceData: {
      bytes: new Uint8Array([255, 0, 0, 255]),
      bytesPerRow: 4,
      rowsPerImage: 1,
    },
  };
}
