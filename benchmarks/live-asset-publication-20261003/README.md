# Live asset publication regression, 2026-10-03

Status: isolated CPU diagnosis and compatible patch validated and frozen locally.
Native validation and publication remain parent-owned and have not been performed
by this investigation. No browser, server, network, Git, dependency installation,
release, or package version change was performed.

## Findings and patch

1. Same-layout `meshes.publish` replacements with no `updateRanges` were encoded
   as mesh patches with zero changed bytes. The source registry reached version 2,
   but the main-thread mirror retained version-1 geometry. This was reproduced
   both with public mesh helpers and with the actual frozen crane worker over a
   real MessagePort. All 22 shoulder-edited crane meshes carried zero patch bytes.
   The serializer now uses the full-asset path whenever any vertex or index
   buffer lacks explicit ranges. This also preserves correct full uploads for
   six-byte uint16 index buffers, which cannot be represented as an aligned
   six-byte WebGPU subrange write.
2. The patch materializer also discarded explicit empty range lists. It now keeps
   those lists, preserving the distinction between no changed bytes and a full
   replacement. A tested four-byte vertex edit emits one four-byte upload and no
   index upload; existing partial-range tests remain passing.
3. Snapshot/demand presentation kept polling the latest shared frame using an
   older received message. A shared frame can become visible before postMessage
   delivers its source assets. The real renderer CPU test reproduced presentation
   of frame 2 while the mirror still held version 1. Rendering then records the
   frame as presented, allowing a subsequent matching message to be deduplicated.
   Snapshot cadence now requires the matching delivered frame and stops polling
   old messages after presentation. Tests also cover a delivered frame superseded
   in SAB before RAF, followed by a successful newer delivered update.

The captured native frame-3/version-1/no-write symptom is consistent with the
reproduced ordering defect. The immutable native capture does not itself contain
an exhaustive renderer-versus-message delivery timestamp trace. A new parent-run
native attempt is required to verify the combined fix against that capture.

The renderer's version-based caches behaved correctly in the isolated component
chain: a delivered version-2 asset prepares version 2 and reuses the same GPU
buffer while uploading changed bytes. No cache invalidation workaround was added.

## Scope boundaries

- Continuous RAF latest-frame sampling is unchanged. Synchronizing shared frames
  with source-asset sidebands for continuous presentation remains outside scope.
- Snapshot cadence intentionally requires corresponding delivered snapshot
  messages. This matches the frozen crane adapter's full-summary publication
  path. Source-assets-only sidebands do not become a new snapshot notification
  protocol in this patch.
- CPU WebGPU tests use the repository's instrumented fake device, not a real GPU.
  Real MessagePort tests run the actual crane ECS/worker and source-asset mirror,
  but do not render. These are regression checks, not benchmark scores.
- All 314 inventoried files under `benchmarks/crane-live-edits-20261003` remained
  byte-identical. Author attempts, raw-byte diagnostics, source pins and runtime
  pins were not edited. Existing native captures remain evidence of the old build.
- The rebuild was explicitly recorded against new source hashes. The old built
  artifact inventory and the new 4,628-file inventory are retained separately.

## Validation

- Final canonical six CPU suites: 123 tests passed.
- All four newly added regression cases fail against the original source preimages
  and pass against the patch. `vitest-original.config.mjs` supplies the original
  implementation bytes at their canonical module paths without mutating source.
- Full test TypeScript checking passed.
- Scoped ESLint and Prettier passed.
- All 13 packages built successfully.
- Package boundaries and headless boundaries passed.
- Actual frozen crane worker + MessagePort + main-thread mirror: all 29 states
  passed in both shared and transferable modes, each checking 65 mesh vertex and
  index byte sets and versions (1,885 comparisons per mode). Apps and ports closed.
- All 12 adopted lifecycle runs completed after descendants were waited for.
  Expected failure runs and implementation/test mistakes remain retained.
- Repository-wide `pnpm run check` was not run: this dispatch forbids browser and
  server execution. No aggregate check or native GPU pass is claimed.

## Evidence guide

- `inputs.json`: original source/helper hashes and immutable native input inventory
- `originals/`: source preimages; archived tests use `.txt` to avoid discovery
- `final-source/`: exact final source and tests; archived tests use `.txt`
- `source.patch`: unified patch for two engine files and two test files
- `failing-regression.log`: first test fixture mistake (flat positions); not proof
- `failing-regression-002.log`: initial missing-byte reproduction; its indexed input
  was expanded by the primitive helper, so final tests add normals to prove a true
  indexed buffer and verify changed index bytes explicitly
- `crane-mirror-before.log`: real crane/shared worker sends empty replacement patches
- `shared-race-before.log`: renderer consumes a newer SAB frame before asset delivery
- `targeted-after-001.log`: rejected first fix because a six-byte index subrange was
  not aligned; final fix uses the existing full-asset upload path
- `typecheck-001.log`: test fixture used unsupported box `size`; corrected to dimensions
- `final-cpu-001.log`: typecheck/lint/format passed; test count included one archive
- `final-regressions-original-source.log`: first final-preimage run included archives
- `final-regressions-original-source-isolated.log`: four genuine final tests fail
  against original components; only canonical test files included
- `final-built-validation.log`: authoritative 123-test pass and boundary checks
- `build-inputs.json`, `build.log`, `built-artifacts.json`: explicit new-source build
- `crane-mirror-after-shared.json`, `crane-mirror-after-transferable.json`: all states
- `run-mirror-trace-before.mjs`, `run-mirror-trace.mjs`: exact trace harness revisions
- `lifecycle-audits/`, `verification.json`: completion and byte verification
- `manifest.json`: final output inventory and hashes (excludes its own bytes)

A prior interim report counted 207 tests across seven files because Vitest also
found an archived preimage test. Archive extensions were changed and the final
canonical run reported 123 tests across six files. Counts above use only that run.
