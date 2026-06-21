import { registerRenderAuthoringComponents } from "@aperture-engine/render";
import { EcsType, defineComponent, registerMetadataComponents, registerTransformComponents, } from "@aperture-engine/simulation";
import { ScreenSpaceFraming } from "./screen-space-framing.js";
export const AppEntityKey = defineComponent("aperture.app.entityKey", {
    value: { type: EcsType.String, default: "" },
}, "Optional globally unique app-authored entity key for tooling and diagnostics.");
export const AppEntityTags = defineComponent("aperture.app.entityTags", {
    valuesJson: { type: EcsType.String, default: "[]" },
}, "Optional app-authored entity tags serialized for tooling and diagnostics.");
export const AppEntitySource = defineComponent("aperture.app.entitySource", {
    kind: { type: EcsType.String, default: "" },
    assetId: { type: EcsType.String, default: "" },
    gltfNodeIndex: { type: EcsType.Int32, default: -1 },
    gltfNodePath: { type: EcsType.String, default: "" },
}, "Optional app-authored or loader-authored source metadata for tooling and diagnostics.");
export const RenderInterpolation = defineComponent("aperture.render.interpolation", {
    enabled: { type: EcsType.Boolean, default: true },
    initialized: { type: EcsType.Boolean, default: false },
    previousTranslation: { type: EcsType.Vec3, default: [0, 0, 0] },
    previousRotation: { type: EcsType.Vec4, default: [0, 0, 0, 1] },
    previousScale: { type: EcsType.Vec3, default: [1, 1, 1] },
    currentTranslation: { type: EcsType.Vec3, default: [0, 0, 0] },
    currentRotation: { type: EcsType.Vec4, default: [0, 0, 0, 1] },
    currentScale: { type: EcsType.Vec3, default: [1, 1, 1] },
}, "Opt-in fixed-step render interpolation state for non-physics LocalTransform entities.");
export function registerApertureAppComponents(world) {
    registerTransformComponents(world);
    registerMetadataComponents(world);
    registerRenderAuthoringComponents(world);
    world.registerComponent(AppEntityKey);
    world.registerComponent(AppEntityTags);
    world.registerComponent(AppEntitySource);
    world.registerComponent(RenderInterpolation);
    world.registerComponent(ScreenSpaceFraming);
    return world;
}
//# sourceMappingURL=components.js.map