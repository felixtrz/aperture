import { type PhysicsBackend, type PhysicsColliderGeometryProvider, type PhysicsExecutionMode, type PhysicsVec3 } from "@aperture-engine/physics";
export interface RapierPhysicsBackendOptions {
    readonly gravity?: PhysicsVec3;
    readonly execution?: PhysicsExecutionMode;
    readonly colliderGeometryProvider?: PhysicsColliderGeometryProvider;
}
export declare function createRapierPhysicsBackend(options?: RapierPhysicsBackendOptions): PhysicsBackend;
//# sourceMappingURL=backend.d.ts.map