import type { RenderSnapshot } from "./snapshot.js";
import type { PackedSnapshotViewUniforms, SnapshotViewUniformPackOptions } from "./view-pack-types.js";
export { createPackedSnapshotViewUniformsScratch } from "./view-pack-scratch.js";
export { writePackedSnapshotViewUniforms } from "./view-pack-write.js";
export { PACKED_VIEW_UNIFORM_FLOAT_STRIDE, VIEW_CAMERA_POSITION_FLOAT_OFFSET, VIEW_FOG_COLOR_FLOAT_OFFSET, VIEW_FOG_PARAMS_FLOAT_OFFSET, VIEW_PREVIOUS_VIEW_PROJECTION_FLOAT_OFFSET, VIEW_PROJECTION_FLOAT_COUNT, } from "./view-pack-types.js";
export type { PackedSnapshotViewUniformRecord, PackedSnapshotViewUniforms, PackedSnapshotViewUniformsScratch, SnapshotViewUniformPackDiagnostic, SnapshotViewUniformPackDiagnosticCode, SnapshotViewUniformPackOptions, } from "./view-pack-types.js";
export declare function packSnapshotViewUniforms(snapshot: RenderSnapshot, options?: SnapshotViewUniformPackOptions): PackedSnapshotViewUniforms;
//# sourceMappingURL=view-pack.d.ts.map