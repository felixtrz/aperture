import type { ApertureWorkerFeature } from "./features.js";
import { type AperturePhysicsConfig, type AperturePhysicsFacade } from "./physics-facade.js";
import type { PhysicsAccess } from "./systems/physics.js";
export interface AperturePhysicsFeature extends ApertureWorkerFeature {
    readonly id: "physics";
    getFacade(): AperturePhysicsFacade | null;
}
export interface CreateAperturePhysicsFeatureOptions {
    readonly config: AperturePhysicsConfig;
    readonly physics: PhysicsAccess;
}
export declare function createAperturePhysicsFeature(options: CreateAperturePhysicsFeatureOptions): AperturePhysicsFeature;
//# sourceMappingURL=physics-feature.d.ts.map