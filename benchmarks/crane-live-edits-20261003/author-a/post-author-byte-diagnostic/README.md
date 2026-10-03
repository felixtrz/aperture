# Post-author native raw-byte diagnostic

This is a separate instrumentation repair derived from frozen author-a/v2.
It is outside the paired author result and is not a new author revision. Frozen
v1, v2 and their failed native attempts remain unchanged. No native browser
attempt, visual result, paired success, score or performance claim is made here.

## Cause and bounded repair

The v2 GPU-upload gate reconstructed native Float32Array bytes from numeric JSON.
JSON erases the sign of negative zero. The retained parent audit of native
attempt-002 identifies 444 sign-byte differences and zero numeric differences.
This diagnostic's actual CPU baseline native arrays independently contain 444
negative-zero values. The historical failure remains a failure; its missing
pre-JSON raw evidence is not reconstructed or replaced.

Only two runtime files differ from v2:

- native-evidence.mjs captures a Uint8 byte copy directly from each genuine native
  vertex/index typed-array view before JSON conversion, retaining its type,
  byte offset, element length, byte length and backing-buffer length. Numeric
  arrays remain separately available. POSITION decoding reads the captured bytes.
- gpu-observer.mjs compares those preserved bytes exactly with the existing
  successful native queue.writeBuffer observations. Missing or malformed raw
  evidence fails closed. Any changed byte, including a zero sign bit, fails.
  GPU allocation padding is outside the native array view and is not compared
  as geometry. There is no numeric-only fallback or synthetic index generation.

The observer's native API forwarding, queue observation, buffer binding and
resource counters are otherwise unchanged. The exact worker-revision/rendered-
frame join is unchanged. scene.mjs, scene-system.mjs, worker.mjs, main.mjs,
frame-proof.mjs and index.html are byte-identical to v2. No engine, shared
harness, shader, geometry, transform, material, lighting, camera or runtime change
was made.

## CPU verification

The adopted cleanup.py SHA-256 was verified before every test invocation:
1c30bc42425c8ee112e7daf42e6a19e80c0f76949f2161590bc74c33b2f8d00d.
All executed tests ran inside its descendant-waiting lifecycle. No browser,
server, network action, dependency install or publication was performed.

- 13 raw-byte tests pass, including signed zero after repeated JSON; legacy
  reconstruction rejection; one-bit corruption on either side; absent raw
  evidence; sparse/invalid payloads; offsets, sizes and interleaved attributes;
  actual Uint16/Uint32 indices; nonindexed meshes retaining empty indices; and
  synthetic observer tests for native argument forwarding, typed-element and
  ArrayBuffer/DataView byte offsets, destination offsets, padding, missing
  bindings, destroyed buffers and corruption. GPU mocks are explicitly CPU-only.
- The actual native CPU application passes all 29 frozen states: 1,914 genuine
  native arrays, 6,400,416 bytes compared exactly after JSON, 261 original checks
  per state, stable 65 mesh identities and 70 entities, and exact raw/numeric
  baseline resets. Every app is disposed. These are CPU asset checks, not GPU
  upload proof.
- The unchanged real generated-worker MessagePort transfer and fixed-clock shared
  transport checks pass all 29 states. MessagePorts and apps are closed.
- The unchanged synthetic-device native frame-report check passes, retaining its
  negative checks for missing publication, wrong revision and wrong frame. It
  does not establish a real GPU render.
- Static syntax checks pass for every module. cpu-final-validation-001.log reruns
  all checks above against the final runtime source bytes after the sparse-byte
  validation hardening. No source edits followed that final test run.

cpu-byte-unit-001.log retains a wrapper-configuration failure: a relative audit
path was rejected before any test ran. The corrected absolute-path invocation
is retained separately, as are every subsequent log and lifecycle audit. All
six admitted lifecycle runs ended run-completed with exitcode 0; no child/test
process or background service remains active.

input-pins.before.json and input-pins.after.json verify all 1,217 original input
files unchanged, including frozen v1/v2, own native attempt-002, shared harness
modules, cleanup source and built engine modules. final-manifest.json records
final source/evidence hashes and the remaining native-verification gate. The
manifest excludes its own digest; its exact digest is returned to the parent.

## Next gate

A separately authorized post-author native diagnostic attempt must exercise
these exact source bytes through the adopted wrapper and runVerifiedScene.
Only that future observation can establish whether the real native upload gate
and all 29 render/capture states pass. It cannot retroactively repair the frozen
paired author outcome.
