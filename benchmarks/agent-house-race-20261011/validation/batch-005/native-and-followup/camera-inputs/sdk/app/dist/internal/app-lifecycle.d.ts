import type { EcsWorld } from "@aperture-engine/simulation";
type SystemOwner = {
    destroy(): unknown;
};
interface AppOwner {
    readonly lowLevel: {
        readonly world: EcsWorld;
    };
    dispose(): unknown;
}
export declare function beginApertureSystemBootstrap(world: EcsWorld): void;
export declare function finishApertureSystemBootstrap(world: EcsWorld): void;
export declare function trackApertureSystemOwner(world: EcsWorld, system: SystemOwner): void;
/** Release complete or partially bootstrapped owners without masking a caller's error. */
export declare function disposeApertureAppOwners(world: EcsWorld, disposeFeatures: () => unknown): Promise<readonly unknown[]>;
/** Idempotent full app cleanup, including systems and runtime features. */
export declare function disposeApertureApp(app: AppOwner): Promise<readonly unknown[]>;
export {};
//# sourceMappingURL=app-lifecycle.d.ts.map