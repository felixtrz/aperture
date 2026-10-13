import { createApertureEntityHierarchy } from "./hierarchy.js";
import { setApertureEntityComponentField } from "./mutation.js";
import { findApertureEntities, getApertureEntitySummary } from "./query.js";
import { createApertureEntityLookupSnapshot, diffApertureEntityLookupSnapshots, } from "./snapshot.js";
export { createApertureEntityHierarchy } from "./hierarchy.js";
export { listMutableComponentFields, setApertureEntityComponentField, } from "./mutation.js";
export { findApertureEntities, getApertureEntitySummary } from "./query.js";
export { createApertureEntityLookupSnapshot, diffApertureEntityLookupSnapshots, } from "./snapshot.js";
export function createApertureEntityLookup(world) {
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
//# sourceMappingURL=index.js.map