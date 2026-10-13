export declare function writeFloat32(words: Uint32Array, offset: number, value: number): void;
export declare function readFloat32(words: Uint32Array, offset: number): number;
export declare function writeEntity(words: Uint32Array, offset: number, entity: {
    readonly index: number;
    readonly generation: number;
}): void;
export declare function readEntity(words: Uint32Array, offset: number): {
    readonly index: number;
    readonly generation: number;
};
export declare function writeVec3(words: Uint32Array, offset: number, value: ArrayLike<number>): void;
export declare function readVec3(words: Uint32Array, offset: number): readonly [number, number, number];
export declare function writeVec4(words: Uint32Array, offset: number, value: ArrayLike<number>): void;
export declare function readVec4(words: Uint32Array, offset: number): readonly [number, number, number, number];
export declare function writeFloat64(words: Uint32Array, offset: number, value: number): void;
export declare function readFloat64(words: Uint32Array, offset: number): number;
export declare function writeSigned32(words: Uint32Array, offset: number, value: number): void;
export declare function readSigned32(words: Uint32Array, offset: number): number;
export declare function writeOptionalUint32(words: Uint32Array, offset: number, value: number | undefined): void;
export declare function readOptionalUint32(words: Uint32Array, offset: number): number | undefined;
export declare function boolState(value: boolean | undefined): number;
export declare function readBoolState(value: number): boolean | undefined;
//# sourceMappingURL=snapshot-packed-binary-utils.d.ts.map