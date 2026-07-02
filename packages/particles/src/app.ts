export interface ParticlesFeature {
  readonly id: "particles";
}

export function particlesFeature(): ParticlesFeature {
  return {
    id: "particles",
  };
}
