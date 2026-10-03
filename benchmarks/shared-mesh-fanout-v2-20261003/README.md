# Shared-mesh fan-out V2: indirect evidence correction

CPU-prepared exploratory fixture. All seven V2 native sessions and fourteen
captures remain unrun until separately admitted. This corrects only evidence
handling for genuine indirect calls. It changes no engine source, installed
runtime, draw route, flags, buffer usage, scene, material, geometry, transforms,
worker cadence, camera, lighting, or render appearance.

## Why V2 exists

V1's actual live attempt failed before an accepted baseline: zero accepted
states, no PNG, six cold sessions unrun. Three pipe drawIndirect calls were
observed through render bundles, alongside direct slab/sentinel/post draws.
V1 discarded the indirect argument buffer and offset, then required a direct
three-instance call. Its “coalescing did not activate” error was too specific.
The retained report supports the queued standard-material route; it does not
establish the missing argument values. Batching is unverified, not a proven
engine bug. No V1 argument bytes are reconstructed or relabeled as native proof.

V1 source d0868fbae24d6cd70794d9c4914249ed634df303 and failure archive
6f3ca39472e896573c0ab0bc59d381ba3cf4f75f are preserved byte-for-byte.
The fixture subtree contains 93 files / 5,871,362 bytes. The publication also
includes a 126,317-byte archived checkpoint, for 94 files / 5,997,679 bytes total.
That archived Git blob is checked separately; today's mutable checkpoint is
neither read nor pinned. The successful topology archive
8a2e900edd794d0392b133c332a3f1ba161f8302 is independently rechecked.

## Evidence boundary

- Keep the actual drawIndirect or drawIndexedIndirect method, actual GPUBuffer
  identity and offset, owner encoder, successfully finished/submitted command
  buffer, and submission serial. Labels never substitute for object identity.
- Preserve argument upload bytes and content version at each submission,
  including cached bundles. Encoding-time intent and later uploads cannot
  replace those bytes. Deduplicate the same buffer object at the same submission.
- Decode nonindexed 16-byte and indexed 20-byte formats with little-endian u32
  fields and signed i32 baseVertex. Enforce alignment, bounds, observed written
  ranges, appropriate usage, and actual device feature for nonzero firstInstance.
- Fail closed on STORAGE, QUERY_RESOLVE, unsupported mapping usages, or unproven
  copy/clear/texture/query destinations. Mutations anywhere in one submitted
  batch conservatively invalidate the destination before all snapshots in that
  batch. An observed later CPU overwrite can reestablish only its written range.
- Require one three-instance main pipe draw after decoding, exact active
  geometry, actual packed transforms, worker/mirror/version joins, and every
  inherited shadow/cache/no-op/sentinel/reset/equality gate. Indirect calls are
  never represented as observed direct calls. These are CPU-upload observations,
  not GPU readback or a claim about arbitrary GPU-written arguments.

The unchanged plan is eight live states plus six cold sessions, fourteen 1024²
captures, eleven exact decoded-RGB/raw-geometry controls, and visible grow/shrink
edits. The 16 MiB JSON and 8 MiB PNG limits remain fail-closed.

## Preparation and parent execution

CPU_REPORT.json contains focused checks of real installed ECS/packing/conversion
algorithms and separately labeled simulated native APIs. PREPARATION_REPORT.json
contains final frozen results. Neither proves native activation. PRESERVATION.json,
derivation.json, SOURCE_TRACE.json and source-pins.json freeze inputs and unchanged
ancestors. No build or independent source-to-compiled reproduction was performed.

PARENT_NATIVE_COMMANDS.json contains seven exact commands. Each requires separate
admission, one session and attempt-001. The only native route is the adopted
runtime_pressure.py wrapper around run.mjs → scripts/verified-webgpu.mjs
runVerifiedScene. Do not loop over sessions, relax checks, retry a failed native
attempt, alter engine options, or overwrite any failure.

Native wrapper SHA-256:
89b5819db930e2bebe72818ee199de26306550327db358e7319f2d67c5aedf8a

CPU checks use cleanup.py SHA-256:
1c30bc42425c8ee112e7daf42e6a19e80c0f76949f2161590bc74c33b2f8d00d

Both use --root /workspace/scratch/0190a8c72f8a/aperture-tmp and absolute audit
directories inside this V2 folder. After all seven successful native sessions,
separately run revalidate.mjs and compare.py through cleanup.py. Missing native
evidence remains a blocker. No score, ranking, performance/memory claim, merge,
release, original-author transcript or model-identity claim follows from this work.
