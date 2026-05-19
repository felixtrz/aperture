# Shadow Caster Command Plan Scratch Writer Implementation — 2026-05-19

## Task

`task-1817` added a scratch-backed writer for shadow caster command-plan
readiness.

## Reference Anchors

- Decision 0009 hot-path writer guidance.
- Local `shadow-caster-command-plan-readiness` report helper.

## Implementation

- Added `createShadowCasterCommandPlanReadinessScratch`.
- Added `writeShadowCasterCommandPlanReadinessReport`.
- The existing `createShadowCasterCommandPlanReadinessReport` remains the
  allocation-friendly diagnostic convenience wrapper.
- The writer refills caller-owned command and diagnostic arrays and reuses
  command plan objects from a scratch pool.

## Boundary Notes

- The writer still emits data-only command plans.
- It does not create a `GPUCommandEncoder`, render pass, shadow texture, matrix
  buffer, or draw submission.
- The scratch writer is suitable as the shape to extend before command planning
  enters live frame orchestration.

## Validation

- Extended `test/webgpu/shadow-caster-command-plan-readiness.test.ts` to verify
  scratch array and command object reuse.
