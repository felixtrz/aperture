import type { ParticleEffectHandle, Vec3Like } from "@aperture-engine/simulation";
export declare const ParticleSimulationSpace: {
    readonly World: "world";
    readonly Local: "local";
};
export type ParticleSimulationSpace = (typeof ParticleSimulationSpace)[keyof typeof ParticleSimulationSpace];
export declare const ParticleBlendMode: {
    readonly Opaque: "opaque";
    readonly Alpha: "alpha";
    readonly Additive: "additive";
    readonly Multiply: "multiply";
};
export type ParticleBlendMode = (typeof ParticleBlendMode)[keyof typeof ParticleBlendMode];
export interface ParticleEmitterInput {
    readonly effect: ParticleEffectHandle;
    readonly capacity?: number;
    readonly seed?: number;
    readonly resetEpoch?: number;
    readonly timeScale?: number;
    readonly simulationSpace?: ParticleSimulationSpace;
    readonly boundsCenter?: Vec3Like;
    readonly boundsRadius?: number;
    readonly visible?: boolean;
}
//# sourceMappingURL=authoring.d.ts.map