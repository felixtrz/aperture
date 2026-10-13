export function createGltfSourceAssetTransferPackage(input) {
    const mainThread = compactSharedSourceViews(input);
    const transferList = collectTransferableSourceBuffers(mainThread);
    return {
        mainThread,
        extractionThread: {
            assetMapping: stripTextureSourceData(input.assetMapping),
            meshConstruction: stripMeshSourceData(input.meshConstruction),
        },
        transferList,
        transferredByteLength: transferList.reduce((sum, buffer) => sum + buffer.byteLength, 0),
    };
}
function compactSharedSourceViews(input) {
    return {
        assetMapping: compactAssetMappingSourceViews(input.assetMapping),
        meshConstruction: compactMeshConstructionSourceViews(input.meshConstruction),
    };
}
function collectTransferableSourceBuffers(input) {
    const buffers = new Set();
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
function addTransferableViewBuffer(buffers, view) {
    if (view === null ||
        view === undefined ||
        view.byteLength === 0 ||
        !(view.buffer instanceof ArrayBuffer)) {
        return;
    }
    buffers.add(view.buffer);
}
function stripTextureSourceData(report) {
    return {
        ...report,
        textures: report.textures.map((texture) => ({
            ...texture,
            texture: texture.texture === null
                ? null
                : stripTextureAssetSourceData(texture.texture),
        })),
    };
}
function compactAssetMappingSourceViews(report) {
    return {
        ...report,
        textures: report.textures.map((texture) => ({
            ...texture,
            texture: texture.texture === null
                ? null
                : compactTextureAssetSourceView(texture.texture),
        })),
    };
}
function compactTextureAssetSourceView(texture) {
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
function stripTextureAssetSourceData(texture) {
    const { sourceData: _sourceData, ...metadata } = texture;
    return metadata;
}
function stripMeshSourceData(report) {
    return {
        ...report,
        meshes: report.meshes.map((mesh) => ({
            ...mesh,
            mesh: mesh.mesh === null ? null : stripMeshAssetSourceData(mesh.mesh),
        })),
    };
}
function compactMeshConstructionSourceViews(report) {
    return {
        ...report,
        meshes: report.meshes.map((mesh) => ({
            ...mesh,
            mesh: mesh.mesh === null ? null : compactMeshAssetSourceViews(mesh.mesh),
        })),
    };
}
function compactMeshAssetSourceViews(mesh) {
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
function stripMeshAssetSourceData(mesh) {
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
                    data: mesh.indexBuffer.data instanceof Uint32Array
                        ? new Uint32Array(0)
                        : new Uint16Array(0),
                    indexCount: mesh.indexBuffer.indexCount ?? mesh.indexBuffer.data.length,
                },
            }),
    };
}
function emptyVertexDataFor(data) {
    if (data instanceof Uint16Array) {
        return new Uint16Array(0);
    }
    if (data instanceof Uint8Array) {
        return new Uint8Array(0);
    }
    return new Float32Array(0);
}
function compactTransferableView(view) {
    // Always copy: the transfer package cannot prove it owns the underlying
    // buffer. Source views regularly alias loader-cache memory (e.g. the
    // per-URI byte cache in loadGlbFromUri/loadGltfFromUri), and transferring
    // a cache-owned buffer detaches it for every later cache hit — the next
    // load of an asset sharing that URI then dies with "An ArrayBuffer is
    // detached and could not be cloned" when its report is posted. A fresh
    // slice keeps the transfer zero-copy across the thread boundary while
    // leaving the loader cache intact.
    return view.slice();
}
//# sourceMappingURL=gltf-source-report-transfer.js.map