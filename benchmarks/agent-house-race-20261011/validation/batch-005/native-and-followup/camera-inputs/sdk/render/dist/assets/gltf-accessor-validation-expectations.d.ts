import type { GltfAccessorExpectation, GltfAccessorSemantic } from "./gltf-accessor-validation-types.js";
export declare function expectationForSemantic(semantic: GltfAccessorSemantic, accessor: Record<string, unknown>): GltfAccessorExpectation | null;
export declare function hasUnsupportedQuantizedComponentType(semantic: GltfAccessorSemantic, accessor: Record<string, unknown>): boolean;
//# sourceMappingURL=gltf-accessor-validation-expectations.d.ts.map