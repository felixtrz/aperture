import type { EcsWorld } from "@aperture-engine/simulation";
import type { EcsEntityRef } from "../../config.js";
import type { ApertureEntityFindQuery, ApertureEntityFindReport, ApertureEntityGetReport } from "./types.js";
export declare function findApertureEntities(world: EcsWorld, query?: ApertureEntityFindQuery): ApertureEntityFindReport;
export declare function getApertureEntitySummary(world: EcsWorld, ref: EcsEntityRef): ApertureEntityGetReport;
//# sourceMappingURL=query.d.ts.map