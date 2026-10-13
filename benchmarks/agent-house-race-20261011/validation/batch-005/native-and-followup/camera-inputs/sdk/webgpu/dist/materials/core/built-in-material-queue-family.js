export const BUILT_IN_MATERIAL_QUEUE_FAMILIES = [
    "unlit",
    "matcap",
    "standard",
    "debug-normal",
];
const BUILT_IN_MATERIAL_QUEUE_FAMILY_SET = new Set(BUILT_IN_MATERIAL_QUEUE_FAMILIES);
export function isBuiltInMaterialQueueFamily(family) {
    return BUILT_IN_MATERIAL_QUEUE_FAMILY_SET.has(family);
}
//# sourceMappingURL=built-in-material-queue-family.js.map