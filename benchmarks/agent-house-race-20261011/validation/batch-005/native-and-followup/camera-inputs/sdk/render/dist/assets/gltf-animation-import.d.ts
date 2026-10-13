import type { AnimationClip } from "@aperture-engine/simulation";
import { type GltfBufferResolver } from "./gltf-accessor-float-reader.js";
import type { GltfAnimationImportReport } from "./gltf-animation-import-report.js";
export interface GltfImportedAnimationClip {
    readonly animationIndex: number;
    readonly clip: AnimationClip;
}
export interface GltfAnimationImportResult {
    readonly clips: readonly GltfImportedAnimationClip[];
    readonly report: GltfAnimationImportReport;
}
export declare function importGltfAnimations(input: {
    readonly root: unknown;
    readonly resolveBufferBytes: GltfBufferResolver;
    readonly keyPrefix?: string;
}): GltfAnimationImportResult;
//# sourceMappingURL=gltf-animation-import.d.ts.map