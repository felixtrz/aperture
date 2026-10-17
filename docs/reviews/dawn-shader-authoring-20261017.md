# Dawn, shader and polygon authoring review

Reviewed the pending Aperture implementation and benchmark follow-ups on
17 October 2026 before committing. The review covered native device/output
ownership, render-worker and MCP recovery, shared GPU resources and frame replay,
shader compilation/material contracts, snapshot codecs, explicit browser capture,
AO projection/depth changes, polygon authoring, package exports and CI packaging.

## Findings fixed

| Priority | Finding                                                                                                                                                                | Fix and regression evidence                                                                                                                                                                             |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P2       | Shader replacement published the new operation before history texture reset completed. An allocation failure returned `ok: false` while leaving the new shader active. | Complete the transactional history reset before publishing; dispose rejected candidates. A native allocation-failure test verifies the original operation, resources, capture and pixels remain usable. |
| P2       | Offscreen resize destroyed the current texture before replacement allocation. A thrown allocation left the output with changed dimensions and a destroyed texture.     | Allocate first, then commit dimensions/texture and destroy the previous texture. Native readback verifies the old image survives failure and a subsequent resize succeeds.                              |
| P2       | A rejected frame cleared pending recorded writes although the writes had already changed live GPU buffers. A later portable replay rendered different pixels.          | Retain writes until a frame completes. A real GPU test rejects a graph with an uninitialized texture, corrects it and verifies replay matches the live green image.                                     |
| P2       | MCP shader rendering retained a failed warm worker, so later shader requests reused the failed session.                                                                | Dispose the failed render slot and create a new session on the next request, matching frame-capture recovery. A lifecycle test verifies teardown and successful retry.                                  |
| P2       | The shared typed-array codec assigned `__proto__` through an object setter and looked up constructor names through inherited properties.                               | Build ordinary records with own data properties and require own constructor-table entries. Regression tests verify prototype-named fields round-trip and unsupported constructor names are rejected.    |

All new failure regressions were run against the pre-fix implementation and
failed for the expected reasons before the fixes were applied.

The full test suite also exposed a pre-existing interpolation test that mixed
real startup time into an explicit-step accumulator. The test now starts paused
and initializes with an explicit zero-delta step. Numeric tolerances were
tightened from three to six decimal places. No simulation behavior was changed.

The repository ignore rule now excludes `node_modules` symlinks as well as
directories. Local comparison checkouts, installed dependencies, native drivers
and generated package/docs builds remain outside the commits. Retained benchmark
sources, captures, reports and evidence keep their original bytes.

## Validation

- `pnpm run check` passed: 676 files and 4,779 tests, plus package builds,
  type checks, boundary/release/publish checks, packed CLI validation, examples,
  docs builds and routes, diagnostics, lint and formatting.
- `pnpm run test:coverage` passed: 677 files and 4,797 tests. Statements:
  85.38%; branches: 75.22%; functions: 90.70%; lines: 85.42%. All existing
  thresholds remain unchanged. The first coverage run exposed missing source
  coverage for the standalone GPU path; its 18 existing real-device tests now
  share one suite between Node's packaged qualification and Vitest's source
  instrumentation. Both runners passed after this change, and the new harness
  passed targeted lint and formatting checks.
- Native Dawn qualification passed all 47 tests across device/output lifecycle,
  standalone shaders, material extensions and SSAO depth behavior.
- The repeated-session memory gate passed over 1,200 frames: RSS growth was
  897,024 bytes, heap growth was -3,710,344 bytes and peak RSS was 444,579,840
  bytes, within the existing budgets.
- `node scripts/check-pack-cli.mjs --render-dawn` passed with a clean packed
  CLI installation and native render smoke test.
- The five review findings have regression coverage. The isolated interpolation
  suite also passed all 37 tests with the seed that reproduced its original
  startup-timing failure.

The full check ran before adding the shared native-suite Vitest entrypoint;
the final coverage run includes that entrypoint and all 4,797 tests. Validation
used the repository-pinned pnpm 10.12.1.

## Scope

This is a source review by the implementing agent, with automated regression and
native GPU checks. It is not an independent external audit. Native qualification
uses Linux x64, Node 24 and the provisioned SwiftShader Vulkan driver. Hardware,
macOS and Windows driver behavior is not established by this environment.

The existing benchmark scores describe the frozen authoring trials. Review fixes
do not change those scores or establish a new agent speed/cost measurement.
