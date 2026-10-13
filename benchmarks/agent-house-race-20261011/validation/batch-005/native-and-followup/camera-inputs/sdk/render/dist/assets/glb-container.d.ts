import { type GlbContainerParseResult, type GlbContainerSource } from "./glb-container-types.js";
export { GLB_BINARY_CHUNK_TYPE, GLB_CHUNK_HEADER_BYTE_LENGTH, GLB_CONTAINER_MAGIC, GLB_CONTAINER_VERSION, GLB_HEADER_BYTE_LENGTH, GLB_JSON_CHUNK_TYPE, } from "./glb-container-types.js";
export type { GlbChunkInfo, GlbChunkKind, GlbContainer, GlbContainerDiagnostic, GlbContainerDiagnosticCode, GlbContainerDiagnosticSeverity, GlbContainerParseResult, GlbContainerSource, } from "./glb-container-types.js";
export declare function parseGlbContainer(source: GlbContainerSource): GlbContainerParseResult;
//# sourceMappingURL=glb-container.d.ts.map