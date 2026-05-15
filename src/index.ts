export const APERTURE_VERSION = "0.0.0";

export * from "./ecs/index.js";
export * from "./assets/index.js";
export * from "./diagnostics/index.js";
export * from "./materials/index.js";
export * from "./math/index.js";
export * from "./mesh/index.js";
export * from "./rendering/index.js";
export * from "./transform/index.js";
export * from "./webgpu/index.js";

export interface ApertureIdentity {
  readonly name: "Aperture";
  readonly version: typeof APERTURE_VERSION;
  readonly renderingBackend: "webgpu";
  readonly worldModel: "ecs-authoritative";
  readonly renderingModel: "derived-view";
}

export const APERTURE_IDENTITY: ApertureIdentity = {
  name: "Aperture",
  version: APERTURE_VERSION,
  renderingBackend: "webgpu",
  worldModel: "ecs-authoritative",
  renderingModel: "derived-view",
};
