import { describe, expect, it } from "vitest";

import {
  GLB_BINARY_CHUNK_TYPE,
  GLB_CHUNK_HEADER_BYTE_LENGTH,
  GLB_CONTAINER_MAGIC,
  GLB_CONTAINER_VERSION,
  GLB_HEADER_BYTE_LENGTH,
  GLB_JSON_CHUNK_TYPE,
  createGlbSourceLoaderOutputSummaryJsonValue,
  createGltfEcsAuthoringCommandPlan,
  createGltfReportDrivenImportReportFromGlb,
  createGltfSceneTraversalReport,
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

describe("GLB source-loader output summary", () => {
  it("reports absent mesh summary when mesh construction is not requested", () => {
    const report = createGltfReportDrivenImportReportFromGlb({
      source: createGlb([jsonChunk(minimalRoot())]),
    });

    expect(createGlbSourceLoaderOutputSummaryJsonValue(report)).toEqual({
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
  });

  it("summarizes valid mesh construction without raw arrays", () => {
    const { root, bytes } = indexedRoot();
    const report = createGltfReportDrivenImportReportFromGlb({
      source: createGlb([
        jsonChunk(root),
        bytesChunk(GLB_BINARY_CHUNK_TYPE, Array.from(bytes)),
      ]),
      createMeshAssets: true,
    });

    const summary = createGlbSourceLoaderOutputSummaryJsonValue(report);
    const serialized = JSON.stringify(summary);

    expect(summary).toEqual({
      meshConstruction: {
        status: "ready",
        valid: true,
        meshCount: 1,
        submeshCount: 1,
        vertexCount: 3,
        indexCount: 3,
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
    expect(serialized).not.toContain("Float32Array");
    expect(serialized).not.toContain("Uint16Array");
    expect(serialized).not.toContain("[0,1,2]");
  });

  it("summarizes invalid mesh construction dependencies", () => {
    const { root, bytes } = indexedRoot({ declaredBufferByteLength: 40 });
    const report = createGltfReportDrivenImportReportFromGlb({
      source: createGlb([
        jsonChunk(root),
        bytesChunk(GLB_BINARY_CHUNK_TYPE, Array.from(bytes)),
      ]),
      createMeshAssets: true,
    });

    const summary = createGlbSourceLoaderOutputSummaryJsonValue(report);

    expect(summary.meshConstruction).toMatchObject({
      status: "invalid",
      valid: false,
      diagnosticsCount: expect.any(Number),
    });
    expect(summary.meshConstruction.diagnosticsCount).toBeGreaterThan(0);
  });

  it("summarizes valid source registration reports", () => {
    const report = createGltfReportDrivenImportReportFromGlb({
      source: createGlb([jsonChunk(minimalRoot())]),
    });
    const summary = createGlbSourceLoaderOutputSummaryJsonValue(report, {
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

    expect(summary.sourceRegistration).toEqual({
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
  });

  it("summarizes invalid source registration reports", () => {
    const report = createGltfReportDrivenImportReportFromGlb({
      source: createGlb([jsonChunk(minimalRoot())]),
    });
    const summary = createGlbSourceLoaderOutputSummaryJsonValue(report, {
      sourceRegistration: {
        valid: false,
        sourceRegistration: null,
        meshRegistration: null,
        stages: [
          {
            stage: "materialTextureSamplerRegistration",
            status: "failed",
            writtenCount: 0,
            skippedCount: 1,
            diagnosticCount: 1,
          },
          {
            stage: "meshRegistration",
            status: "missing",
            writtenCount: 0,
            skippedCount: 0,
            diagnosticCount: 0,
          },
        ],
        diagnostics: [
          {
            code: "gltfSourceRegistration.failedStage",
            severity: "error",
            stage: "materialTextureSamplerRegistration",
            message: "GLB source registration stage failed.",
          },
        ],
      },
    });
    const serialized = JSON.stringify(summary);

    expect(summary.sourceRegistration).toMatchObject({
      status: "invalid",
      valid: false,
      writtenCount: 0,
      skippedCount: 1,
      diagnosticsCount: 2,
    });
    expect(serialized).not.toContain("AssetRegistry");
    expect(serialized).not.toContain("GPU");
    expect(serialized).not.toContain("entitiesByKey");
  });

  it("summarizes valid ECS command plans without full command payloads", () => {
    const report = createGltfReportDrivenImportReportFromGlb({
      source: createGlb([jsonChunk(minimalRoot())]),
    });
    const commandPlan = createGltfEcsAuthoringCommandPlan({
      traversalReport: createGltfSceneTraversalReport({
        root: {
          asset: { version: "2.0" },
          scene: 0,
          scenes: [{ nodes: [0] }],
          nodes: [{ name: "Root" }],
        },
      }),
    });

    const summary = createGlbSourceLoaderOutputSummaryJsonValue(report, {
      ecsCommandPlan: commandPlan,
    });
    const serialized = JSON.stringify(summary.ecsCommandPlan);

    expect(summary.ecsCommandPlan).toEqual({
      status: "ready",
      valid: true,
      sceneIndex: 0,
      rootEntityCount: 1,
      commandCount: 12,
      createEntityCount: 2,
      addComponentCount: 10,
      componentCounts: [
        { component: "Name", count: 2 },
        { component: "LocalTransform", count: 2 },
        { component: "Parent", count: 2 },
        { component: "WorldTransform", count: 2 },
        { component: "Visibility", count: 2 },
      ],
      dependencyCount: 0,
      skippedCount: 0,
      diagnosticsCount: 0,
    });
    expect(summary.ecsReplayReadiness).toMatchObject({
      status: "ready",
      ready: true,
      expectedCreateEntityCount: 2,
      expectedAddComponentCount: 10,
      blockerCount: 0,
      blockers: [],
    });
    expect(serialized).not.toContain("entityKey");
    expect(serialized).not.toContain("label");
    expect(serialized).not.toContain("value");
    expect(serialized).not.toContain('LocalTransform":{"translation"');
    expect(serialized).not.toContain("entitiesByKey");
    expect(serialized).not.toContain("GPU");
  });

  it("summarizes invalid ECS command plans and skipped diagnostics", () => {
    const report = createGltfReportDrivenImportReportFromGlb({
      source: createGlb([jsonChunk(minimalRoot())]),
    });
    const commandPlan = createGltfEcsAuthoringCommandPlan({
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

    const summary = createGlbSourceLoaderOutputSummaryJsonValue(report, {
      ecsCommandPlan: commandPlan,
    });
    const serialized = JSON.stringify(summary.ecsCommandPlan);

    expect(commandPlan.valid).toBe(false);
    expect(summary.ecsCommandPlan).toMatchObject({
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
    expect(summary.ecsReplayReadiness).toMatchObject({
      status: "blocked",
      ready: false,
      expectedCreateEntityCount: 0,
      expectedAddComponentCount: 0,
      blockerCount: 1,
      blockers: [{ code: "gltfEcsReplayReadiness.invalidPlan", count: 1 }],
    });
    expect(serialized).not.toContain("MatrixRoot");
    expect(serialized).not.toContain("matrix");
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

function minimalRoot() {
  return {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: "Root" }],
  };
}

function indexedRoot(
  options: { readonly declaredBufferByteLength?: number } = {},
) {
  const bytes = new Uint8Array(44);
  const view = new DataView(bytes.buffer);

  [0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((value, index) =>
    view.setFloat32(index * 4, value, true),
  );
  [0, 1, 2].forEach((value, index) =>
    view.setUint16(36 + index * 2, value, true),
  );

  return {
    bytes,
    root: {
      asset: { version: "2.0" },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ name: "Indexed", mesh: 0 }],
      buffers: [{ byteLength: options.declaredBufferByteLength ?? 42 }],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: 36 },
        { buffer: 0, byteOffset: 36, byteLength: 6 },
      ],
      accessors: [
        { bufferView: 0, componentType: 5126, type: "VEC3", count: 3 },
        { bufferView: 1, componentType: 5123, type: "SCALAR", count: 3 },
      ],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    },
  };
}
