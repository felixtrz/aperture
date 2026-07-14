import { APERTURE_LIT_PIPELINE_FEATURE } from "@aperture-engine/render";

export type WebGpuMaterialPipelineFamily =
  | "unlit"
  | "matcap"
  | "standard"
  | "debug-normal";

const UNLIT_REQUIRED_BIND_GROUPS = [0, 1, 2] as const;
const MATCAP_REQUIRED_BIND_GROUPS = [0, 1, 2] as const;
const STANDARD_REQUIRED_BIND_GROUPS = [0, 1, 2, 3] as const;
const DEBUG_NORMAL_REQUIRED_BIND_GROUPS = [0, 1, 2] as const;
// Lit custom WGSL pipelines (A1) additionally bind the group(3) lit contract.
// Skinned custom WGSL pipelines (F3) add NO extra group — the joint palette is
// an extra BINDING inside the existing group(1) transforms group (@binding 1),
// so a skinned pipeline keeps the same required bind groups as its unlit/lit
// base.
const CUSTOM_LIT_REQUIRED_BIND_GROUPS = [0, 1, 2, 3] as const;

export function materialPipelineFamilyFromKey(
  pipelineKey: string,
): WebGpuMaterialPipelineFamily | null {
  const family = pipelineKey.split("|")[0];

  switch (family) {
    case "unlit":
      return "unlit";
    case "matcap":
      return "matcap";
    case "standard":
      return "standard";
    case "debug-normal":
      return "debug-normal";
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
    case "debug-normal":
      return DEBUG_NORMAL_REQUIRED_BIND_GROUPS;
    case "matcap":
      return MATCAP_REQUIRED_BIND_GROUPS;
    case "unlit":
      return UNLIT_REQUIRED_BIND_GROUPS;
    case null:
      // Custom WGSL pipelines: the lit-contract segment (present only when
      // `lighting: "lit"`) adds the group(3) lit bind group; every other custom
      // pipeline keeps today's [0, 1, 2]. Skinning (F3) adds no group — its
      // joint palette is @group(1) @binding(1), inside the transforms group.
      return pipelineKey.split("|").includes(APERTURE_LIT_PIPELINE_FEATURE)
        ? CUSTOM_LIT_REQUIRED_BIND_GROUPS
        : UNLIT_REQUIRED_BIND_GROUPS;
  }
}
