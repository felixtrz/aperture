export type AnimationBlendPath = "translation" | "rotation" | "scale";
export interface WeightedAnimationClipSample {
    readonly clipId: string;
    readonly targetId: string;
    readonly path: AnimationBlendPath;
    readonly weight: number;
    readonly value: readonly number[];
}
export interface AnimationBlendContributor {
    readonly clipId: string;
    readonly weight: number;
    readonly normalizedWeight: number;
}
export interface BlendedAnimationChannel {
    readonly targetId: string;
    readonly path: AnimationBlendPath;
    readonly value: readonly number[];
    readonly weight: number;
    readonly contributors: readonly AnimationBlendContributor[];
}
export interface AnimationClipWeight {
    readonly clipId: string;
    readonly weight: number;
}
export interface AnimationCrossFade {
    readonly fromClipId: string;
    readonly toClipId: string;
    readonly durationSeconds: number;
}
export declare function clampAnimationClipWeight(weight: number): number;
export declare function blendAnimationClipSamples(samples: readonly WeightedAnimationClipSample[]): BlendedAnimationChannel[];
export declare function crossFadeTo(fromClipId: string, toClipId: string, durationSeconds: number): AnimationCrossFade;
export declare function sampleAnimationCrossFade(crossFade: AnimationCrossFade, elapsedSeconds: number): AnimationClipWeight[];
//# sourceMappingURL=animation-blending.d.ts.map