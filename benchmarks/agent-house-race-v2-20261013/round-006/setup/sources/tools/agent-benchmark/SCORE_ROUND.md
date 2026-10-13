# Final round scoring

This offline scorer consumes exact validated `summarize.mjs` output. It does not
launch a browser, replace source review, fix inputs, choose faster trials or
substitute scores for a failed scene. Freeze the scoring modules and their
validation dependencies, including `execution-evidence.mjs`, in the dispatch
input manifest before author/judge work. The scorer checks those source bytes
against the freeze.

```sh
node tools/agent-benchmark/score-round.mjs \
  --inputs /absolute/scoring-inputs.json \
  --inputs-sha256 EXACT_REVIEWED_INPUT_MANIFEST_SHA256 \
  --output /absolute/new-final-score.json
```

Outputs are create-only. A withheld result retains reasons, all original judge
numbers and disagreement, and the complete raw summary including every trial and
timing sample. Formal component/combined scores remain null for either engine
when the pair is incomplete, invalid, ineligible or awaiting source audit.

## Original official supervision

App metrics and native captures alone are unscored. To compute formal runtime
and author-time components, supply the retained official execution start and its
reviewed byte hash:

```sh
node tools/agent-benchmark/summarize.mjs \
  --round /absolute/race/round-006 \
  --output /absolute/new-summary.json \
  --official-execution /absolute/race/round-006/official-operations/execution-start.json \
  --official-execution-sha256 EXACT_EXECUTION_START_SHA256
```

The driver records that start before launching any trial. It pins retained
launch-plan, root-authorization and driver copies, frozen control sources, the
selected six operations and both audited apps. Each selected operation must
have its original successful wrapper record, a unique genuine `run-start` and
`run-completed` audit, and an original completed lifecycle manifest written after
child exit and descendant reaping. Exact commands, run IDs, jobs, app inputs,
trial output hashes and frozen order must join. Nanosecond integers retain their
exact precision. Capacity-managed runs also require the original completed
checkpoint and any exact cache-only retirement bridge; retirement cannot turn an
active or failed run into a successful completion.

Without these flags, a valid app-only summary reports
`app-artifacts-validated-unscored` and leaves `scores: null`. Invalid supplied
supervision reports `incomplete-or-invalid-evidence`, returns failure and still
retains raw app samples, timing statistics and authentic author records. An app
may have passed before its supervisor was interrupted; that preserves useful
metrics but cannot qualify the pair. Resolved-interruption sidecars permit
operational reconciliation only and are never scoring proof. Historical frozen
outputs remain unchanged.

The file scorer independently re-reads and hash-verifies this entire original
execution graph. A passing status copied into summary JSON cannot replace the
original records. The execution-completed driver record is written after the
summary, so it is intentionally not a prerequisite that would create a cycle.

## Input manifest

Each pin contains `{ "path": "/absolute/file", "sha256": "64 lowercase hex",
"bytes": 123 }`. Paths must resolve to bounded regular files without symlinks.
The caller supplies the reviewed manifest's exact outer hash as well.

```json
{
  "schema": "aperture.house-race-score-inputs.v1",
  "roundId": "round-002",
  "roundOrdinal": 2,
  "pins": {
    "summary": {
      "path": "/race/round-002/summary.json",
      "sha256": "...",
      "bytes": 123
    },
    "method": { "path": "/race/method.json", "sha256": "...", "bytes": 123 },
    "reference": {
      "path": "/race/reference.png",
      "sha256": "...",
      "bytes": 123
    },
    "dispatchFreeze": {
      "path": "/race/freezes/round-002-inputs.json",
      "sha256": "...",
      "bytes": 123
    },
    "judges": [
      {
        "path": "/race/round-002/judges/original-a.json",
        "sha256": "...",
        "bytes": 123
      },
      {
        "path": "/race/round-002/judges/original-b.json",
        "sha256": "...",
        "bytes": 123
      }
    ],
    "caseMap": {
      "path": "/race/round-002/private-case-map.json",
      "sha256": "...",
      "bytes": 123
    },
    "sourceAudit": {
      "path": "/race/round-002/source-feature-review.json",
      "sha256": "...",
      "bytes": 123
    },
    "previous": {
      "path": "/race/round-001/final-score.json",
      "sha256": "...",
      "bytes": 123
    }
  }
}
```

`previous` is optional for the first scored pair. Later it must identify the
immediately preceding round; the scorer never skips an invalid pair to find two
wins. Its exact hash joins the explicit quality-regression review.

The original judge JSON format remains unchanged: unique `judgeId`, exactly two
opaque `case` records, `visualDimensions`, `visualScore`, `geometryDimensions`,
`geometryScore`, and `missingRequiredFeatures`. The five visual keys are `house`,
`car`, `composition`, `materialsLighting`, `alternateViews`, each in 0..2.
Geometry uses `proportions` 0..4, `volume` 0..3, `normalsTopology` 0..2,
`efficiency` 0..1. Every score must be finite in 0..10 and equal its dimension
sum. Neither judge's preferences, problems nor uncertainty are edited or averaged
away. Dimension and total disagreement remain visible.

## Opaque case map and image joins

The mapping schema is `aperture.house-race-case-map.v1`. It pins `roundId`,
`summarySha256`, `methodSha256`, `referenceSha256`, and `dispatchFreezeSha256`.
Its two `cases` each contain `case`, `engine`, `captureTrial` and `views`.
Both engines must use preselected `captureTrial: 1` (trial-01). This selection is
fixed before author/judge runs and cannot choose a more flattering trial. Each of the three views is
`{ "id": "canonical", "pin": { ...exact blinded image file pin... } }`, in
canonical/left-orbit/rear-orbit order. Actual bytes must match that trial's exact
validated capture receipt and frozen camera. Keep the engine mapping private from
judges; give both judges identical fresh reference, views and geometry facts.

## Manual source and feature audit

Prepare a pending template from pinned inputs with the same command and
`--mode template`; the `sourceAudit` pin is unnecessary in this mode. The template
copies exact joins and defaults semantic checks to null, source files to
`reviewed: false`, and features to `uncertain`. It never approves a source audit
from draw counts, worker presence or native position matches. Review into a new
file, then pin that reviewed file in a new scoring input manifest.

The schema is `aperture.house-race-source-feature-audit.v1`. A completed audit
requires `status: "reviewed"`, an independent reviewer identity/time/reasons,
all exact template hash joins, and explicit per-engine findings. Review all
authored `src/`, HTML, package/lock and Vite configuration bytes and relevant
pinned SDK/dependency source files. The template joins each trial's outcome,
input, receipt, measurement, native renderer and geometry hashes. Actual source,
capture and joined trial-manifest bytes are checked again during scoring.

Required source findings are independent semantic review, geometry matching the
rendered scene, reviewed position/index/normal/world-transform semantics,
supported submitted geometry, coherent three views, no image billboard, no
runtime/harness tampering, and reviewed SDK matching actual built dependencies.
Aperture additionally requires normal simulation worker use, authoritative ECS,
worker ECS extraction, renderer consumption of those normal snapshots, and no
dummy worker. An observed snapshot protocol alone establishes none of these
semantic findings. Every finding needs independent review and concrete reasons.

All required feature categories must be `present`: house, roof, chimney,
windows, porch, path, boundary, garden, mailbox, curvedRoad, curbs, markings,
blueCar and fourWheels. A missing/uncertain source feature or either judge's
`missingRequiredFeatures` prevents pair scoring. Both visual and geometry judge
means must independently meet the frozen >=6 floor for both engines.

The protocol review records distinct real author identities, fresh isolation,
no inherited author context or peer contact, the same frozen reference/rubric,
the same preview/budget policy, no mid-round control changes and no author edits
during trials. Protocol incidents keep a round exploratory; a retained
`protocol-incident.json` cannot be ignored. Each original judge record has a
separate receipt recording fresh independence, hidden engine/timing/transcript/
mapping, the frozen rubric, the exact reference hash, and all six viewed image
hashes. The root coordinator can attest these delivery/isolation facts using the
authentic invocation and transcript records; judges never receive the private
mapping or timings.

## Formula and stable-lead limits

Runtime and author-time components are independently recomputed from all three
validated trials and authentic active author time using the exact frozen
`method.json` formulas. Final weights must remain visual .4, geometry .2,
runtime .25, authoringTime .15. No new numeric quality-regression threshold is
invented: the frozen method supplies none.

A stable benchmark lead requires two successive fresh eligible pairs, the same
method/reference/control/scorer hashes, four distinct fresh authors and judges,
both Aperture combined margins >=.25, explicit material-quality-regression
review for both engines joined to the exact previous score, and reviewed runtime
spread interpretation. Record quality differences, all trial medians/p95 and
their ranges. Review notes must explain uncertainty when timing ranges overlap;
the scorer performs no significance test. One pair remains exploratory. The
result can establish a lead in this frozen house-scene benchmark, never universal
engine superiority or a forced outcome.

`runtimeInterpretation` contains reviewed status, the exact `summarySha256`,
independent reviewer identity, `independentOfAuthors: true`, and reasons.
`qualityRegressionReview` contains reviewed status, `previousScoreSha256`,
reviewer identity, `independentOfAuthors: true`, reasons, and explicit
`noMaterialQualityRegression: { "three": true, "aperture": true }`. Pending,
negative or unjoined review keeps the stable-lead claim false.
