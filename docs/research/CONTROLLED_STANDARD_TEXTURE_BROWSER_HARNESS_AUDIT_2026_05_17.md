# Controlled StandardMaterial Texture Browser Harness Audit - 2026-05-17

## Scope

Audit the browser harness choice before implementing controlled
StandardMaterial texture pixel coverage.

## References Inspected

- `examples/multi-entity.js`
- `test/e2e/multi-textured-unlit.spec.ts`
- `examples/materials-showcase.js`
- `test/e2e/materials-showcase.spec.ts`
- `examples/webgpu-readback.js`
- `packages/webgpu/src/webgpu/unlit-frame-resources.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `docs/research/CONTROLLED_STANDARD_TEXTURE_BROWSER_VERIFICATION_PLAN_2026_05_17.md`

## Findings

- The multi-entity example has the best existing readback and expected-color
  status pattern.
- Its shared successful render path still calls
  `createMultiMaterialUnlitFrameGpuResources()`, which packs material buffers
  and group-2 texture entries through the unlit material resource path.
- StandardMaterial browser examples that already render correctly use the app
  facade route, as seen in `examples/materials-showcase.js`.
- Extending the materials showcase would add broad, animated screenshot
  assertions instead of a controlled fixed-camera texture proof.

## Result

Do not add StandardMaterial to the multi-entity readback harness in the next
slice. The safer implementation route is a dedicated fixed app-style browser
example that uses `createWebGpuApp`, authors two StandardMaterial primitives,
and adds readback sampling around that example.

## Follow-Up

Add the dedicated controlled StandardMaterial texture example and Playwright
coverage first. Only generalize multi-entity StandardMaterial frame-resource
support later if multiple browser scenarios need the same lower-level harness.
