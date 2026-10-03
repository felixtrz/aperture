# Live mesh shadow invalidation regression

Status: compatible CPU-validated source patch and rebuilt engine, frozen locally.
Parent native validation remains pending. This investigation ran no browser,
server, network, Git, publication, release, or package-version change.

## Native input and demonstrated cause

The preceding publication/demand fixes passed all 29 native live states, but the
arch edit's live image differed from the fresh static control. Independent pixel
comparison here confirms 5,186 differing pixels, maximum channel difference 49,
within inclusive bounds [629, 421, 928, 639]. The native report reused the automatic
shadow frame through the change-set fast path even though caster mesh assets had
new versions and correct uploaded geometry.

The automatic-shadow cache checked the snapshot frame, draw/light/bounds change
sets, and a snapshot-derived input key. None included source mesh asset versions.
Publishing new vertex or index bytes to the same handle can leave all those
snapshot inputs unchanged. A real renderer/cache regression reproduced this in
16 cases: vertex and index edits across directional, cascaded, point and spot
shadows, each on frame-graph and legacy submission paths. Every original-source
case reused the shadow frame instead of submitting new caster work.

## Minimal compatible fix

- Compute a deterministic, deduplicated key from supported caster mesh handles and
  their source-registry versions. Use the same caster selection as the existing
  shadow resource preparation, including off-camera shadowCasterDraws.
- Retain the key on the successful cached shadow frame and compare it before all
  same-frame, change-set and input-key reuse paths.
- Report a miss with firstChangedInputSection `caster-mesh-assets` when versions
  differ. Existing light, request, bounds, submission and resource code is retained.
- The cache field is optional for source compatibility; a legacy entry without
  version evidence conservatively rebuilds once. No worker protocol or public
  scene API changed.

Unchanged frames, repeated frames and unrelated mesh publications still reuse
shadows with zero newly submitted caster draws. New same-frame and discontinuous
frame publications invalidate too. Unsupported alpha casters, non-casters and
layer-excluded meshes do not enter the version key; duplicate casters are deduped.
The two preceding engine fixes and all earlier evidence remain untouched.

## Validation and limits

- Final explicit selection: 178 tests passed across 12 canonical CPU suites.
- Final 16 renderer regression cases fail against byte-preserved original source
  and pass with the fix. The original-source Vite load overlay does not mutate
  the active checkout or built artifacts.
- Full test TypeScript checking, scoped ESLint and Prettier passed.
- All 13 packages built; package and headless boundary checks passed.
- Six adopted lifecycle runs completed after all descendants were waited for.
- All 641 inventoried prior benchmark/evidence files remained byte-identical.
- All five changed source/test files have archived original and final bytes.
  Source archives use `.txt`, preventing accidental test discovery.
- These CPU renderer tests use instrumented fake GPU devices. Native output after
  this shadow patch has not been rendered here; the parent owns that validation.
- The parent’s earlier full-suite failure is not overwritten or reclassified.
  No unfiltered Vitest, CLI browser fixtures, or full check was attempted here.
- No benchmark score, GPU memory claim, or performance claim is made.

## Files

- `inputs.json`: source/helper hashes and immutable prior evidence inventory
- `originals/`, `final-source/`: exact source/test bytes, stored as text
- `source.patch`: unified five-file change
- `regression-before.log`: first 16 failing real-renderer cases
- `final-original-regression.log`: final exact cases fail on original components
- `vitest-original.config.mjs`: canonical original-source load overlay
- `regression-after-001.log`: first 111-test pass
- `static-checks.log`: formatting, lint, full test TypeScript check
- `final-scoped-cpu.log`: authoritative 178-test pass
- `build-inputs.json`, `build.log`, `built-artifacts.json`: explicit rebuild and
  complete prior/current built artifact inventories
- `native-input-comparison.json`: independently verified existing PNG difference
- `lifecycle-audits/`, `verification.json`: byte checks and quiescence evidence
- `manifest.json`: final artifact hashes, excluding its own bytes
