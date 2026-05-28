import { registerRenderAuthoringComponents } from "@aperture-engine/render";
import {
  EcsType,
  defineComponent,
  registerMetadataComponents,
  registerTransformComponents,
  type EcsWorld,
} from "@aperture-engine/simulation";

export const AppEntityKey = defineComponent(
  "aperture.app.entityKey",
  {
    value: { type: EcsType.String, default: "" },
  },
  "Optional globally unique app-authored entity key for tooling and diagnostics.",
);

export const AppEntityTags = defineComponent(
  "aperture.app.entityTags",
  {
    valuesJson: { type: EcsType.String, default: "[]" },
  },
  "Optional app-authored entity tags serialized for tooling and diagnostics.",
);

export const AppEntitySource = defineComponent(
  "aperture.app.entitySource",
  {
    kind: { type: EcsType.String, default: "" },
    assetId: { type: EcsType.String, default: "" },
    gltfNodeIndex: { type: EcsType.Int32, default: -1 },
    gltfNodePath: { type: EcsType.String, default: "" },
  },
  "Optional app-authored or loader-authored source metadata for tooling and diagnostics.",
);

export function registerApertureAppComponents(world: EcsWorld): EcsWorld {
  registerTransformComponents(world);
  registerMetadataComponents(world);
  registerRenderAuthoringComponents(world);
  world.registerComponent(AppEntityKey);
  world.registerComponent(AppEntityTags);
  world.registerComponent(AppEntitySource);
  return world;
}
