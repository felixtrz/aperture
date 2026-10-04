# Independent indexed shared-mesh source review

## Decision

**PASS for source readiness of the bounded exploratory native experiment.**
No source defect or mistaken expectation requiring correction was established.
The prepared fixture can proceed to the parent's immutable freeze and separately
authorized native session admission. This review is not a native pass, freeze,
or operational authorization. There are still zero indexed native sessions and
zero indexed captures.

The reviewed fixture is `benchmarks/indexed-shared-mesh-fanout-20261004`.
Its prepared report SHA-256 is
`834eec6264957cdd7335a5cbb6c80a5890658e4ddce310acc6bddebeff6e195c`;
its prepared input inventory SHA-256 is
`fef6b28b570cb35ac93c154b8c652d61a6e7090458207c656fe992d38d800099`.
This is the new run described in that report. No lost indexed fixture, logs,
results, transcript, or visual score were reconstructed.

## Blocking findings

None established by this source review. No tests were weakened, and no fixture
or engine file was changed.

Native execution still requires all pre-existing gates. In particular, actual
device support for nonzero indirect firstInstance, real index/argument object
joins, resource versions, record-size limits, shadow reuse, and RGB controls
must pass on real submissions. A failed native attempt must be retained and
diagnosed; these CPU results cannot override it.

## Verified findings

### Geometry and indexed command path

- The fixture uses the original omitted-normal triangle-list helper and adds
  identity Uint16 indices to its exact corner streams. CPU equality checks cover
  position/normal/UV stream metadata and bytes, local AABB and sphere, all three
  topology levels, and all nine pipe instances. The legacy geometric source is
  unchanged. This is genuine indexing, with no vertex deduplication claim.
- Analytic ring samples, radii, finite triangle areas, welded cardinalities,
  balanced two-use manifold edges, Euler characteristic zero, six open-bore rays,
  identity index bytes, uint16 format, and active submesh ranges remain gated.
- The installed ECS extraction, asset mirror, transform packing, draw-list
  planner, command planner, indirect converter, and executor pass the fixture's
  focused tests. GPU API objects in these tests are simulations.
- The actual compiled planner/converter/executor yields three shared indexed
  indirect commands in inner/outer/rims order. Their 20-byte slots are 0/20/40,
  instance counts are 3/3/3, firstIndex is 0, signed baseVertex is 0, and
  firstInstance is 0/3/6. Index counts are 864/864/144 at baseline,
  2304/2304/192 at grow, and 288/288/96 at shrink.
- The single-instance nonindexed slab and crate do not enter the converter's
  default two-instance candidate set. A previously bound index buffer is unused
  by their nonindexed draws; allowing that retained binding is correct.

### Submission and fail-closed gates

- `fanout-checks.mjs` requires the exact consumed index-buffer object joined by
  object ID, uint16 format, expected label, bound allocation/range, observed
  submission serial and positive content version, complete initialized bytes,
  and INDEX with only COPY_DST/optional COPY_SRC usage. It compares every active
  index byte with the actual published/mirrored MeshAsset data.
- `indirect-evidence.mjs` decodes baseVertex with `getInt32`, decodes the indexed
  firstInstance from byte 16, and rejects fabricated direct-call fields. It
  requires a successful command/encoder/submission join, unique exact argument
  buffer, initialized argument range, preserved bytes, allowed usage, and actual
  observed device feature support for nonzero firstInstance.
- The three shared slots must belong to one argument buffer and one
  submission/content-version pair. Adversarial tests reject wrong counts,
  firstIndex, positive/negative baseVertex, firstInstance, same-label object
  substitutions, stale submissions, missing instance coverage, wrong transform
  bindings, changed index bytes/format/range, STORAGE/QUERY_RESOLVE usage, and
  unproven GPU writes.
- Observer suites cover bundles and pass calls, writes after encoding but before
  submission, later rewrites, failed submission, copy/clear/texture/query buffer
  destinations, and shadow texture invalidation. Old depth draws keep their
  original command and submission identities. Current color draws must sample
  the matching surviving shadow-content revision.
- These are CPU-upload observations captured at queue submission, not GPU
  readback and not a general proof system for arbitrary unobserved GPU programs.

### Cache, no-op, reset and publication expectations

The original suite's renderer-resource checks are explicitly synthetic. To
independently verify their expectations, `independent-check.mjs` additionally
executes the real installed `prepareMeshGpuResource` algorithm with real fixture
assets and simulated byte-storing GPU buffers, across all 14 states.

- All consumed simulated buffer bytes, labels, index formats/counts, source
  versions, vertex usage 40 and index usage 24 match.
- Live cache entry counts are 5,5,8,8,11,11,11,11. Corresponding buffer creations
  are 8,0,6,0,6,0,0,0. Both no-op states perform zero mesh-buffer writes as well
  as zero allocations.
- Resets/regrowth reuse the exact earlier vertex and index objects for the same
  handle/topology, while uploading the new source version. They perform six
  writes and zero new mesh-buffer allocations per transition. Zero allocation
  is not incorrectly equated with zero upload.
- Each cold shared session has five cache entries and eight simulated buffers;
  each cold unshared session has eleven entries and twenty simulated buffers.
- Real ECS/mirror checks pass the persistent entity/handle/transform and
  once-per-handle rules. Live pipe asset versions are 1,1,2,2,3,4,5,6, with
  cumulative publications 0,0,3,3,6,9,12,15. Raw resets are exact.
- Actual native no-op shadow-cache behavior and native resource reports remain
  unrun. Their strict requirements have not been replaced by this probe.

### Pins, module graph and capture controls

- All 6,448 prepared pins and seven prepared artifacts revalidate. Fresh input
  discovery reproduces the entire inventory exactly. Every current package
  source file is included among the 1,159 source files verified against retained
  `d0333acdd4443ed9a4a0239d24184755b812b447` provenance.
- The independent script replays and syntax-checks all 950 served module routes,
  checks input and transformed-response hashes, independently extracts static
  and literal dynamic imports with the TypeScript AST, and verifies every edge
  is in the pinned graph. There are no unproven nonliteral imports. The sole
  excluded audio import is still proved disabled by actual configuration and
  the guarding code. All seven session-contract substitutions are checked.
- Seven sessions contain fourteen planned states: eight live states and six
  cold shared/unshared states. `compare.py` requires exactly eleven decoded-RGB
  and raw-geometry equality controls, plus nonzero grow/shrink pixel differences.
  These are planned gates, with no images or comparisons produced by this review.
- The 16 MiB JSON, 8 MiB PNG and 1024-square gates remain unchanged. Synthetic
  size estimates do not waive real recorder limits.
- `run.mjs` accepts only the reviewed-frozen status and requires the separate
  absent `source-pins.json`. Prepared inputs do not satisfy this condition. Its
  browser path is exclusively `runVerifiedScene`; this review never invokes it.

## Publication/confidentiality review

All **97 fixture files / 3,354,387 bytes** were inventoried and hashed. Review
of source, test output, inspection logs, JSON metadata and lifecycle receipts,
plus a targeted scan across every file, found no credentials, authentication
tokens, private reasoning, internal tool schemas, or live authority/capability
material. No file is recommended for exclusion from the proposed publication.
Local paths, nonsecret run identifiers, hashes and terminal lifecycle metadata
are present as expected. The complete exact inventory is in
`independent-002.json`. This is a bounded content review, not a mathematical
guarantee that arbitrary secret formats cannot exist.

## Evidence and reproducibility

- `cpu-001.log`: independent rerun, 80 tests / 80 passed / 0 failed.
- `independent-001.json`: first passing pin/module/cache/publication probe.
- `independent-002.json`: final passing probe, additionally independently
  extracting every import edge rather than only replaying the retained list.
- `independent-check.mjs`: final probe source. It writes only a new, exclusive
  output basename in this review directory; GPU resources are clearly labeled
  CPU simulations. It opens no server, browser, or network connection.
- `lifecycle-audits/`: terminal zero-exit records for all review CPU commands.
- `review-001.json`: final artifact hashes, exact fixture inventory digest,
  and terminal lifecycle references.

Run from the repository root with a new log and report basename:

```sh
printf '%s\n' '1c30bc42425c8ee112e7daf42e6a19e80c0f76949f2161590bc74c33b2f8d00d  tools/recovery/cleanup.py' | sha256sum -c -
python3 -B tools/recovery/cleanup.py \
  --root /workspace/scratch/0190a8c72f8a/aperture-tmp \
  --audit-dir "$PWD/benchmarks/indexed-source-review-20261004/lifecycle-audits" \
  run --job indexed-source-review-replay --recreation 'CPU-only independent source review' -- \
  node benchmarks/indexed-source-review-20261004/independent-check.mjs independent-003.json
```

For the focused suite, substitute `node --test --test-reporter=spec` followed by
the fixture's `cpu.test.mjs`, `indirect.test.mjs` and `observer.test.mjs` paths.
Keep each invocation's output in a new log. No cleanup deletion is part of this
review. Completed scratch manifests and unique evidence are retained.

## Explicitly unrun or unclaimed

- Indexed native activation, seven native sessions, fourteen captures, eleven
  RGB controls, and independent native evidence/image audit.
- Independent rebuilding from engine source to installed distribution files.
  Current compiled bytes are pinned and tested; source-to-dist reproduction is
  not established. This inherited limitation is accurately documented.
- Full repository validation, physical-GPU portability, performance measurements,
  GPU-memory measurements, formal author identity/authentic original transcripts,
  exact model/settings parity, blind artistic scoring and cross-engine ranking.
- Remote publication/ref verification by this reviewer. The local checkout is
  `1081ed5455bae4d9f5ead61b32de41b0c8b4bb6a`; the parent's cited publication object
  is not available in this checkout. No Git fetch, commit or publication ran.

Only this separate review directory and lifecycle-managed scratch metadata were
written. The fixture, engine, installed dependencies and retained evidence were
unchanged. No native launch, install, descendant agent, deletion, merge or release
was performed.
