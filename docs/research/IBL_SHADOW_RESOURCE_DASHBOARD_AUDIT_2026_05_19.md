# IBL/Shadow Resource Dashboard Audit

Date: 2026-05-19

## Scope

Audited the public tracker after the GLTF scene descriptor/resource chain added:

- IBL descriptor reports,
- IBL texture preparation descriptors,
- StandardMaterial IBL readiness,
- shadow-map descriptors,
- shadow texture descriptors,
- shadow pass plans, and
- StandardMaterial shadow readiness.

## Result

The dashboard now describes IBL and shadow work as descriptor, preparation,
planning, and readiness diagnostics until real GPU passes and shader sampling
exist.

Confirmed:

- `docs/index.html` recommends IBL/shadow resource dashboard follow-up work
  rather than public custom shader/material APIs.
- `docs/render-pipeline-comparison.html` lists IBL texture preparation,
  shadow-pass planning, and StandardMaterial shadow readiness as working
  diagnostics while still marking IBL sampling, shadow pass submission, and
  shadow sampling missing.
- Tracker language does not claim visible IBL lighting or visible shadows.
- The backlog still prioritizes the GLTF scene built-in material path over
  custom material adapter facades.

Validation:

- `pnpm run check:progress`

## Next Ready Queue

Refill the backlog with implementation slices that turn the descriptor chain
toward real renderer-owned work without skipping the ECS/render boundary:

1. Plan IBL texture upload/prefilter passes from the preparation descriptors.
2. Add directional shadow view/projection matrix planning.
3. Add shadow caster draw-list planning for the extracted shadow request.
4. Add shader binding metadata readiness for IBL and shadow resources.
5. Audit again before enabling visible shader sampling.
