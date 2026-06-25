# Unified Particle Effect Composition TODO

## Goal

Make Aperture particle effects support both single Shuriken-style emitters and
composite Unity-prefab-style VFX through one public API:

- One asset entry point: `asset.particleEffect(...)`
- One spawn entry point: `withParticleEmitter(...)`
- Internally distinguish leaf emitter effects from composite effects.
- WebGPU should only receive concrete leaf emitter packets.

## Design Rule

A particle effect is either:

1. A **leaf emitter effect** using Shuriken-style modules: `main`, `emission`,
   `shape`, `renderer`, etc.
2. A **composite effect** using `emitters`, where each child references another
   particle effect.

Do not allow one effect object to mix both forms.

## Schema Changes

In `packages/render/src/assets/particles.ts`, replace the single object-shaped
`ParticleEffectAssetInput` with a discriminated union:

```ts
export type ParticleEffectAssetInput =
  | ParticleEmitterEffectAssetInput
  | ParticleCompositeEffectAssetInput;

export interface ParticleEmitterEffectAssetInput {
  readonly version: 2;
  readonly type?: "emitter";
  readonly label?: string;
  readonly main?: ParticleMainModuleInput;
  readonly emission?: ParticleEmissionModuleInput;
  readonly shape?: ParticleShapeModuleInput;
  readonly renderer?: ParticleRendererModuleInput;
  readonly textureSheetAnimation?: ParticleTextureSheetAnimationModuleInput;
  readonly colorOverLifetime?: ParticleColorOverLifetimeModuleInput;
  readonly sizeOverLifetime?: ParticleSizeOverLifetimeModuleInput;
  readonly rotationOverLifetime?: ParticleRotationOverLifetimeModuleInput;
  readonly velocityOverLifetime?: ParticleVelocityOverLifetimeModuleInput;
  readonly forceOverLifetime?: ParticleForceOverLifetimeModuleInput;
  readonly limitVelocityOverLifetime?: ParticleLimitVelocityOverLifetimeModuleInput;
  readonly subEmitters?: readonly ParticleSubEmitterInput[];
  readonly source?: ParticleSourceMetadata;
  readonly curveSampleCount?: number;
}

export interface ParticleCompositeEffectAssetInput {
  readonly version: 2;
  readonly type: "composite";
  readonly label?: string;
  readonly emitters: readonly ParticleCompositeEmitterInput[];
  readonly source?: ParticleSourceMetadata;
}
```

Then make the normalized runtime asset a union:

```ts
export type ParticleEffectAsset =
  | ParticleEmitterEffectAsset
  | ParticleCompositeEffectAsset;
```

Leaf effects should keep the existing normalized module/runtime data. Composite
effects should normalize child delays, durations, time scales, transforms, and
dependencies.

## Validation Rules

Update `validateParticleEffectInput(...)` so it rejects:

- Legacy flat particle fields.
- Missing `version: 2`.
- `type: "composite"` without `emitters`.
- Any object with both `emitters` and leaf modules like `main`, `emission`,
  `shape`, or `renderer`.
- Any composite child whose `effect` is not a valid `particle-effect` handle.
- Negative delay, negative duration, non-positive time scale, invalid transform
  values.

Diagnostic should be explicit:

```text
Particle effect cannot mix composite emitters with Shuriken modules. Use either type: "composite" with emitters, or leaf modules like main/emission/renderer.
```

## Runtime / Extraction

Keep `ParticleEmitter` as the only ECS authoring component. Its `effectId` may
point to either a leaf or composite particle effect.

In `extractParticleEmitters(...)`:

- Resolve the effect.
- If it is a leaf, emit one `ParticleEmitterPacket` as today.
- If it is composite, expand each child into one leaf packet.
- Recursively resolve child effects, but reject nested composites initially with
  a diagnostic unless deliberately supported.
- Compose parent world transform with child local transform.
- Apply child `delay`, `duration`, and `timeScale`.
- Create stable child emitter IDs from parent entity + composite effect key +
  child index.
- WebGPU must receive only leaf `ParticleEmitterPacket`s.

Suggested helper:

```ts
function appendLeafParticleEmitterPacket(input: {
  readonly entity: Entity;
  readonly effect: AssetHandle<"particle-effect">;
  readonly effectAsset: ParticleEmitterEffectAsset;
  readonly worldMatrix: Mat4;
  readonly emitterId: number;
  readonly seed: number;
  readonly resetEpoch: number;
  readonly timeScale: number;
  readonly simulationSpace: "local" | "world";
  readonly layerMask: number;
  readonly renderOrder: number;
}): void;
```

## Sub-Emitters

Keep Shuriken sub-emitters schema-supported but runtime-diagnostic-only for now.

Change `effect: string` to a typed particle effect handle:

```ts
export interface ParticleSubEmitterInput {
  readonly event: "birth" | "death" | "collision" | "trigger" | "manual";
  readonly effect: AssetHandle<"particle-effect">;
  readonly probability?: number;
  readonly emitCount?: number;
}
```

Add dependency tracking from a leaf effect to its sub-emitter effects. Runtime
diagnostics should say sub-emitters are declared but not emitted yet.

## Tests

Add focused tests for:

- Leaf effect still normalizes exactly as before.
- Composite effect normalizes child defaults.
- Composite dependencies include all child effects.
- Mixed leaf/composite schema fails validation.
- `withParticleEmitter({ effect })` works for leaf and composite handles.
- Composite extraction emits N leaf packets.
- Composite child transforms affect world transform offsets.
- Composite child IDs are stable across frames.
- Child timing gates packets correctly.
- WebGPU preparation never receives composite assets directly.

## Final Public API

The author-facing API should stay unified:

```ts
asset.particleEffect("smoke", {
  version: 2,
  main: { maxParticles: 512 },
  emission: { rateOverTime: 40 },
  renderer: { texture: smokeTexture, blendMode: "alpha" },
});
```

```ts
asset.particleEffect("explosion", {
  version: 2,
  type: "composite",
  emitters: [
    { label: "flash", effect: asset.particleEffectHandle("flash"), delay: 0 },
    {
      label: "sparks",
      effect: asset.particleEffectHandle("sparks"),
      delay: 0.03,
    },
    {
      label: "smoke",
      effect: asset.particleEffectHandle("smoke"),
      delay: 0.08,
    },
  ],
});
```

Spawning remains the same:

```ts
withParticleEmitter({
  effect: asset.particleEffectHandle("explosion"),
});
```

Internally, `explosion` expands into multiple leaf emitter packets. The renderer
does not need to know composites exist.
