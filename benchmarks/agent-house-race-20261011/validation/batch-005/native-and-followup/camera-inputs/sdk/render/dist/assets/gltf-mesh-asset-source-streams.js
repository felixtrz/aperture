import { meshVertexFormatByteSize, meshVertexFormatForDecodedAccessor, } from "./gltf-mesh-asset-vertex-formats.js";
export function createSourceVertexStreams(vertexCount, sources) {
    const candidates = new Map();
    for (const source of sources) {
        const candidate = sourceVertexStreamCandidate(source);
        if (candidate === null) {
            return null;
        }
        const existing = candidates.get(candidate.key);
        if (existing === undefined) {
            candidates.set(candidate.key, candidate);
            continue;
        }
        if (existing.sourceView.buffer !== candidate.sourceView.buffer ||
            existing.sourceView.byteOffset !== candidate.sourceView.byteOffset ||
            existing.sourceView.byteLength !== candidate.sourceView.byteLength ||
            existing.arrayStride !== candidate.arrayStride) {
            return null;
        }
        existing.attributes.push(...candidate.attributes);
    }
    const streams = [...candidates.values()].flatMap((candidate) => createSourceVertexStream(vertexCount, candidate));
    return streams.length === candidates.size ? streams : null;
}
function sourceVertexStreamCandidate(source) {
    const decoded = source.decoded;
    if (decoded.sourceView === undefined ||
        decoded.sourceBufferViewIndex === undefined ||
        decoded.sourceByteStride === undefined ||
        decoded.sourceViewByteOffset === undefined ||
        decoded.sourceElementByteSize === undefined) {
        return null;
    }
    return {
        key: `${decoded.bufferIndex}:${decoded.sourceBufferViewIndex}:${decoded.sourceByteStride}`,
        sourceView: decoded.sourceView,
        arrayStride: decoded.sourceByteStride,
        attributes: [
            {
                semantic: decoded.semantic,
                format: meshVertexFormatForDecodedAccessor(decoded),
                offset: decoded.sourceViewByteOffset,
            },
        ],
    };
}
function createSourceVertexStream(vertexCount, candidate) {
    const attributes = [...candidate.attributes].sort((left, right) => left.offset - right.offset);
    let previousEnd = 0;
    let requiredByteLength = 0;
    for (const attribute of attributes) {
        if (attribute.offset < previousEnd) {
            return [];
        }
        const attributeEnd = attribute.offset + meshVertexFormatByteSize(attribute.format);
        if (attributeEnd > candidate.arrayStride) {
            return [];
        }
        previousEnd = attributeEnd;
        requiredByteLength = Math.max(requiredByteLength, vertexCount === 0
            ? 0
            : (vertexCount - 1) * candidate.arrayStride + attributeEnd);
    }
    if (candidate.sourceView.byteLength < requiredByteLength) {
        return [];
    }
    return [
        {
            id: `gltf-source-buffer-view:${candidate.key}`,
            arrayStride: candidate.arrayStride,
            vertexCount,
            attributes,
            data: candidate.sourceView,
        },
    ];
}
//# sourceMappingURL=gltf-mesh-asset-source-streams.js.map