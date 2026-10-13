import type { EcsWorld, Entity } from "@aperture-engine/simulation";
import type { EcsEntityRef } from "../../config.js";
import type { ApertureEntitySummary } from "./types.js";
export { jsonSafeValue } from "../../internal/json-safe.js";
export declare function entitySummary(entity: Entity): ApertureEntitySummary;
export declare function collectActiveEntities(world: EcsWorld): Entity[];
export declare function compareEntitySummaries(a: ApertureEntitySummary, b: ApertureEntitySummary): number;
export declare function entityRefKey(ref: EcsEntityRef): string;
export declare function validEntityRef(ref: EcsEntityRef): boolean;
//# sourceMappingURL=summary.d.ts.map