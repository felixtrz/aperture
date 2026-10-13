import type { FogPacket, ViewPacket } from "./snapshot.js";
export declare function hasMatrixRange(values: Float32Array, sourceOffset: number): boolean;
export declare function writePreviousViewProjection(target: Float32Array, targetOffset: number, viewMatrices: Float32Array, view: ViewPacket, previousViewProjectionByViewId: ReadonlyMap<number, Float32Array> | undefined): void;
export declare function writeCameraPosition(target: Float32Array, targetOffset: number, viewMatrices: Float32Array, viewMatrixOffset: number): void;
export declare function writeFogParameters(target: Float32Array, colorOffset: number, paramsOffset: number, fogs: readonly FogPacket[], view: ViewPacket): void;
//# sourceMappingURL=view-pack-writers.d.ts.map