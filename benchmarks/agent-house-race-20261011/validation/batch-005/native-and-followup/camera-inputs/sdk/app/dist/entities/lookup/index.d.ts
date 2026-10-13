import type { EcsWorld } from "@aperture-engine/simulation";
import type { ApertureEntityLookup } from "./types.js";
export type { ApertureEntityFindQuery, ApertureEntityFindReport, ApertureEntityGetReport, ApertureEntityHierarchyNode, ApertureEntityHierarchyReport, ApertureEntityLookup, ApertureEntityLookupDiagnostic, ApertureEntityLookupSnapshot, ApertureEntityLookupSnapshotOptions, ApertureEntityLookupSourceFilter, ApertureEntitySetComponentFieldReport, ApertureEntitySetComponentFieldRequest, ApertureEntitySnapshotChange, ApertureEntitySnapshotDiff, ApertureEntitySnapshotDiffCounts, ApertureEntitySourceSummary, ApertureEntitySummary, ApertureLocalTransformSummary, ApertureRenderLayerSummary, ApertureWorldTransformSummary, } from "./types.js";
export { createApertureEntityHierarchy } from "./hierarchy.js";
export { listMutableComponentFields, setApertureEntityComponentField, } from "./mutation.js";
export { findApertureEntities, getApertureEntitySummary } from "./query.js";
export { createApertureEntityLookupSnapshot, diffApertureEntityLookupSnapshots, } from "./snapshot.js";
export declare function createApertureEntityLookup(world: EcsWorld): ApertureEntityLookup;
//# sourceMappingURL=index.d.ts.map