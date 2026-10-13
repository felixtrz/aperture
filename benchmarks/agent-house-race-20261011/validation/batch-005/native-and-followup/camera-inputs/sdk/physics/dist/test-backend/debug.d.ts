import { type PhysicsDebugLine, type PhysicsDebugOptions } from "../backend.js";
import type { TestBody, TestJoint } from "./types.js";
export declare function broadphaseAabbDebugLines(bodies: readonly TestBody[], options: PhysicsDebugOptions): PhysicsDebugLine[];
export declare function contactNormalDebugLines(bodies: readonly TestBody[], options: PhysicsDebugOptions): PhysicsDebugLine[];
export declare function bodyStateDebugLines(bodies: readonly TestBody[], options: PhysicsDebugOptions): PhysicsDebugLine[];
export declare function jointFrameDebugLines(joints: readonly TestJoint[], bodies: ReadonlyMap<string, TestBody>, options: PhysicsDebugOptions): PhysicsDebugLine[];
//# sourceMappingURL=debug.d.ts.map