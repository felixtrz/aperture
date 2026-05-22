import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  createMeshoptDecoder,
  createGltfReportDrivenImportReportFromGlb,
  createNoFetchGlbSourceLoaderReport,
  parseGlbContainer,
} from "../../packages/render/src/index.js";

const EXAMPLES_ASSET_DIR = new URL("../../examples/assets/", import.meta.url);

async function createFixtureDecoder() {
  return createMeshoptDecoder({
    jsSource: await readFile(
      new URL("meshopt/meshopt_decoder.module.js", EXAMPLES_ASSET_DIR),
      "utf8",
    ),
  });
}

async function readAsset(name: string): Promise<Uint8Array> {
  return readFile(new URL(name, EXAMPLES_ASSET_DIR));
}

describe("createMeshoptDecoder", () => {
  it("decodes EXT_meshopt_compression bufferView payloads", async () => {
    const decoder = await createFixtureDecoder();
    const parsed = parseGlbContainer(await readAsset("meshopt-cube.glb"));
    expect(parsed.ok).toBe(true);

    const root = parsed.container?.json;
    const bufferView = Array.isArray(root?.bufferViews)
      ? root.bufferViews[0]
      : null;
    const extension =
      bufferView !== null &&
      typeof bufferView === "object" &&
      !Array.isArray(bufferView) &&
      "extensions" in bufferView &&
      bufferView.extensions !== null &&
      typeof bufferView.extensions === "object" &&
      !Array.isArray(bufferView.extensions)
        ? (
            bufferView.extensions as {
              readonly EXT_meshopt_compression?: {
                readonly byteOffset: number;
                readonly byteLength: number;
                readonly byteStride: number;
                readonly count: number;
                readonly mode: "ATTRIBUTES";
              };
            }
          ).EXT_meshopt_compression
        : undefined;
    const binary = parsed.container?.binaryChunk;

    expect(extension).toBeDefined();
    expect(binary).toBeInstanceOf(Uint8Array);

    const decoded = decoder.decodeGltfBuffer(
      binary!.subarray(
        extension!.byteOffset,
        extension!.byteOffset + extension!.byteLength,
      ),
      {
        count: extension!.count,
        byteStride: extension!.byteStride,
        mode: extension!.mode,
      },
    );
    const firstPosition = new Float32Array(
      decoded.buffer,
      decoded.byteOffset,
      3,
    );

    expect(decoded).toHaveLength(480);
    expect(Array.from(firstPosition)).toEqual([0.5, -0.5, -0.5]);
  });

  it("threads EXT_meshopt_compression through GLB mesh construction", async () => {
    const decoder = await createFixtureDecoder();
    const source = await readAsset("meshopt-cube.glb");

    const report = createGltfReportDrivenImportReportFromGlb({
      source,
      createAssetMapping: true,
      createMeshAssets: true,
      meshoptDecoder: decoder,
    });

    expect(report.valid).toBe(true);
    expect(report.importReport?.root.valid).toBe(true);
    expect(report.importReport?.accessorDecoding?.diagnostics).toEqual([]);
    expect(
      report.importReport?.meshConstruction?.meshes[0]?.mesh,
    ).toMatchObject({
      kind: "mesh",
      label: "mesh:gltf:mesh:0:primitive:0",
      submeshes: [{ vertexCount: 24, indexCount: 36 }],
    });
  });

  it("reports compressed bufferViews when no Meshopt decoder is provided", async () => {
    const source = await readAsset("meshopt-cube.glb");

    const report = createGltfReportDrivenImportReportFromGlb({
      source,
      createAssetMapping: true,
      createMeshAssets: true,
    });

    expect(report.valid).toBe(false);
    expect(report.importReport?.accessorDecoding?.diagnostics).toMatchObject([
      {
        code: "gltfMeshoptDecode.decoderRequired",
        severity: "error",
        bufferViewIndex: 0,
      },
      {
        code: "gltfMeshoptDecode.decoderRequired",
        severity: "error",
        bufferViewIndex: 1,
      },
    ]);
  });

  it("surfaces Meshopt requirements in the source-loader summary", async () => {
    const decoder = await createFixtureDecoder();
    const source = await readAsset("meshopt-cube.glb");

    const loader = createNoFetchGlbSourceLoaderReport({
      source,
      createAssetMapping: true,
      createMeshAssets: true,
      meshoptDecoder: decoder,
    });

    expect(loader.status.status).toBe("loaded");
    expect(loader.outputSummary.meshConstruction).toMatchObject({
      status: "ready",
      vertexCount: 24,
      indexCount: 36,
      diagnosticsCount: 0,
    });
  });
});
