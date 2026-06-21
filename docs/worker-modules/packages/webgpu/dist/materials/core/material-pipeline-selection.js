const UNLIT_REQUIRED_BIND_GROUPS = [0, 1, 2];
const MATCAP_REQUIRED_BIND_GROUPS = [0, 1, 2];
const STANDARD_REQUIRED_BIND_GROUPS = [0, 1, 2, 3];
const DEBUG_NORMAL_REQUIRED_BIND_GROUPS = [0, 1, 2];
export function materialPipelineFamilyFromKey(pipelineKey) {
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
export function requiredBindGroupGroupsForPipelineKey(pipelineKey) {
    switch (materialPipelineFamilyFromKey(pipelineKey)) {
        case "standard":
            return STANDARD_REQUIRED_BIND_GROUPS;
        case "debug-normal":
            return DEBUG_NORMAL_REQUIRED_BIND_GROUPS;
        case "matcap":
            return MATCAP_REQUIRED_BIND_GROUPS;
        case "unlit":
        case null:
            return UNLIT_REQUIRED_BIND_GROUPS;
    }
}
//# sourceMappingURL=material-pipeline-selection.js.map