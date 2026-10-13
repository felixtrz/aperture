import type { ComponentInitialData } from "@aperture-engine/simulation";
import { type MeshQueryAccelerationInput, type OcclusionQueryInput, type PickableInput } from "./authoring-types.js";
import type { MeshQueryAcceleration, OcclusionQuery, Pickable } from "./authoring-components.js";
export declare function createPickable(input?: PickableInput): ComponentInitialData<typeof Pickable>;
export declare function createMeshQueryAcceleration(input?: MeshQueryAccelerationInput): ComponentInitialData<typeof MeshQueryAcceleration>;
export declare function createOcclusionQuery(input?: OcclusionQueryInput): ComponentInitialData<typeof OcclusionQuery>;
//# sourceMappingURL=authoring-create-interaction.d.ts.map