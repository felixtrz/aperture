# Native shadow regression validation

Published source d0333acdd4443ed9a4a0239d24184755b812b447 passed an immutable 29-state native WebGPU rerun. All 13253 native checks and 1,885 independent geometry comparisons passed, maximum position error zero. Baseline, widened arch and all 14 reset images match their controls pixel-for-pixel. The prior arch difference of 5,186 pixels is zero.

Canonical Vitest with benchmarks/** excluded passed 4,699 tests in 667 files. All seven CLI captures used the existing approved runVerifiedScene opt-in under the adopted runtime wrapper. Active recorder tests ran separately with Node: 24 passed. Historical failed runs and immutable Node archives are preserved. The unmodified default test-discovery configuration is still an open maintenance issue.

All three lifecycle wrappers completed with exit 0 after descendant waits. Settings, native proofs, retained CLI input bundles and images are included. This is exploratory engineering validation; missing full author transcripts and exact equal model settings prevent a formal score. No performance or GPU-memory claim.
