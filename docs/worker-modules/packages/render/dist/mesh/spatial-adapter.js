export function createSpatialTriangleMeshFromMeshAsset(mesh) {
    const diagnostics = [];
    const position = findAttribute(mesh, "POSITION");
    if (position === null) {
        diagnostics.push({
            code: "spatial.mesh.missing-position",
            severity: "error",
            message: `Mesh '${mesh.label}' cannot be queried because it has no POSITION attribute.`,
            suggestedFix: "Provide a float32x3 POSITION stream before building spatial queries.",
        });
        return { mesh: null, diagnostics };
    }
    if (position.attribute.format !== "float32x3") {
        diagnostics.push({
            code: "spatial.mesh.unsupported-position-format",
            severity: "error",
            message: `Mesh '${mesh.label}' POSITION format '${position.attribute.format}' is not supported for CPU spatial queries.`,
            suggestedFix: "Decode or convert POSITION data to float32x3 before building a mesh BVH.",
        });
        return { mesh: null, diagnostics };
    }
    const normals = optionalAttribute(mesh, "NORMAL", "float32x3", diagnostics);
    const uvs = optionalAttribute(mesh, "TEXCOORD_0", "float32x2", diagnostics);
    const unsupportedSubmesh = mesh.submeshes.find((submesh) => submesh.topology !== "triangle-list");
    if (unsupportedSubmesh !== undefined) {
        diagnostics.push({
            code: "spatial.mesh.unsupported-topology",
            severity: "error",
            message: `Mesh '${mesh.label}' submesh '${unsupportedSubmesh.label}' uses topology '${unsupportedSubmesh.topology}', but CPU mesh queries currently support triangle-list only.`,
            suggestedFix: "Use triangle-list geometry or add a topology-specific spatial query adapter.",
        });
        return { mesh: null, diagnostics };
    }
    const indices = adaptIndexBuffer(mesh.indexBuffer, mesh.label, diagnostics);
    if (indices === null) {
        return { mesh: null, diagnostics };
    }
    const spatialMesh = {
        positions: adaptAttribute(position.stream, position.attribute),
        vertexCount: position.stream.vertexCount,
        ...(normals === null ? {} : { normals }),
        ...(uvs === null ? {} : { uvs }),
        submeshes: mesh.submeshes.map(adaptSubmesh),
    };
    if (indices !== undefined) {
        return { mesh: { ...spatialMesh, indices }, diagnostics };
    }
    return { mesh: spatialMesh, diagnostics };
}
function findAttribute(mesh, semantic) {
    for (const stream of mesh.vertexStreams) {
        const attribute = stream.attributes.find((candidate) => candidate.semantic === semantic);
        if (attribute !== undefined) {
            return { stream, attribute };
        }
    }
    return null;
}
function optionalAttribute(mesh, semantic, expectedFormat, diagnostics) {
    const attribute = findAttribute(mesh, semantic);
    if (attribute === null) {
        return null;
    }
    if (attribute.attribute.format !== expectedFormat) {
        const label = semantic === "NORMAL"
            ? "spatial.mesh.unsupported-normal-format"
            : "spatial.mesh.unsupported-uv-format";
        diagnostics.push({
            code: label,
            severity: "warning",
            message: `Mesh '${mesh.label}' ${semantic} format '${attribute.attribute.format}' is ignored by CPU spatial queries.`,
            suggestedFix: `Use ${expectedFormat} ${semantic} data when query results need this attribute.`,
        });
        return null;
    }
    return adaptAttribute(attribute.stream, attribute.attribute);
}
function adaptAttribute(stream, attribute) {
    const componentBytes = bytesPerComponent(attribute.format);
    const data = attributeDataView(stream, attribute, componentBytes);
    return {
        data,
        offset: data === stream.data ? attribute.offset / componentBytes : 0,
        stride: stream.arrayStride / componentBytes,
    };
}
function attributeDataView(stream, attribute, componentBytes) {
    const componentCount = componentsPerFormat(attribute.format);
    const byteOffset = stream.data.byteOffset + attribute.offset;
    if (stream.arrayStride % componentBytes !== 0 ||
        attribute.offset % componentBytes !== 0 ||
        byteOffset % componentBytes !== 0) {
        return stream.data;
    }
    const byteLength = stream.vertexCount === 0
        ? 0
        : (stream.vertexCount - 1) * stream.arrayStride +
            componentCount * componentBytes;
    if (attribute.offset + byteLength > stream.data.byteLength) {
        return stream.data;
    }
    const length = byteLength / componentBytes;
    if (attribute.format.startsWith("float32")) {
        return new Float32Array(stream.data.buffer, byteOffset, length);
    }
    if (attribute.format.startsWith("uint16") ||
        attribute.format.startsWith("unorm16")) {
        return new Uint16Array(stream.data.buffer, byteOffset, length);
    }
    return new Uint8Array(stream.data.buffer, byteOffset, length);
}
function adaptIndexBuffer(indexBuffer, meshLabel, diagnostics) {
    if (indexBuffer === undefined) {
        return undefined;
    }
    if (indexBuffer.format !== "uint16" && indexBuffer.format !== "uint32") {
        diagnostics.push({
            code: "spatial.mesh.unsupported-index-format",
            severity: "error",
            message: `Mesh '${meshLabel}' index format '${indexBuffer.format}' is not supported for CPU spatial queries.`,
            suggestedFix: "Use uint16 or uint32 index data.",
        });
        return null;
    }
    return indexBuffer.indexCount === undefined
        ? indexBuffer.data
        : indexBuffer.data.subarray(0, indexBuffer.indexCount);
}
function adaptSubmesh(submesh) {
    return {
        label: submesh.label,
        topology: "triangle-list",
        materialSlot: submesh.materialSlot,
        vertexStart: submesh.vertexStart,
        vertexCount: submesh.vertexCount,
        indexStart: submesh.indexStart,
        indexCount: submesh.indexCount,
    };
}
function bytesPerComponent(format) {
    if (format.startsWith("float32"))
        return 4;
    if (format.startsWith("uint16") || format.startsWith("unorm16"))
        return 2;
    return 1;
}
function componentsPerFormat(format) {
    if (format.endsWith("x2"))
        return 2;
    if (format.endsWith("x3"))
        return 3;
    if (format.endsWith("x4"))
        return 4;
    return 1;
}
//# sourceMappingURL=spatial-adapter.js.map