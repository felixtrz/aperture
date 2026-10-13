import type RAPIER from "@dimforge/rapier3d-compat";
import type { PhysicsEvent } from "@aperture-engine/physics";
import type { RapierBodyEntry, RapierEventPair } from "./types.js";
export declare function collectRapierEvents(options: {
    readonly world: RAPIER.World;
    readonly eventQueue: RAPIER.EventQueue;
    readonly bodies: ReadonlyMap<string, RapierBodyEntry>;
    readonly activePairs: Map<string, RapierEventPair>;
    readonly fixedStep: number;
    readonly fixedDelta: number;
}): PhysicsEvent[];
//# sourceMappingURL=events.d.ts.map