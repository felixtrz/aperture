export const APERTURE_VERSION = "0.0.0";

export * from "@aperture-engine/simulation";
export * from "@aperture-engine/render";
export * from "@aperture-engine/runtime";

export interface ApertureIdentity {
  readonly name: "Aperture";
  readonly version: typeof APERTURE_VERSION;
  readonly renderingBackend: "webgpu-explicit";
  readonly worldModel: "ecs-authoritative";
  readonly renderingModel: "derived-view";
}

export const APERTURE_IDENTITY: ApertureIdentity = {
  name: "Aperture",
  version: APERTURE_VERSION,
  renderingBackend: "webgpu-explicit",
  worldModel: "ecs-authoritative",
  renderingModel: "derived-view",
};
