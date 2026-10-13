import { type MaterialPipelineKeyInput } from "../materials/index.js";
import type { MeshTopology } from "../mesh/index.js";
import type { BatchCompatibilityKey } from "./snapshot-types.js";
export declare function createBatchCompatibilityKey(input: {
    readonly materialPipeline: MaterialPipelineKeyInput;
    readonly materialKey: string;
    readonly meshLayoutKey: string;
    readonly topology: MeshTopology;
    readonly instanced?: boolean;
    readonly skinned?: boolean;
    readonly morphed?: boolean;
}): BatchCompatibilityKey;
//# sourceMappingURL=snapshot-batch-key.d.ts.map