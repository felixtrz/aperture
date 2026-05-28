import type { EcsWorld } from "@aperture-engine/simulation";
import type { ApertureEntityLookup } from "./entity-lookup-types.js";
import { createApertureEntityHierarchy } from "./entity-lookup-hierarchy.js";
import { setApertureEntityComponentField } from "./entity-lookup-mutation.js";
import {
  findApertureEntities,
  getApertureEntitySummary,
} from "./entity-lookup-query.js";
import {
  createApertureEntityLookupSnapshot,
  diffApertureEntityLookupSnapshots,
} from "./entity-lookup-snapshot.js";

export type {
  ApertureEntityFindQuery,
  ApertureEntityFindReport,
  ApertureEntityGetReport,
  ApertureEntityHierarchyNode,
  ApertureEntityHierarchyReport,
  ApertureEntityLookup,
  ApertureEntityLookupDiagnostic,
  ApertureEntityLookupSnapshot,
  ApertureEntityLookupSnapshotOptions,
  ApertureEntityLookupSourceFilter,
  ApertureEntitySetComponentFieldReport,
  ApertureEntitySetComponentFieldRequest,
  ApertureEntitySnapshotChange,
  ApertureEntitySnapshotDiff,
  ApertureEntitySnapshotDiffCounts,
  ApertureEntitySourceSummary,
  ApertureEntitySummary,
  ApertureLocalTransformSummary,
  ApertureWorldTransformSummary,
} from "./entity-lookup-types.js";
export { createApertureEntityHierarchy } from "./entity-lookup-hierarchy.js";
export { setApertureEntityComponentField } from "./entity-lookup-mutation.js";
export {
  findApertureEntities,
  getApertureEntitySummary,
} from "./entity-lookup-query.js";
export {
  createApertureEntityLookupSnapshot,
  diffApertureEntityLookupSnapshots,
} from "./entity-lookup-snapshot.js";

export function createApertureEntityLookup(
  world: EcsWorld,
): ApertureEntityLookup {
  return {
    find(query = {}) {
      return findApertureEntities(world, query);
    },
    get(entity) {
      return getApertureEntitySummary(world, entity);
    },
    snapshot(options = {}) {
      return createApertureEntityLookupSnapshot(world, options);
    },
    diff(previous, next) {
      return diffApertureEntityLookupSnapshots(previous, next);
    },
    setComponentField(request) {
      return setApertureEntityComponentField(world, request);
    },
    hierarchy() {
      return createApertureEntityHierarchy(world);
    },
  };
}
