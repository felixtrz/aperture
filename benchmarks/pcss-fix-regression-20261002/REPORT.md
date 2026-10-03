# Single-map directional PCSS repair

## Result

The single-map directional `shadowType: 2` route now searches raw blocker depths
and applies a receiver–blocker-dependent disk filter. It no longer aliases the
fixed nine-tap PCF path. The original radius-6 cottage keeps its roof shadow
without the broad layered eave transition. No cottage geometry, light, bias,
bloom, camera, or other frozen scene input was edited.

This is a bounded artistic contact-hardening implementation, not a claim of
physical sun-emitter accuracy, a new performance score, or a broad shadow-system
rewrite. Spot, point, array-local, and cascaded behavior is preserved. The
separate cascaded normalized-depth ratio remains a distinct follow-up concern.

## Projection and radius

`docs/SINGLE_MAP_PCSS.md` defines the behavior. The authored base radius retains
the previous non-hard minimum of one texel and has a maximum of 16 texels on this
path. Receiver–blocker separation is recovered from the orthographic matrix's
depth-row scale and normalized by the shadow footprint. Radius grows linearly
until separation reaches 1/12 of the footprint, then saturates at the authored
maximum. Near/far depth origins and light-distance translations therefore do not
artificially change softness. Normalized bias remains a separate source of
range dependence and is deliberately unchanged.

The bounded shader work is 33 raw depth loads (32 disk points plus center), then
32 comparison gathers with explicit bilinear reconstruction. A no-blocker pixel
returns lit without the filter. The shared nearest comparison sampler is
unchanged. Degenerate/non-finite matrix scales use a finite hard-center fallback.
This work count is structural; no wall-clock speed claim is made.

## Native algorithm proof

The synthetic fixture extracts the production-generated dispatch and helper
functions verbatim. A native depth render produces a fixed vertical occluder
edge, and native fragment output is read back as float visibility. The same
footprint, map size, edge and radius are used with independently changed blocker
separation. Its zero depth bias deliberately isolates projection invariance.

The pre-fix WGSL snapshot was captured before the source edit; its actual
single-map dispatch uses fixed PCF. It is executed as a standalone native shader
fixture even though the surrounding package build is newer. The after fixture
uses the final generated WGSL. This isolates the changed algorithm without
rewriting/reverting engine source for a baseline.

| Light-space separation | Old 5–95% edge width | Patched 5–95% edge width |
| ---------------------- | -------------------: | -----------------------: |
| 0.02 world units       |     12 shadow texels |           1 shadow texel |
| 0.2                    |                   12 |                        2 |
| 0.8                    |                   12 |                        7 |
| 2.0                    |                   12 |                       10 |

The monotonic contact-distance assertions fail the old algorithm, rather than
merely asserting that two screenshots differ. The radius-6 response remains
narrow at contact and widens away from it.

Additional retained assertions:

- Changing near/far/light distance from `0.1/45/20` to `5/100/30` or
  `0.01/1000/100` retains the 7-texel profile. Maximum float-visibility errors are
  0.00000132 and 0.00000847, respectively.
- No blocker returns exactly 1; fully blocked samples return exactly 0.
- Hard and weighted-PCF near/far profiles are exactly unchanged.
- Zero and one authored base radius produce identical PCSS profiles; a large
  radius is capped and remains finite/bounded.
- A degenerate projection scale returns finite hard visibility.
- Six full generated shader variants compile natively: single directional,
  directional-plus-point with its actual clustered point-array feature set,
  spot, spot-array, cascaded, and existing mixed.

`analyze.py` asserts these outcomes from the retained native output. The profiles
are numerical algorithm evidence, not a general aesthetic metric.

## Frozen cottage compatibility

The front, rear, and steeper-roof edit were visually inspected after rendering.
All keep their authored geometry and coherent occlusion. Hard/type0 and
weighted-PCF/type1 images are pixel-identical to their historical controls.
All cottage runs report one requested/served directional map, no omitted request,
34 submitted shadow-caster draws, and no frame diagnostics.

The earlier diagnostic's exact x=335, y=240–264 eave transect has 15 intermediate
rows before the fix and 3 afterward. The fully shaded wall remains
`[184,178,164]` and fully lit wall remains `[223,220,212]`; occlusion was not simply
removed. This is a descriptive transect selected in the earlier diagnosis, not
a prespecified general image-quality test. `measurements.json` retains all RGB
values and full-image changed-pixel counts.

Thirty-seven frozen cottage source pins were rechecked without mismatch. The
original diagnostic reports, images and sources remain untouched.

## Validation and honest limits

- 4,678 Vitest tests pass across 666 files: 4,654 in the non-browser aggregate and
  24 CLI dev-session tests with their approved native renderer adapter.
- All 13 packages build. Source and test type checks, package boundaries,
  headless boundaries, e2e hygiene, release configuration, publish readiness,
  render-bundle fixtures, example checks, and diagnostic-catalog checks pass.
- Docs checks pass after redirecting Astro configuration to a writable temporary
  location and disabling telemetry. The initial default-config attempt is kept.
- Targeted source/test lint and all five patch-file formatting checks pass.
- The unmodified global lint command first exhausted its 2 GB default heap.
  Retrying at 6 GB reports 48 errors entirely inside two local Corepack pnpm
  cache bundles. A separate full cache-excluded lint check passes.
- Global formatting reports retained/historical benchmark evidence and recovery
  receipts, including native-generated JSON and frozen source bytes. Those are
  not rewritten to make formatting pass.
- `check:pack-cli` is unrun: it installs a temporary dependency fixture, outside
  the no-installation permit. Therefore no full `pnpm run check` pass is claimed.
- Ordinary Playwright/e2e and the standalone browser shader script were not run.
  Every actual browser launch used `runtime_pressure.py run` and
  `runVerifiedScene`; seven CLI renders used the existing verified adapter under
  the same wrapper. Native reports verify SwiftShader WebGPU with no WebGL.

## Retained failures and lifecycle

The first two `pnpm exec` commands reached the ambient wrapper's auto-install
check and failed immediately at the unwritable home-directory store path. No
formatting/tests ran in those attempts, and no manifest or lockfile changed.
Subsequent commands used existing executables and pinned Corepack pnpm 10.12.1.
No dependencies were installed.

Native attempt 02 failed when the extra compilation fixture incorrectly combined
a directional-plus-point route with a cube declaration. Attempt 08 corrected
the fixture to the actual point-array feature set and passed; no engine behavior
was changed in response. Attempt 09 is an optional map-edge probe that failed
in its newly added fixture WGSL declaration before algorithm execution. Its
failure is retained and is not counted as passing edge coverage.

The original 16-launch budget is exhausted: 9 direct fixture/cottage attempts
and 7 native CLI renders. Fourteen launches passed, two harness attempts failed.
No further native launch occurs without a bounded extension. Wrapper audits
record completed/reaped runs, including failures. At the last launch, free disk
remained above 21 GB, far above the 2 GiB stopping floor. Runtime files are
preserved; no pressure deletion, commit, push, merge or release was performed.
