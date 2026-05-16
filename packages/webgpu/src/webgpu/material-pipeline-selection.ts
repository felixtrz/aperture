export type WebGpuMaterialPipelineFamily = "unlit" | "standard";

const UNLIT_REQUIRED_BIND_GROUPS = [0, 1, 2] as const;
const STANDARD_REQUIRED_BIND_GROUPS = [0, 1, 2, 3] as const;

export function materialPipelineFamilyFromKey(
  pipelineKey: string,
): WebGpuMaterialPipelineFamily | null {
  const family = pipelineKey.split("|")[0];

  switch (family) {
    case "unlit":
      return "unlit";
    case "standard":
      return "standard";
    default:
      return null;
  }
}

export function requiredBindGroupGroupsForPipelineKey(
  pipelineKey: string,
): readonly number[] {
  switch (materialPipelineFamilyFromKey(pipelineKey)) {
    case "standard":
      return STANDARD_REQUIRED_BIND_GROUPS;
    case "unlit":
    case null:
      return UNLIT_REQUIRED_BIND_GROUPS;
  }
}
