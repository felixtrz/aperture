import { type PhysicsBackend, type PhysicsExecutionMode } from "../backend.js";
import { type PhysicsVec3 } from "../components.js";
export interface TestPhysicsBackendOptions {
    readonly gravity?: PhysicsVec3;
    readonly execution?: PhysicsExecutionMode;
}
export declare function createTestPhysicsBackend(options?: TestPhysicsBackendOptions): PhysicsBackend;
//# sourceMappingURL=backend.d.ts.map