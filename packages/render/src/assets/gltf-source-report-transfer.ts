import type { GltfAssetMappingReport } from "./gltf-asset-mapping.js";
import type { GltfMeshAssetConstructionReport } from "./gltf-mesh-asset-construction.js";
import type { MeshAsset } from "../mesh/index.js";
import type { TextureAsset } from "../materials/index.js";

export interface GltfSourceAssetTransferPackage {
  readonly mainThread: {
    readonly assetMapping: GltfAssetMappingReport;
    readonly meshConstruction: GltfMeshAssetConstructionReport;
  };
  readonly extractionThread: {
    readonly assetMapping: GltfAssetMappingReport;
    readonly meshConstruction: GltfMeshAssetConstructionReport;
  };
  readonly transferList: readonly ArrayBuffer[];
  readonly transferredByteLength: number;
}

export function createGltfSourceAssetTransferPackage(input: {
  readonly assetMapping: GltfAssetMappingReport;
  readonly meshConstruction: GltfMeshAssetConstructionReport;
}): GltfSourceAssetTransferPackage {
  const mainThread = compactSharedSourceViews(input);
  const transferList = collectTransferableSourceBuffers(mainThread);

  return {
    mainThread,
    extractionThread: {
      assetMapping: stripTextureSourceData(input.assetMapping),
      meshConstruction: stripMeshSourceData(input.meshConstruction),
    },
    transferList,
    transferredByteLength: transferList.reduce(
      (sum, buffer) => sum + buffer.byteLength,
      0,
    ),
  };
}

function compactSharedSourceViews(input: {
  readonly assetMapping: GltfAssetMappingReport;
  readonly meshConstruction: GltfMeshAssetConstructionReport;
}): GltfSourceAssetTransferPackage["mainThread"] {
  return {
    assetMapping: compactAssetMappingSourceViews(input.assetMapping),
    meshConstruction: compactMeshConstructionSourceViews(
      input.meshConstruction,
    ),
  };
}

function collectTransferableSourceBuffers(input: {
  readonly assetMapping: GltfAssetMappingReport;
  readonly meshConstruction: GltfMeshAssetConstructionReport;
}): ArrayBuffer[] {
  const buffers = new Set<ArrayBuffer>();

  for (const texture of input.assetMapping.textures) {
    addTransferableViewBuffer(buffers, texture.texture?.sourceData?.bytes);
  }

  for (const mesh of input.meshConstruction.meshes) {
    if (mesh.mesh === null) {
      continue;
    }

    for (const stream of mesh.mesh.vertexStreams) {
      addTransferableViewBuffer(buffers, stream.data);
    }

    addTransferableViewBuffer(buffers, mesh.mesh.indexBuffer?.data);
  }

  return [...buffers];
}

function addTransferableViewBuffer(
  buffers: Set<ArrayBuffer>,
  view: ArrayBufferView | null | undefined,
): void {
  if (
    view === null ||
    view === undefined ||
    view.byteLength === 0 ||
    !(view.buffer instanceof ArrayBuffer)
  ) {
    return;
  }

  buffers.add(view.buffer);
}

function stripTextureSourceData(
  report: GltfAssetMappingReport,
): GltfAssetMappingReport {
  return {
    ...report,
    textures: report.textures.map((texture) => ({
      ...texture,
      texture:
        texture.texture === null
          ? null
          : stripTextureAssetSourceData(texture.texture),
    })),
  };
}

function compactAssetMappingSourceViews(
  report: GltfAssetMappingReport,
): GltfAssetMappingReport {
  return {
    ...report,
    textures: report.textures.map((texture) => ({
      ...texture,
      texture:
        texture.texture === null
          ? null
          : compactTextureAssetSourceView(texture.texture),
    })),
  };
}

function compactTextureAssetSourceView(texture: TextureAsset): TextureAsset {
  if (texture.sourceData === undefined) {
    return texture;
  }

  return {
    ...texture,
    sourceData: {
      ...texture.sourceData,
      bytes: compactTransferableView(texture.sourceData.bytes),
    },
  };
}

function stripTextureAssetSourceData(texture: TextureAsset): TextureAsset {
  const { sourceData: _sourceData, ...metadata } = texture;

  return metadata;
}

function stripMeshSourceData(
  report: GltfMeshAssetConstructionReport,
): GltfMeshAssetConstructionReport {
  return {
    ...report,
    meshes: report.meshes.map((mesh) => ({
      ...mesh,
      mesh: mesh.mesh === null ? null : stripMeshAssetSourceData(mesh.mesh),
    })),
  };
}

function compactMeshConstructionSourceViews(
  report: GltfMeshAssetConstructionReport,
): GltfMeshAssetConstructionReport {
  return {
    ...report,
    meshes: report.meshes.map((mesh) => ({
      ...mesh,
      mesh: mesh.mesh === null ? null : compactMeshAssetSourceViews(mesh.mesh),
    })),
  };
}

function compactMeshAssetSourceViews(mesh: MeshAsset): MeshAsset {
  return {
    ...mesh,
    vertexStreams: mesh.vertexStreams.map((stream) => ({
      ...stream,
      data: compactTransferableView(stream.data),
    })),
    ...(mesh.indexBuffer === undefined
      ? {}
      : {
          indexBuffer: {
            ...mesh.indexBuffer,
            data: compactTransferableView(mesh.indexBuffer.data),
          },
        }),
  };
}

function stripMeshAssetSourceData(mesh: MeshAsset): MeshAsset {
  return {
    ...mesh,
    vertexStreams: mesh.vertexStreams.map((stream) => ({
      ...stream,
      data: emptyVertexDataFor(stream.data),
    })),
    ...(mesh.indexBuffer === undefined
      ? {}
      : {
          indexBuffer: {
            ...mesh.indexBuffer,
            data:
              mesh.indexBuffer.data instanceof Uint32Array
                ? new Uint32Array(0)
                : new Uint16Array(0),
            indexCount:
              mesh.indexBuffer.indexCount ?? mesh.indexBuffer.data.length,
          },
        }),
  };
}

function emptyVertexDataFor(
  data: MeshAsset["vertexStreams"][number]["data"],
): MeshAsset["vertexStreams"][number]["data"] {
  if (data instanceof Uint16Array) {
    return new Uint16Array(0);
  }

  if (data instanceof Uint8Array) {
    return new Uint8Array(0);
  }

  return new Float32Array(0);
}

function compactTransferableView<
  T extends Uint8Array | Uint16Array | Uint32Array | Float32Array,
>(view: T): T {
  // Always copy: the transfer package cannot prove it owns the underlying
  // buffer. Source views regularly alias loader-cache memory (e.g. the
  // per-URI byte cache in loadGlbFromUri/loadGltfFromUri), and transferring
  // a cache-owned buffer detaches it for every later cache hit — the next
  // load of an asset sharing that URI then dies with "An ArrayBuffer is
  // detached and could not be cloned" when its report is posted. A fresh
  // slice keeps the transfer zero-copy across the thread boundary while
  // leaving the loader cache intact.
  return view.slice() as T;
}
