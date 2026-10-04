# Indexed shared-mesh fan-out: new preparation

This is a new, CPU-tested exploratory fixture prepared on 2026-10-04. An earlier
unfrozen indexed fixture was lost in a VM replacement. None of its source,
logs, scores or results are reconstructed here. Native indexed execution is
**unrun**. This directory is ready for independent source review, not a frozen
native run or a scored benchmark.

## Scope and derivation

The retained nonindexed `shared-mesh-fanout-v2-20261003` source and its
`shared-mesh-native-audit-20261003` audit are the inputs. That historical audit
established seven native sessions, fourteen captures and eleven exact controls
using nonindexed `drawIndirect`. Those results do not establish this indexed
fixture's native behavior. Engine source remains
`d0333acdd4443ed9a4a0239d24184755b812b447`, version 0.3.0. The supplied checkout
revision is `1081ed5455bae4d9f5ead61b32de41b0c8b4bb6a`.

Only this new directory is written. No engine edits, installs, builds, Git
operations, publication, browser launches, native attempts or agent descendants
are part of preparation. Existing installed package bytes are used and pinned.

## Deliberate indexed representation

The triangle-list helper with omitted normals expands triangles to flat-shaded
corners and removes indexing. The fixture first uses that unchanged helper,
then attaches an identity Uint16 index buffer to each pipe MeshAsset. All
position, normal and UV bytes, triangle winding, bounds, transforms and material
settings remain exact. The engine consumes a genuine index buffer and indexed
submesh range. This does not deduplicate vertices or claim memory savings.

There are nine pipe entities: three instances of each inner/outer/rim mesh.
Shared controls use three pipe handles; unshared controls use nine. The slab
and crate remain nonindexed. The executor may legally leave an unused index
binding set for a nonindexed draw; only consumed fields are validated.

The expected shared main route is three actual `drawIndexedIndirect` calls into
one submit-time argument buffer version, with 20-byte slots at 0/20/40, three
instances each, firstIndex 0, signed baseVertex 0 and firstInstance 0/3/6 in
inner/outer/rims order. The CPU suite executes the installed packing, draw-list,
command planner, indirect converter and command executor against real ECS
packet ranges using explicitly simulated GPU resource objects. It is not
native activation proof.

## Evidence gates

- Exact consumed index buffer object, uint16 format, bound range, uploaded bytes,
  submission version and usage, together with unchanged vertex and matrix joins
- Signed baseVertex decoding and rejection of altered baseVertex/firstInstance;
  actual device feature evidence for nonzero indirect firstInstance
- Fail closed on missing arguments, unknown writes, STORAGE/QUERY_RESOLVE usage,
  copy/clear/query destinations, ambiguous objects and failed submissions
- Once-per-handle publication, exact worker/mirror/consumed-snapshot versions,
  current prepared-facade source versions and bounded retained geometry layouts
- No-op publication/allocation/shadow-cache checks, unchanged sentinels,
  retained-buffer reset/regrowth, persistent transforms and exact raw resets
- Current sampled shadow texture/content-version history joined to its original
  submitted draws; old draws are never reclassified as new submissions
- Unchanged 16 MiB JSON, 8 MiB PNG and 1024-square capture gates

These are CPU-upload observations at submission, not GPU argument readback.
The observer and its adversarial suites derive from retained V2. Negative tests
mutate in-memory synthetic records only; they never mutate engine source or
native evidence to make a gate pass.

## Planned native sessions, still unrun

The live sequence is baseline, baseline no-op, grow, grow no-op, shrink,
baseline reset, regrow, baseline reset. Six cold sessions cover shared and
unshared baseline/grow/shrink. After separate admission this yields fourteen
captures and eleven exact decoded-RGB/raw-geometry controls, plus visible
grow/shrink differences. `compare.py` and `revalidate.mjs` retain those gates.

`run.mjs` only uses `scripts/verified-webgpu.mjs`'s `runVerifiedScene`, under the
existing runtime-pressure lifecycle. Its required `source-pins.json` is
deliberately absent. Prepared inputs are named `prepared-NNN-inputs.json`, have
status `prepared-unfrozen`, and do not authorize native execution. Independent
review, any resulting revisions, parent publication, immutable native freeze
and separate session admission remain required. Do not rename prepared inputs
to evade those steps.

## Reproducing CPU preparation

From the repository root, choose a fresh output basename:

```sh
bash benchmarks/indexed-shared-mesh-fanout-20261004/run-cpu.sh cpu-004.log
```

Other CPU commands use the same checked helper:

```sh
printf '%s\n' '1c30bc42425c8ee112e7daf42e6a19e80c0f76949f2161590bc74c33b2f8d00d  tools/recovery/cleanup.py' | sha256sum -c -
python3 -B tools/recovery/cleanup.py \
  --root /workspace/scratch/0190a8c72f8a/aperture-tmp \
  --audit-dir "$PWD/benchmarks/indexed-shared-mesh-fanout-20261004/lifecycle-audits" \
  run --job indexed-cpu-review --recreation 'CPU-only indexed source review' -- \
  node benchmarks/indexed-shared-mesh-fanout-20261004/verify-prepared.mjs prepared-001
```

Use a new log for every invocation. Keep source and unique evidence here;
temporary files belong in the wrapper's APERTURE_TMP_RUN. No cleanup deletion
or root/lock reset is authorized. Lifecycle JSONL receipts retain terminal exit
status after the subreaper waits for every descendant. Failed attempts are kept.

`preflight.mjs` resolves and syntax-checks the actual browser module graph
without opening a server or browser. `prepare.mjs CPU_LOG MODULE_REPORT PREFIX`
writes new immutable review metadata; `verify-prepared.mjs PREFIX` verifies
exact current bytes. Prepared metadata must be regenerated under a new prefix
after any source change. The final prepared report is the authoritative list of
passing focused tests, artifact hashes, current input pins and unrun gates.

Full repository validation, independent native audit, authentic original-author
transcripts/model parity, blind artistic scoring and cross-engine comparisons
remain unrun or unavailable. No score, ranking, performance, GPU-memory, merge
or release claim follows from this preparation.
