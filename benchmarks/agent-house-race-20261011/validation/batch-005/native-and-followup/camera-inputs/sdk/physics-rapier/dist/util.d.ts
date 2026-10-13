import type RAPIER from "@dimforge/rapier3d-compat";
export declare function requireWorld(world: RAPIER.World | null, initialized: boolean): RAPIER.World;
export declare function requireEventQueue(eventQueue: RAPIER.EventQueue | null, initialized: boolean): RAPIER.EventQueue;
export declare function freeRapierObject(value: unknown): void;
export declare function performanceNow(): number;
export declare function finitePositive(value: number | undefined, fallback: number): number;
export declare function finiteNonNegative(value: number | undefined): number;
//# sourceMappingURL=util.d.ts.map