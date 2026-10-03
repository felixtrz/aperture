# Test runner routing

The portable `pnpm test`, `pnpm run test:coverage`, and `pnpm run check`
continue to use the canonical Vitest configuration. `benchmarks/**` is excluded
from test discovery because immutable evidence contains historical `node:test`
files. Running those through Vitest produces “No test suite found” failures;
executing historical copies also confuses retained evidence with active tests.
This exclusion changes neither package coverage inputs nor thresholds.

The active recorder suite remains explicitly runnable:

```sh
pnpm run test:cloud:recorder
# Exact target:
node --test benchmarks/crane-live-edits-20261003/harness/recorder.test.mjs
```

It requires the already-adopted cleanup lifecycle in this dot cloud environment.
Its 24 assertions and historical source copies remain unchanged. The recorder
checks synthetic evidence and starts no browser.

## Complete dot-cloud validation

`scripts/test-cloud.mjs` (also listed as `test:cloud`) runs the active recorder
first and canonical Vitest second. It stops on either failure and forwards CLI
arguments only to Vitest. It does not initialize a lifecycle or grant permission
to launch browsers. The caller must already have authorization for the requested
validation and use the adopted wrapper. The entrypoint fails before launching
any tests unless the inherited lifecycle lock and active manifest match, the
native runtime is explicit, and native render output is a pre-existing absolute
directory outside disposable scratch. Existing verified-render helpers continue
to own browser selection and verification.

From the repository root, with the existing adopted root and runtime:

```sh
mkdir -p benchmarks/my-validation/native-output benchmarks/my-validation/lifecycle-audits
export APERTURE_WEBGPU_RUNTIME="$PWD/.aperture-env/render-runtime"
export APERTURE_TEST_CLOUD_RENDER_OUTPUT="$PWD/benchmarks/my-validation/native-output"
python3 -B tools/recovery/runtime_pressure.py \
  --root /workspace/scratch/0190a8c72f8a/aperture-tmp \
  --audit-dir "$PWD/benchmarks/my-validation/lifecycle-audits" \
  run --job cloud-tests \
  --recreation 'Rerun the active recorder and canonical Vitest with verified native renders' \
  -- node scripts/test-cloud.mjs
```

Invoke Node directly beneath the wrapper to preserve its inherited lock descriptor;
an intervening package-manager child may close that descriptor. Do not manufacture
lifecycle environment values or work around a failed preflight. The complete
aggregate may execute CLI native-render tests: all browser launches in this cloud
must still use `runVerifiedScene` / `pnpm run render:cloud`. Portable `pnpm test`
is not an alternative browser-launch route here.

For the CPU-only discovery/routing regression, use the adopted `cleanup.py run`
wrapper and run:

```sh
node node_modules/vitest/vitest.mjs run test/scripts/test-discovery.test.mjs
node --test benchmarks/crane-live-edits-20261003/harness/recorder.test.mjs
```

The regression enumerates files with `vitest list --filesOnly`; it never executes
the enumerated tests. Cloud aggregate orchestration uses mocked child launches in
this regression. Retain test logs and lifecycle audits outside disposable scratch.
