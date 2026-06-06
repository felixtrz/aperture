import type { EcsWorld } from "@aperture-engine/simulation";
import {
  Camera,
  Fog,
  InstanceData,
  InstanceTint,
  Light,
  LightCookie,
  LightShadowSettings,
  Material,
  MaterialSlots,
  Mesh,
  MeshQueryAcceleration,
  MorphTargetWeights,
  OcclusionQuery,
  ParticleEmitter,
  Pickable,
  RenderLayer,
  RenderOrder,
  ShadowCaster,
  ShadowReceiver,
  Skin,
  Skybox,
  Sprite,
  UiHitTarget,
  UiImage,
  UiNode,
  UiPanel,
  UiScreen,
  UiScroll,
  UiText,
  Visibility,
} from "./authoring-components.js";

export * from "./authoring-types.js";
export * from "./authoring-components.js";
export * from "./authoring-create.js";
export * from "./authoring-validation.js";

export function registerRenderAuthoringComponents(world: EcsWorld): EcsWorld {
  world.registerComponent(Mesh);
  world.registerComponent(Material);
  world.registerComponent(MaterialSlots);
  world.registerComponent(Sprite);
  world.registerComponent(ParticleEmitter);
  world.registerComponent(UiScreen);
  world.registerComponent(UiNode);
  world.registerComponent(UiPanel);
  world.registerComponent(UiImage);
  world.registerComponent(UiText);
  world.registerComponent(UiHitTarget);
  world.registerComponent(UiScroll);
  world.registerComponent(Skybox);
  world.registerComponent(Fog);
  world.registerComponent(Camera);
  world.registerComponent(Visibility);
  world.registerComponent(OcclusionQuery);
  world.registerComponent(RenderLayer);
  world.registerComponent(Pickable);
  world.registerComponent(MeshQueryAcceleration);
  world.registerComponent(RenderOrder);
  world.registerComponent(InstanceTint);
  world.registerComponent(InstanceData);
  world.registerComponent(Skin);
  world.registerComponent(MorphTargetWeights);
  world.registerComponent(Light);
  world.registerComponent(LightCookie);
  world.registerComponent(ShadowCaster);
  world.registerComponent(ShadowReceiver);
  world.registerComponent(LightShadowSettings);
  return world;
}
