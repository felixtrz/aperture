import type { EcsWorld, Entity } from "@aperture-engine/simulation";
import type { EcsEntityRef } from "../../config.js";
import type { ApertureEntityLookupDiagnostic } from "./types.js";
export type ResolveActiveEntityResult = {
    readonly ok: true;
    readonly entity: Entity;
} | {
    readonly ok: false;
    readonly diagnostic: ApertureEntityLookupDiagnostic;
};
export declare function resolveActiveEntity(world: EcsWorld, ref: EcsEntityRef): ResolveActiveEntityResult;
//# sourceMappingURL=resolve.d.ts.map