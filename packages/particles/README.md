# @aperture-engine/particles

Particle authoring contracts and domain types for the Aperture engine.

## Install

```sh
pnpm add @aperture-engine/particles
```

This package is part of the [Aperture](https://github.com/felixtrz/aperture)
WebGPU game engine and is normally used together with the other
`@aperture-engine/*` packages.

## What It Does

`@aperture-engine/particles` owns particle domain types that are safe to use in
headless simulation and authoring code:

- `ParticleSimulationSpace`
- `ParticleBlendMode`
- `ParticleEmitterInput`
- particle effect input/asset/runtime types
- `createParticleEffectAsset`
- particle effect validation and runtime feature analysis

It does not own render snapshot packets, WebGPU buffers, or live GPU particle
state.

## Entry Points

- `@aperture-engine/particles` - particle authoring contracts, effect schemas,
  normalization, validation, and runtime feature analysis.
- `@aperture-engine/particles/app` - structural app feature descriptor for
  feature-based composition.

```ts
import { particlesFeature } from "@aperture-engine/particles/app";

export const features = [particlesFeature()];
```

## Migration

Existing imports from `@aperture-engine/render`, `@aperture-engine/runtime`, and
`@aperture-engine/app/systems` remain available for the current migration
window. New particle-domain imports should prefer `@aperture-engine/particles`.

## License

Part of the [Aperture monorepo](https://github.com/felixtrz/aperture). MIT
licensed.
