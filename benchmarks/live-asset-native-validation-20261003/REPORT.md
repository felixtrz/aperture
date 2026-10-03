# Patched live asset validation, 2026-10-03

Source commit6610e1e7898540240ca7b285572b85e6ed77c6da; two narrow compatible fixes, no version bump or release. This separately labeled engine regression retains the frozen post-author raw-byte adapter and shared29-state harness. Earlier author and diagnostic failures remain unchanged.

All29 native states and13,253 native geometry/upload/frame checks passed. Independent comparison to retained static native geometry passed1,885 mesh comparisons with measured position error0. Every14 reset PNG is byte-pixel equivalent to baseline. One native SwiftShader device/worker/canvas, zero WebGL/GPU errors. Stable entities/mesh handles and real asset replacements are separately counted; GPU upload observations are not readback or memory-residency measurements.

## Remaining shadow defect

The widened-arch live image differs from its retained static control in5,186 pixels (bounds629,421–928,639, maximum channel difference49), despite matching native geometry. The frame report reuses the directional shadow cache via the change-set fast path while shadow-caster draws report0changed/65unchanged. This is a concrete native stale-shadow finding requiring isolated regression and compatible invalidation fix before claiming complete live-edit correctness. Baseline/control and reset images match exactly.

## Full-suite limitation and route correction

The attempted bare canonical Vitest command completed with4failed files/666passed;3failed tests/4,679passed. Three archived recorder.test.mjs files use Node's test runner and cannot be collected as Vitest suites. Three existing CLI tests attempted their normal Chrome route because the approved cloud test opt-in was not set; Chrome was absent, so they failed before browser launch. No install or retry of that route occurred. The existing test/helpers/verified-render-session.ts supports APERTURE_TEST_CLOUD_RENDER_OUTPUT and APERTURE_WEBGPU_RUNTIME, routing through runVerifiedScene. A future authorized rerun must use that helper within runtime_pressure and run active Node harness tests with their proper runner, without treating historical evidence as current Vitest tests. Do not call this full suite green.

The native attempt itself used only runtime_pressure and runVerifiedScene, completed exit0 after descendants, and retained58state artifacts. Free space afterward11,108,904,960bytes. Full formal benchmark gates (model/settings equality and complete authentic author transcripts) remain unavailable; exploratory, no scores or engine ranking.
