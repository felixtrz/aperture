export declare const INSTANCE_TRANSFORM_FLOATS = 16;
export declare const INSTANCE_TRANSFORM_BYTES: number;
export interface InstanceTransformVertexBufferLayoutOptions {
    readonly shaderLocationStart?: number;
}
export declare function createInstanceTransformData(matrices: readonly ArrayLike<number>[]): Float32Array;
export declare function createInstanceTransformVertexBufferLayout(options?: InstanceTransformVertexBufferLayoutOptions): GPUVertexBufferLayout;
//# sourceMappingURL=instance-buffer.d.ts.map