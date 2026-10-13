import type { BatchCompatibilityKey } from "@aperture-engine/render";
import { INSTANCE_TINT_VERTEX_BUFFER_LAYOUT } from "../../resources/attributes/instance-tint-buffer.js";
import type { BuiltInShaderSourceModule } from "../unlit/unlit-shader.js";
interface StandardVertexBufferAttributeLayout {
    readonly shaderLocation: number;
    readonly offset: number;
    readonly format: string;
}
export interface StandardPrimitiveVertexBufferLayout {
    readonly arrayStride: number;
    readonly stepMode: "vertex";
    readonly attributes: readonly StandardVertexBufferAttributeLayout[];
}
export type WebGpuSkinningJointAttributeFormat = "uint8x4" | "uint16x4";
export type WebGpuSkinningWeightAttributeFormat = "float32x4" | "unorm8x4" | "unorm16x4";
export interface WebGpuSkinningAttributeFormats {
    readonly joints: WebGpuSkinningJointAttributeFormat;
    readonly weights: WebGpuSkinningWeightAttributeFormat;
}
export declare const STANDARD_TANGENT_PRIMITIVE_VERTEX_BUFFER_LAYOUT: {
    readonly arrayStride: 48;
    readonly stepMode: "vertex";
    readonly attributes: readonly [{
        readonly shaderLocation: 0;
        readonly offset: 0;
        readonly format: "float32x3";
    }, {
        readonly shaderLocation: 1;
        readonly offset: 12;
        readonly format: "float32x3";
    }, {
        readonly shaderLocation: 2;
        readonly offset: 24;
        readonly format: "float32x2";
    }, {
        readonly shaderLocation: 3;
        readonly offset: 32;
        readonly format: "float32x4";
    }];
};
export declare const STANDARD_TEXCOORD1_PRIMITIVE_VERTEX_BUFFER_LAYOUT: {
    readonly arrayStride: 40;
    readonly stepMode: "vertex";
    readonly attributes: readonly [{
        readonly shaderLocation: 0;
        readonly offset: 0;
        readonly format: "float32x3";
    }, {
        readonly shaderLocation: 1;
        readonly offset: 12;
        readonly format: "float32x3";
    }, {
        readonly shaderLocation: 2;
        readonly offset: 24;
        readonly format: "float32x2";
    }, {
        readonly shaderLocation: 4;
        readonly offset: 32;
        readonly format: "float32x2";
    }];
};
export declare const STANDARD_VERTEX_COLOR_PRIMITIVE_VERTEX_BUFFER_LAYOUT: {
    readonly arrayStride: 48;
    readonly stepMode: "vertex";
    readonly attributes: readonly [{
        readonly shaderLocation: 0;
        readonly offset: 0;
        readonly format: "float32x3";
    }, {
        readonly shaderLocation: 1;
        readonly offset: 12;
        readonly format: "float32x3";
    }, {
        readonly shaderLocation: 2;
        readonly offset: 24;
        readonly format: "float32x2";
    }, {
        readonly shaderLocation: 5;
        readonly offset: 32;
        readonly format: "float32x4";
    }];
};
export declare const STANDARD_VERTEX_COLOR_FLOAT32X3_PRIMITIVE_VERTEX_BUFFER_LAYOUT: {
    readonly arrayStride: 44;
    readonly stepMode: "vertex";
    readonly attributes: readonly [{
        readonly shaderLocation: 0;
        readonly offset: 0;
        readonly format: "float32x3";
    }, {
        readonly shaderLocation: 1;
        readonly offset: 12;
        readonly format: "float32x3";
    }, {
        readonly shaderLocation: 2;
        readonly offset: 24;
        readonly format: "float32x2";
    }, {
        readonly shaderLocation: 5;
        readonly offset: 32;
        readonly format: "float32x3";
    }];
};
export declare const STANDARD_VERTEX_COLOR_UNORM8_PRIMITIVE_VERTEX_BUFFER_LAYOUT: {
    readonly arrayStride: 36;
    readonly stepMode: "vertex";
    readonly attributes: readonly [{
        readonly shaderLocation: 0;
        readonly offset: 0;
        readonly format: "float32x3";
    }, {
        readonly shaderLocation: 1;
        readonly offset: 12;
        readonly format: "float32x3";
    }, {
        readonly shaderLocation: 2;
        readonly offset: 24;
        readonly format: "float32x2";
    }, {
        readonly shaderLocation: 5;
        readonly offset: 32;
        readonly format: "unorm8x4";
    }];
};
export declare const STANDARD_VERTEX_COLOR_UNORM16_PRIMITIVE_VERTEX_BUFFER_LAYOUT: {
    readonly arrayStride: 40;
    readonly stepMode: "vertex";
    readonly attributes: readonly [{
        readonly shaderLocation: 0;
        readonly offset: 0;
        readonly format: "float32x3";
    }, {
        readonly shaderLocation: 1;
        readonly offset: 12;
        readonly format: "float32x3";
    }, {
        readonly shaderLocation: 2;
        readonly offset: 24;
        readonly format: "float32x2";
    }, {
        readonly shaderLocation: 5;
        readonly offset: 32;
        readonly format: "unorm16x4";
    }];
};
export declare const STANDARD_SKINNED_PRIMITIVE_VERTEX_BUFFER_LAYOUT: {
    readonly arrayStride: 56;
    readonly stepMode: "vertex";
    readonly attributes: readonly [{
        readonly shaderLocation: 0;
        readonly offset: 0;
        readonly format: "float32x3";
    }, {
        readonly shaderLocation: 1;
        readonly offset: 12;
        readonly format: "float32x3";
    }, {
        readonly shaderLocation: 2;
        readonly offset: 24;
        readonly format: "float32x2";
    }, {
        readonly shaderLocation: 8;
        readonly offset: 32;
        readonly format: "uint16x4";
    }, {
        readonly shaderLocation: 9;
        readonly offset: 40;
        readonly format: "float32x4";
    }];
};
export declare const STANDARD_TANGENT_TEXCOORD1_PRIMITIVE_VERTEX_BUFFER_LAYOUT: {
    readonly arrayStride: 56;
    readonly stepMode: "vertex";
    readonly attributes: readonly [{
        readonly shaderLocation: 0;
        readonly offset: 0;
        readonly format: "float32x3";
    }, {
        readonly shaderLocation: 1;
        readonly offset: 12;
        readonly format: "float32x3";
    }, {
        readonly shaderLocation: 2;
        readonly offset: 24;
        readonly format: "float32x2";
    }, {
        readonly shaderLocation: 3;
        readonly offset: 32;
        readonly format: "float32x4";
    }, {
        readonly shaderLocation: 4;
        readonly offset: 48;
        readonly format: "float32x2";
    }];
};
export declare function vertexSkinningAttributeFormatsFromBatchKey(batchKey?: Partial<BatchCompatibilityKey>): WebGpuSkinningAttributeFormats;
export declare function standardVertexBufferLayouts(shader: BuiltInShaderSourceModule, batchKey?: BatchCompatibilityKey): readonly (StandardPrimitiveVertexBufferLayout | typeof INSTANCE_TINT_VERTEX_BUFFER_LAYOUT)[];
export {};
//# sourceMappingURL=standard-vertex-layout.d.ts.map