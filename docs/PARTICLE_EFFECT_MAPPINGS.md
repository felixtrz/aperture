# Particle Effect Import Mapping

Aperture particle effects use `version: 2` Shuriken-style modules. Importers
should produce serializable asset intent only; ECS entities own emitter intent,
snapshots transfer emitter packets, and WebGPU owns derived particle state.

## Source Metadata

Converted effects may preserve source context on the asset:

```ts
source: {
  format: "shuriken" | "three.quarks" | "aperture",
  version: "2022.3",
  sourceName: "Fireball Burst",
  unsupportedFeatures: ["lights", "collision.sendMessages"],
}
```

Unsupported or approximated source features should be preserved in
`source.unsupportedFeatures` and also surfaced through
`runtimeFeatures.diagnostics` when the corresponding Aperture module is enabled.

## Unity Shuriken Mapping

| Shuriken concept                              | Aperture v2 field                                | Runtime status                                                                                                      |
| --------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Main.duration                                 | `main.duration`                                  | Supported                                                                                                           |
| Main.looping                                  | `main.loop`                                      | Supported                                                                                                           |
| Main.prewarm                                  | `main.prewarm`                                   | Supported for looping effects                                                                                       |
| Main.startDelay                               | `main.startDelay`                                | Supported                                                                                                           |
| Main.startLifetime                            | `main.startLifetime`                             | Constants, ranges, and curves normalize to runtime ranges                                                           |
| Main.startSpeed                               | `main.startSpeed`                                | Constants, ranges, and curves normalize to runtime ranges                                                           |
| Main.startSize                                | `main.startSize`                                 | Scalar size supported; vec3 imports are reduced to scalar max                                                       |
| Main.startRotation                            | `main.startRotation`                             | Billboard rotation supported                                                                                        |
| Main.startColor                               | `main.startColor`                                | Constants, ranges, gradients supported through normalized color curves                                              |
| Main.gravityModifier                          | `main.gravityModifier`                           | Supported                                                                                                           |
| Main.simulationSpeed                          | `main.simulationSpeed`                           | Supported                                                                                                           |
| Main.maxParticles                             | `main.maxParticles`                              | Supported                                                                                                           |
| Emission.rateOverTime                         | `emission.rateOverTime`                          | Supported                                                                                                           |
| Emission.rateOverDistance                     | `emission.rateOverDistance`                      | Supported                                                                                                           |
| Emission.bursts                               | `emission.bursts`                                | Count, cycles, interval, and probability supported                                                                  |
| Shape.point/sphere/hemisphere/cone/circle/box | `shape`                                          | Supported                                                                                                           |
| Shape.donut/grid/rectangle                    | `shape.type`                                     | Supported for continuous emitters; partial diagnostic for burst emitters                                            |
| Shape.mesh surface                            | `shape.type`                                     | Bounds-proxy surface sampling for continuous emitters; partial diagnostic for burst emitters and true mesh sampling |
| Renderer.billboard                            | `renderer.renderMode: "billboard"`               | Supported                                                                                                           |
| Renderer.stretched/horizontal/vertical        | `renderer.renderMode`                            | Supported with dedicated render pipeline variants                                                                   |
| Renderer.mesh/trail                           | `renderer.renderMode`                            | Trail impostor ribbons supported; mesh mode preserves dependencies but currently renders billboard impostors        |
| Texture Sheet Animation                       | `textureSheetAnimation`                          | Grid, start frame, frame over time, and cycle count supported                                                       |
| Color over Lifetime                           | `colorOverLifetime`                              | Supported                                                                                                           |
| Size over Lifetime                            | `sizeOverLifetime`                               | Supported as scalar billboard size                                                                                  |
| Rotation over Lifetime                        | `rotationOverLifetime`                           | Supported for billboard rotation                                                                                    |
| Velocity over Lifetime                        | `velocityOverLifetime`                           | Supported as constant/normalized velocity vector                                                                    |
| Force over Lifetime                           | `forceOverLifetime`                              | Supported as constant/normalized acceleration                                                                       |
| Speed over Lifetime                           | `speedOverLifetime`                              | Supported for continuous emitters; partial diagnostic for burst emitters                                            |
| Limit Velocity over Lifetime                  | `limitVelocityOverLifetime`                      | Damping and hard speed clamp supported for continuous emitters                                                      |
| Color/Size/Rotation by Speed                  | `colorBySpeed`, `sizeBySpeed`, `rotationBySpeed` | Supported for continuous emitters; partial diagnostic for burst emitters                                            |
| Noise                                         | `noise`                                          | Supported for continuous emitters; partial diagnostic for burst emitters                                            |
| Orbital Velocity                              | `orbitalVelocityOverLifetime`                    | Supported for continuous emitters; partial diagnostic for burst emitters                                            |
| Collision                                     | `collision`                                      | Continuous world-plane collision response supported; partial diagnostic for burst/custom collider hooks             |
| Sub Emitters                                  | `subEmitters`                                    | Schema-recognized; runtime diagnostic when enabled; composite assets can represent coordinated child emitters       |
| Trails                                        | `trails`                                         | Motion-vector impostor trails supported for continuous emitters; partial diagnostic for burst trail modules         |

## three.quarks Mapping

| three.quarks concept                             | Aperture v2 field                                               | Runtime status                                                                                                      |
| ------------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Duration/looping/prewarm                         | `main`                                                          | Supported                                                                                                           |
| Start life/speed/size/rotation/color             | `main.start*`                                                   | Supported with normalized scalar/color value types                                                                  |
| Emission over time                               | `emission.rateOverTime`                                         | Supported                                                                                                           |
| Bursts                                           | `emission.bursts`                                               | Supported                                                                                                           |
| Point/sphere/hemisphere/cone/circle/box emitters | `shape`                                                         | Supported                                                                                                           |
| Donut/grid/rectangle emitters                    | `shape.type`                                                    | Supported for continuous emitters; partial diagnostic for burst emitters                                            |
| Mesh emitters                                    | `shape.type`                                                    | Bounds-proxy surface sampling for continuous emitters; partial diagnostic for burst emitters and true mesh sampling |
| Billboard particles                              | `renderer.renderMode: "billboard"`                              | Supported                                                                                                           |
| Stretched billboard/horizontal/vertical          | `renderer.renderMode`                                           | Supported with dedicated render pipeline variants                                                                   |
| Mesh/trail render modes                          | `renderer.renderMode`, `trails`                                 | Trail impostor ribbons supported; mesh mode preserves dependencies but currently renders billboard impostors        |
| Texture sheet/frame over life                    | `textureSheetAnimation`                                         | Supported                                                                                                           |
| Color/size/rotation over life                    | `colorOverLifetime`, `sizeOverLifetime`, `rotationOverLifetime` | Supported                                                                                                           |
| Velocity/force over life                         | `velocityOverLifetime`, `forceOverLifetime`                     | Supported                                                                                                           |
| Speed over life                                  | `speedOverLifetime`                                             | Supported for continuous emitters; partial diagnostic for burst emitters                                            |
| Limit speed                                      | `limitVelocityOverLifetime`                                     | Damping and hard speed clamp supported for continuous emitters                                                      |
| Color/size/rotation by speed                     | `colorBySpeed`, `sizeBySpeed`, `rotationBySpeed`                | Supported for continuous emitters; partial diagnostic for burst emitters                                            |
| Orbital motion                                   | `orbitalVelocityOverLifetime`                                   | Supported for continuous emitters; partial diagnostic for burst emitters                                            |
| Noise/turbulence                                 | `noise`                                                         | Supported for continuous emitters; partial diagnostic for burst emitters                                            |
| Subemitters                                      | `subEmitters`, `particle-composite-effect`                      | Subemitter module is diagnostic-only; composite VFX assets represent coordinated child emitters                     |
| Collision hooks                                  | `collision`                                                     | Continuous world-plane response supported; partial diagnostic for burst/custom hooks                                |
| Soft particles/depth fade                        | `renderer.softParticles`                                        | Supported on single-sample default canvas targets; MSAA/offscreen targets fall back to regular particles            |

## Partial Import Rules

- Valid partial imports should still create renderable Aperture effects.
- Missing unsupported source behavior should not fail validation by itself.
- Importers should prefer exact module fields over flattening source data.
- Approximation must be recorded in `source.unsupportedFeatures` or a converter
  warning, especially for vec3 size, mesh emitters, trails, soft particles, and
  collision behavior.
- Old flat Aperture particle fields are not aliases. They fail validation with
  migration diagnostics.
