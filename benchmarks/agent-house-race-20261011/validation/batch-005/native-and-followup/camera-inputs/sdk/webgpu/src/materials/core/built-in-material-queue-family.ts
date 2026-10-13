export const BUILT_IN_MATERIAL_QUEUE_FAMILIES = [
  "unlit",
  "matcap",
  "standard",
  "debug-normal",
] as const;

export type BuiltInMaterialQueueFamily =
  (typeof BUILT_IN_MATERIAL_QUEUE_FAMILIES)[number];

const BUILT_IN_MATERIAL_QUEUE_FAMILY_SET = new Set<string>(
  BUILT_IN_MATERIAL_QUEUE_FAMILIES,
);

export function isBuiltInMaterialQueueFamily(
  family: string,
): family is BuiltInMaterialQueueFamily {
  return BUILT_IN_MATERIAL_QUEUE_FAMILY_SET.has(family);
}
