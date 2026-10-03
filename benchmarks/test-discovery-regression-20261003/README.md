# Test discovery regression, 2026-10-03

## Result

- Vitest default discovery excludes immutable benchmark archives. Original and
  corrected configurations list 671 and 668 files respectively, including the
  new regression. The only removed files are the active recorder and its two
  immutable historical copies. Every canonical file is still discovered.
- 17 new routing/discovery regressions pass. Active recorder: 24/24 pass.
- Targeted ESLint and Prettier pass. Coverage configuration, thresholds, generic
  `test`, `test:coverage`, and `check` are unchanged.
- The cloud aggregate runs the explicit active recorder then canonical Vitest,
  with fail-closed lifecycle and native-route preflight. It was tested with mock
  child launches only. Parent owns full canonical/native validation.
- Real CPU-only preflight succeeds when Node is invoked directly under cleanup.
  The pnpm probe closes the inherited lock FD and correctly fails before tests.
  Use direct Node under `runtime_pressure.py` for the cloud aggregate.
- No browser, full CLI test, build, engine change, or publication was performed.

## Retained failures and provenance

`focused-tests.log` retains the initial invalid relative audit-directory setup
failure. `focused-tests-retry.log` retains the first regression run: 16 passed,
1 failed because the new assertion confused `test:cloud-renderer` with
`test:cloud`. It was corrected to compare exact command tokens. The successful
focused run is `focused-tests-corrected.log`. The unchanged active recorder ran
only after the corrected focused regression succeeded.

Existing `package.json` and `vitest.config.ts` preimages in `original/` are direct
byte snapshots. `final/` contains exact frozen submitted source. The initial
failing new test is reconstructed from the exact one-line correction; it has no
retained pre-correction hash and is not claimed independently byte-verified.
`source.patch` includes all five changed/new source files. No existing benchmark
archive was edited; all preexisting harness hashes were rechecked unchanged.

Lifecycle audit completion and copied completed manifests establish descendant
quiescence for every started CPU lifecycle, including expected failures. No
cleanup deletion was performed. Disposable fixtures used the adopted
`aperture-tmp` root; unique source, logs, and evidence are retained here.
