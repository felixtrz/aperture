export interface NumberArray {
    readonly length: number;
    [index: number]: number;
}
export type StorageArg = Float32Array | Float64Array | NumberArray;
export type StorageType<T extends StorageArg> = T;
export type Float32 = StorageType<Float32Array>;
//# sourceMappingURL=storage.d.ts.map