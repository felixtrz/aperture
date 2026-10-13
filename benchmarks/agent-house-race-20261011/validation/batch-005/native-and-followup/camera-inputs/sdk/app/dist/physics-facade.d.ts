import { type PhysicsBackend, type PhysicsColliderGeometryProvider, type PhysicsExecutionMode, type PhysicsHeightfieldGeometry, type PhysicsVec3 } from "@aperture-engine/physics";
import type { AssetRegistry, EcsWorld } from "@aperture-engine/simulation";
import type { SimulationFixedStepCallback, SimulationFixedStepTaskOptions } from "@aperture-engine/runtime";
import type { PhysicsAccess } from "./systems/physics.js";
export type AperturePhysicsBackendConfig = "rapier" | PhysicsBackend | (() => PhysicsBackend | Promise<PhysicsBackend>);
export type AperturePhysicsColliderGeometryConfig = {
    readonly kind: "none";
} | {
    readonly kind: "provider";
    readonly provider: PhysicsColliderGeometryProvider;
} | {
    readonly kind: "assets";
    readonly heightfields?: ReadonlyMap<string, PhysicsHeightfieldGeometry> | Readonly<Record<string, PhysicsHeightfieldGeometry>>;
};
export interface AperturePhysicsConfig {
    readonly backend?: AperturePhysicsBackendConfig;
    readonly gravity?: PhysicsVec3;
    readonly execution?: PhysicsExecutionMode;
    readonly colliderGeometry?: AperturePhysicsColliderGeometryConfig;
}
export interface AperturePhysicsFacade {
    readonly backend: PhysicsBackend;
    unregister(): void;
    dispose(): void;
}
export interface InstallApertureAppPhysicsOptions {
    readonly world: EcsWorld;
    readonly assets: AssetRegistry;
    readonly physics: PhysicsAccess;
    readonly config: AperturePhysicsConfig;
    readonly registerFixedStepTask: (task: SimulationFixedStepCallback, options?: SimulationFixedStepTaskOptions) => () => void;
}
export declare function installApertureAppPhysics(options: InstallApertureAppPhysicsOptions): Promise<AperturePhysicsFacade>;
//# sourceMappingURL=physics-facade.d.ts.map