import type { EcsWorld, Entity } from "@aperture-engine/simulation";
import type { SystemDiagnostics } from "../diagnostics.js";
import type { PhysicsSpawnDescriptor } from "./types.js";
export interface ApplyPhysicsSpawnDescriptorOptions {
    readonly world: EcsWorld;
    readonly entity: Entity;
    readonly input: PhysicsSpawnDescriptor | undefined;
    readonly diagnostics?: SystemDiagnostics;
}
export declare function applyPhysicsSpawnDescriptor(options: ApplyPhysicsSpawnDescriptorOptions): void;
//# sourceMappingURL=physics.d.ts.map