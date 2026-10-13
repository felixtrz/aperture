# Fairness v2: a fixed shared workload envelope

This is a new independent-authoring benchmark version. The five historical
rounds and their v1 method stay immutable. Freeze and SHA-256 pin the complete
`FAIRNESS_V2` object from [fairness-v2.mjs](fairness-v2.mjs), method, prompt,
starter recipes, SDK/source inventories, reference-generation policy, recorder and observer before
either author starts. Both authors receive exactly the same contract bytes and
resource limits. Each future round receives a **different newly generated low-poly
reference** selected before author dispatch and results; both engines within that
round receive the same original retained PNG. Use simple matte forms that ordinary
Three.js primitives, indexed geometry and opaque standard materials can recreate
closely. Freeze each round's image, task brief and generation provenance
separately; keep the method, task family, policy and fairness contract identical
across qualifying pairs. Any later change requires a new version and fresh author pair;
never adjust limits after seeing results.

The envelope controls major rendering features and scene scope. It leaves
indexing, geometry reuse, instancing, batching and static shadow caching available
to both authors. Independently authored scenes still differ in pixel coverage,
overdraw, materials and tessellation, so pair this test with a separately frozen
controlled workload using identical typed arrays, textures, camera and lighting.
Do not interpret a winning authoring scene as an isolated renderer-speed result.

## Baseline recipe

Both starters must implement and disclose these settings using public engine
facilities; the declaration's settings must equal the frozen object exactly.

| Setting             | Shared value                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| Display             | One 1024 × 768 display canvas, DPR 1                                                                 |
| Color               | ACES, exposure 1, sRGB output                                                                        |
| MSAA                | 4 samples                                                                                            |
| Optional effects    | SSAO, bloom, fog, custom shaders and extra post effects disabled                                     |
| Material model      | Standard metallic-roughness; opaque or alpha-mask                                                    |
| Material extensions | No transmission, clearcoat, sheen or other physical extensions                                       |
| Material maps       | Base color, normal, metallic-roughness and emissive; rgba8 only                                      |
| Emissive intensity  | 0–1                                                                                                  |
| Sun                 | Direction **toward** light `[-11, 16, 12]` normalized; linear RGB `[1, 0.7454, 0.4342]`; intensity 3 |
| Fill                | Exactly one constant ambient light; linear RGB `[0.6902, 0.749, 0.7843]`; intensity 0.55             |
| Background          | Solid sRGB `#b9cee2`                                                                                 |
| Environment         | Default environment, IBL, hemisphere lights and environment textures disabled                        |
| Shadows             | Exactly one 2048² map, one cascade, PCF public radius 1 texel, strength 1                            |
| Shadow camera       | Fixed 38-unit orthographic coverage, center `[0, 2.5, 0]`, light distance 30, near 0.5, far 60       |
| Shadow bias         | Normal bias 0.04, depth-bias magnitude 0.0004; adapt and disclose native sign convention             |
| Shadow updates      | Render initially; reuse until the sun or any caster changes                                          |

Preserve the existing canonical, left and rear cameras, 60 warmup frames, 120
measured frames, serial queue fences and three fresh trials per engine. No
engine gets additional visual effects, hidden default lights, a different
background, or a per-frame shadow redraw forced only to mimic another engine's
implementation. The coordinator audits both built dependency implementations.

PCF kernels may use different taps and bias conventions in the two engines.
Record the actual filter implementation and audit common visible quality;
identical public parameters do **not** establish byte-identical shadows.
Similarly, ACES/MSAA/output requirements do not force identical intermediate
targets, render passes or engine-internal resource layouts. Report those costs.

## Resource and scene limits

These initial limits are declared before results. A coordinator may choose a
different envelope **before** the freeze, with the same limits for both engines.

| Resource                                                |                   Maximum |
| ------------------------------------------------------- | ------------------------: |
| Placed triangles                                        |                   300,000 |
| Stored authored geometry attribute + index bytes        |                    24 MiB |
| Instance attribute bytes                                |                     4 MiB |
| Materials                                               |                        64 |
| Authored material textures                              |                        16 |
| Texture dimension                                       |             1024 per axis |
| Expanded texture storage, including layers and all mips |                    16 MiB |
| Directional / ambient / other lights                    | Exactly 1 / exactly 1 / 0 |
| Trees / shrubs / extra decorative objects               |              6 / 48 / 256 |

Require one house and one blue car with four wheels, plus the existing roof,
chimney, windows, porch, path, boundary, garden, mailbox, curved road, curbs and
markings. All authored geometry, including ground and details, stays inside
`x,z ∈ [-18,18]`. No distant landscape, extra buildings, extra vehicles, scene
billboards or baked scene pictures. Authors may choose detail distribution
within these limits; blind judges still evaluate geometry and visual quality.

Count every triangle-list geometry placement, including instances, whether
currently occluded or outside one camera. One shared 12-triangle box placed 50
times costs **600 placed triangles**, with its vertex/index storage counted
once. Fifty independently stored identical boxes count fifty storage copies.
Splitting or merging geometry must preserve these accounting semantics.

Stored authored geometry bytes count actual attribute component widths for
**all** vertex attributes, including POSITION, NORMAL, UV, tangent, color and
any other authored stream, plus actual index widths. This is full logical tuple
storage, excluding engine buffer padding and allocator overhead; it is not the
size of exported JSON/Float64 arrays. Instance matrix/color/other attribute
streams count separately with actual component widths and placement count.
Ordinary object transforms are not an instanced stream. Source review must
confirm the inventory matches actual streams and no hidden attributes exist.

Textures count every distinct authored rgba8 source, all array/cube layers and
all allocated mip levels. For a 4 × 2 texture with three mips, charge
`4 × (4×2 + 2×1 + 1×1) = 44 bytes`; compression does not reduce this limit.
Engine-created render targets, shadow maps and internal caches are not authored
textures. Retain their native resource counts/descriptor bytes separately;
native requested allocation bytes are not resident GPU memory.

## Declaration and evidence interface

Use `fairnessDeclarationTemplateV2(engine, contractSha256)` to create an
incomplete author declaration. Authors must fill actual inventories before
finish. A geometry entry has this shape:

```json
{
  "id": "shared-box",
  "vertexCount": 24,
  "placements": 50,
  "attributes": [
    { "semantic": "POSITION", "components": 3, "componentBytes": 4 },
    { "semantic": "NORMAL", "components": 3, "componentBytes": 4 },
    { "semantic": "TEXCOORD_0", "components": 2, "componentBytes": 4 }
  ],
  "indices": { "count": 36, "componentBytes": 2 },
  "instanceAttributes": [
    { "semantic": "INSTANCE_MATRIX", "components": 16, "componentBytes": 4 }
  ]
}
```

Use explicit `indices: null` for nonindexed triangle lists and
`instanceAttributes: []` for ordinary transforms. Geometry IDs represent actual
distinct stored geometry, not arbitrary duplicate mesh entries. Attribute
semantics must be unique per geometry. Texture entries declare
`{id,width,height,layers,mipLevels,bytesPerTexel:4}`. Materials declare
`{id,model:"metallic-roughness",alphaMode,extensions:[],emissiveIntensity,maps}`,
where `maps` maps allowed slots to inventoried texture IDs. Lights declare
`{id,kind:"directional"|"ambient"}`. The source audit verifies their actual
settings against the frozen recipe; counts alone cannot establish lighting.

```js
validateFairnessV2({
  contract: FAIRNESS_V2,
  contractSha256,
  engine: "aperture", // or "three"
  declaration, // coordinator-verified pinned file record
  sourceAudit, // independently reviewed, coordinator-verified record
  observation, // independent native harness, coordinator-verified record
});
```

Each record uses the existing coordinator pin-reader convention:
`{pin:{path,sha256,bytes},actualSha256,actualBytes,hashParity:true,error:null,value}`.
Exact bytes are mandatory here. The pure validator performs no file I/O or
cryptographic verification: the caller **must** use the trusted pin reader,
verify the contract hash, author/independent reviewer roles and authentic native
provenance before passing records. Never accept author-supplied `hashParity`,
reviewer identities, review flags or native observation records as proof.

The author declaration uses `DECLARATION_SCHEMA_V2` and includes `engine`,
`contractSha256`, `authorId`, `settings`, `inventory`, `scene` and
`requiredFeatures` booleans. Scene includes the exact fixed semantic counts,
actual plant/decoration counts and actual x/z bounds.

The independent source audit uses `SOURCE_AUDIT_SCHEMA_V2` and includes a
distinct `reviewerId`, exact `sourceSha256`, `buildSha256` and
`declarationSha256`, independently reconstructed `settings`, `inventory`,
`scene`, `requiredFeatures`, `shadowImplementation:{filterDescription,
depthBiasConvention}` and checks for every `FAIRNESS_SOURCE_CHECKS_V2` item.
Each check requires `{passed:true,reason,evidence:[{path,sha256}]}` with retained
source evidence. The coordinator checks these references against the frozen
source/build inventories. Review must inspect actual source and dependencies,
not copy declaration values or infer materials from screenshots/native draws.

The per-trial native observation uses `OBSERVATION_SCHEMA_V2` with `engine`,
`contractSha256`, matching `sourceSha256`/`buildSha256`,
`provenance:"independent-native-harness"`, `nativeWebGpu:true`,
`webGlAttempts:0`, `displayCanvasCount:1`, and `viewport` equal to the fixed
width/height/DPR object. It includes:

```js
capture: {
  warmupFrames: 60, measuredFrames: 120, complete: true,
  views: ["canonical", "left-orbit", "rear-orbit"],
},
geometry: {
  complete: true,
  semanticGeometrySha256,
  meshCount,
  nativePositionMatchedMeshes: meshCount,
  unknownTriangleDrawCalls: 0,
  placedTriangles, // from retained numeric geometry, not all-pass draw totals
  bounds: { min: [x, y, z], max: [x, y, z] },
},
```

Construct these fields only after the existing retained artifact validators
pass. Include all direct/indirect/topology unknowns in
`unknownTriangleDrawCalls`. Missing, incomplete or unmatched native geometry
stays ineligible. Submitted triangles over all shadow/main/fullscreen passes
are a separate runtime metric; they are not a substitute for placed triangles.

The returned disposition explicitly separates checked author claims, source
review and native observations. Native position parity verifies position
uploads; it cannot prove complete scene coverage, materials, UV bytes, light
recipes or semantic object identity. Independent source audit supplies those
checks. No author declaration alone is eligible.

## Scoring integration

Run this gate for each of the six retained successful trials, joined to the
same source audit, declaration, frozen contract and final build. Preserve the
existing three-trial requirement, official execution checks, Aperture normal
worker/ECS checks, independent blind judges and stable-lead criteria. This
module supplies fairness eligibility only; it does not weaken architecture,
authenticity, visual quality or execution checks, compute scores, retry failed
attempts, or certify a renderer-speed advantage.

An incomplete review, missing capture or violation remains an unscored failure.
Retain failed artifacts, diagnose general engine/tooling issues, perform the
required repository checks, then pack a new SDK and run a fresh independent
pair. Any meaningful-edge claim must still satisfy the predeclared quality,
runtime spread and successive-pair criteria. Report controlled workload
results separately, including regressions and every predefined variant.

## Fair score entrypoint and meaningful-edge decision

Use the new [fair-score-v2.mjs](fair-score-v2.mjs) entrypoint for v2 results:

```sh
node tools/agent-benchmark/fair-score-v2.mjs \
  --inputs /absolute/fair-score-inputs.json \
  --inputs-sha256 EXACT_SHA256 \
  --output /absolute/new-fair-score.json
```

Output is create-only. Existing retained results are never overwritten. The
manifest schema is `aperture.house-race-fair-score-inputs.v2` and includes:

```js
{
  schema: "aperture.house-race-fair-score-inputs.v2",
  roundId: "round-001", roundOrdinal: 1,
  pins: {
    baseInputs, // exact existing score-round.mjs input manifest pin
    method, fairness, // exact full v2 method and fairness-contract.json pins
    previous, // optional exact immediately preceding v2 score report pin
  },
  trials: [
    // Exactly three entries per engine, ordinals 1, 2, 3.
    { engine: "three", trial: 1, declaration, sourceAudit, observation },
    // ...five further entries. Each value is {path,sha256,bytes}.
  ],
}
```

The original base input manifest must pin the same actual v2 method file. Its
summary, dispatch freeze, case map, semantic source/architecture audit,
independent blind judges and optional previous report retain the original
schemas and byte joins. The original scorer verifies the complete official
execution graph, all retained trial/source/dependency bytes, worker eligibility,
quality floors and unchanged scoring formulas. Its new API
`acceptedMethodSchema` option defaults to v1; the v2 wrapper supplies v2 only
after strict method/fairness checks. No parsed evidence is rewritten and no
verification error is suppressed. The explicit v2 branch joins each actual
reference hash to the round's pre-author dispatch freeze and summary, while v1
retains its original fixed-reference join. Existing v1 CLI behavior stays unchanged.

Generate a v2 summary with the original immutable-output summarizer using
`--method-schema aperture.house-race-method.v2`; its default stays v1. The new
option uses the single authoritative `reference.png` pin in that round's freeze
to verify both final author audit references without rewriting the method. It
preserves all native protocol, fixed trial, original author/preview
budget and component-weight checks. A summary without complete official
execution still has no formal scores.

Before freezing the method, include `fair-score-v2.mjs` and `fairness-v2.mjs`
alongside all original scorer sources in dispatch provenance. The wrapper
verifies active bytes against this pre-author freeze. A different scorer,
fairness contract, method, reference-generation policy or measurement control prevents a
successive-pair lead claim.

The fair declaration must survive as `benchmark-fairness.json` in the retained
final author source inventory. Fair source/build hashes are canonical sorted-key
JSON SHA-256 digests of the original `author.audit.sourceFiles` array and the
trial's `appInputs` object. Fair reviewer identity must equal the independently
reviewed original semantic source reviewer; author identity must equal the
original protocol's assigned author. Every source-review evidence reference
must match and survive in the exact original reviewed source/dependency
inventories.

Use `buildFairnessObservationV2({contractSha256,sourceSha256,buildSha256,
trial,measurement,renderer})` with the already validated trial and verified
retained `measurement.json`/`verified-runner.json` values. Save and pin its
result. It adds exact `trial` and `trialHashes` joins and derives backend,
capture, native position, placed triangle and bounds facts. The file scorer
reconstructs this observation from the surviving bytes and rejects any
disagreement. Canvas/DPR facts come from the frozen client's explicit checks;
no material features or UV counts are inferred from native proof.

All six fairness gates must pass before any formal scores are exposed. The
wrapper recomputes the unchanged original component formula and asserts exact
equality with the original eligible scores. It retains the original complete
evaluation in `baseEvaluation`. An invalid or incomplete base/fairness gate
withholds scores and meaningful-edge claims; valid first-pair results remain
exploratory with `pending-second-successive-eligible-pair`.

`evaluateMeaningfulEdgeV2` preserves the original ordinal, fresh-author/judge,
control/scorer, quality-review and spread requirements with the v2 rule that
successive pairs use **different** reference image hashes from the same frozen
low-poly task-family policy. It does not claim the original v1 fixed-reference
stable lead. Each of two immediately successive fresh
eligible pairs must have a combined Aperture margin ≥0.25, visual and geometry
means ≥6 **and each at least Three's corresponding mean**, plus ≥10% gain in
recorded active author time or median trial-median frame time. The runtime path
also requires the absolute median advantage to exceed the **larger** of the
two engines' within-engine max-minus-min trial-median ranges. Report both
ranges and their overlap and require independently reviewed exact spread
receipts. A gain within that observed spread remains explicitly inconclusive;
the independently qualified author-time path can still establish the task edge.
This range rule is predeclared and is not a significance test.

Preserve the original exact preceding-score quality-regression review and four
distinct authors/four distinct judges across the two pairs. An invalid pair,
missing ordinal, repeated author, changed frozen control or unreviewed spread
cannot be skipped. The authoritative v2 decision is `meaningfulEdge` (also
exposed as `stableLead`); it never claims universal engine superiority or
physical-GPU speed.
