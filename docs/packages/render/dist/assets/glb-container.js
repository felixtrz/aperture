import { GLB_CONTAINER_MAGIC, GLB_CONTAINER_VERSION, GLB_HEADER_BYTE_LENGTH, GLB_JSON_CHUNK_TYPE, } from "./glb-container-types.js";
import { createErrorDiagnostic, hasErrorDiagnostics, } from "./glb-container-diagnostics.js";
import { scanGlbContainerChunks } from "./glb-container-chunks.js";
import { decodeGlbJson, parseJsonObject, sourceToDataView, } from "./glb-container-utils.js";
export { GLB_BINARY_CHUNK_TYPE, GLB_CHUNK_HEADER_BYTE_LENGTH, GLB_CONTAINER_MAGIC, GLB_CONTAINER_VERSION, GLB_HEADER_BYTE_LENGTH, GLB_JSON_CHUNK_TYPE, } from "./glb-container-types.js";
export function parseGlbContainer(source) {
    const data = sourceToDataView(source);
    const diagnostics = [];
    if (data.byteLength < GLB_HEADER_BYTE_LENGTH) {
        diagnostics.push(createErrorDiagnostic({
            code: "glb.tooShort",
            message: `GLB data must be at least ${GLB_HEADER_BYTE_LENGTH} bytes.`,
            byteOffset: 0,
            byteLength: data.byteLength,
        }));
        return { ok: false, container: null, diagnostics };
    }
    const magic = data.getUint32(0, true);
    const version = data.getUint32(4, true);
    const declaredLength = data.getUint32(8, true);
    if (magic !== GLB_CONTAINER_MAGIC) {
        diagnostics.push(createErrorDiagnostic({
            code: "glb.invalidMagic",
            message: `GLB magic must be 0x${GLB_CONTAINER_MAGIC.toString(16)}.`,
            byteOffset: 0,
            byteLength: 4,
        }));
    }
    if (version !== GLB_CONTAINER_VERSION) {
        diagnostics.push(createErrorDiagnostic({
            code: "glb.unsupportedVersion",
            message: `GLB version must be ${GLB_CONTAINER_VERSION}.`,
            byteOffset: 4,
            byteLength: 4,
        }));
    }
    if (declaredLength !== data.byteLength) {
        diagnostics.push(createErrorDiagnostic({
            code: "glb.lengthMismatch",
            message: `GLB declared length ${declaredLength} does not match source length ${data.byteLength}.`,
            byteOffset: 8,
            byteLength: 4,
        }));
    }
    if (hasErrorDiagnostics(diagnostics)) {
        return { ok: false, container: null, diagnostics };
    }
    const chunkScan = scanGlbContainerChunks({ source, data, declaredLength });
    diagnostics.push(...chunkScan.diagnostics);
    if (!hasErrorDiagnostics(diagnostics) && chunkScan.jsonBytes === null) {
        diagnostics.push(createErrorDiagnostic({
            code: "glb.missingJsonChunk",
            message: "GLB JSON chunk is missing.",
            byteOffset: GLB_HEADER_BYTE_LENGTH,
        }));
    }
    if (hasErrorDiagnostics(diagnostics) || chunkScan.jsonBytes === null) {
        return { ok: false, container: null, diagnostics };
    }
    const jsonChunk = chunkScan.chunks[0];
    if (jsonChunk === undefined) {
        diagnostics.push(createErrorDiagnostic({
            code: "glb.missingJsonChunk",
            message: "GLB JSON chunk is missing.",
            byteOffset: GLB_HEADER_BYTE_LENGTH,
        }));
        return { ok: false, container: null, diagnostics };
    }
    const jsonText = decodeGlbJson(chunkScan.jsonBytes);
    if (jsonText === null) {
        diagnostics.push(createErrorDiagnostic({
            code: "glb.invalidJson",
            message: "GLB JSON chunk must be valid UTF-8.",
            byteOffset: jsonChunk.byteOffset,
            byteLength: jsonChunk.byteLength,
            chunkType: GLB_JSON_CHUNK_TYPE,
        }));
        return { ok: false, container: null, diagnostics };
    }
    const json = parseJsonObject(jsonText);
    if (json === null) {
        diagnostics.push(createErrorDiagnostic({
            code: "glb.invalidJson",
            message: "GLB JSON chunk must parse to a JSON object.",
            byteOffset: jsonChunk.byteOffset,
            byteLength: jsonChunk.byteLength,
            chunkType: GLB_JSON_CHUNK_TYPE,
        }));
        return { ok: false, container: null, diagnostics };
    }
    return {
        ok: !hasErrorDiagnostics(diagnostics),
        container: {
            version: GLB_CONTAINER_VERSION,
            byteLength: declaredLength,
            json,
            jsonText,
            binaryChunk: chunkScan.binaryChunk,
            chunks: chunkScan.chunks,
        },
        diagnostics,
    };
}
//# sourceMappingURL=glb-container.js.map