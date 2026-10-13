import { type ComponentInitialData } from "@aperture-engine/simulation";
import type { InstanceDataInput, InstanceTintInput, MaterialSlotsInput, MorphTargetWeightsInput, SkinInput } from "./authoring-types.js";
import type { InstanceData, InstanceTint, MaterialSlots, MorphTargetWeights, Skin } from "./authoring-components.js";
export declare function createMaterialSlots(input: MaterialSlotsInput): ComponentInitialData<typeof MaterialSlots>;
export declare function createInstanceTint(input?: InstanceTintInput): ComponentInitialData<typeof InstanceTint>;
export declare function createInstanceData(input: InstanceDataInput): ComponentInitialData<typeof InstanceData>;
export declare function createSkin(input: SkinInput): ComponentInitialData<typeof Skin>;
export declare function createMorphTargetWeights(input: MorphTargetWeightsInput): ComponentInitialData<typeof MorphTargetWeights>;
//# sourceMappingURL=authoring-create-mesh-data.d.ts.map