# Round 004: diagnostic results

All six preselected native SwiftShader attempts passed. Each retained 60 warmup
frames, 120 serial fenced measured frames, complete lossless source geometry and
native position-upload witnesses, and three fixed camera captures. The order was
Aperture 1, Three.js 1, Three.js 2, Aperture 2, Aperture 3, Three.js 3. The complete
sequence took 5,015.99 seconds. No attempt was replaced or rerun.

This pair is **ineligible for a combined winner**. Before final measurements,
Aperture's third preview was denied by the harness disk floor while Three.js had
three successful previews. Separately, the blind reviewer recorder rejected the
image tool's actual `application/octet-stream` data URLs. Both reviewers returned
assessments, but all seven image-response operations and the finish operation
failed in each journal. Those returned assessments are provisional diagnostics,
not successful delivery attestations. The original summary and failed operations
remain unchanged. Formal scores and the winner are null in
[methodological-disposition.json](methodological-disposition.json).

| Diagnostic | Aperture | Three.js |
| --- | ---: | ---: |
| Median of three frame-time medians | 5,792.920 ms | 2,816.945 ms |
| Individual frame-time medians | 6,158.935 / 5,792.920 / 5,720.910 ms | 2,815.440 / 2,845.865 / 2,816.945 ms |
| Individual frame-time p95 | 7,941.615 / 6,960.775 / 6,844.345 ms | 3,053.460 / 3,147.130 / 3,154.740 ms |
| Median CPU submission time | 8.330 ms | 12.570 ms |
| Steady submitted draw calls | 56 | 1,682 |
| Steady submitted triangles, including passes | 368,930 | 692,221 |
| Captured source mesh entries | 53 | 841 |
| Captured render instances | 53 | 22,275 |
| Distinct source geometries | 53 | 211 |
| Unique authored vertices | 1,106,781 | 13,808 |
| Unique authored triangles | 368,927 | 9,918 |
| Scene triangles after placements | 368,927 | 347,512 |
| Retained native source vertex bytes | 35,813,232 | 1,828,772 |
| Active author time | 1,242.642 s | 1,118.585 s |
| Total author wall time | 1,338.650 s | 1,203.072 s |
| Preview waiting credited | 96.007 s | 84.487 s |
| Recorded commands / nonzero exits | 35 / 4 | 13 / 1 |
| Provisional returned visual mean | 6.00 / 10 | 6.95 / 10 |
| Provisional returned geometry mean | 7.15 / 10 | 8.15 / 10 |

The frozen nearest-rank statistic is used throughout. All samples remain in the
results. CPU SwiftShader queue completion dominates these timings; they are not
physical GPU measurements or unfenced production throughput. Different authored
geometry, SSAO, surface maps, lighting and environments prevent attributing the
2.056x frame-time ratio solely to the engines. Draw counts alone do not explain
the result.

The earlier prepared-resource cache repair remained reliable through all 183
frames of every Aperture trial. After initial warmup allocation, all measured and
camera frames had stable geometry, no buffer/texture/pipeline churn, and no
compute work. All three trials per engine have identical semantic geometry
hashes and byte-identical images for each fixed camera.

Source and geometry review found that Aperture's four foliage batches account
for 288,996 triangles, 78.33% of its scene triangles. The author baked primitive
parts into nonindexed material batches. Existing indexed primitives, explicit
normals and shared-source ECS instancing were available and documented. Existing
`mergeMeshAssetsForBatch` also already preserves compatible streams, indices,
material/submesh ranges and bounds. The narrower convenience gap is affine
baking with normal/tangent handling and packed-input guidance, reusing that
merge implementation. The original proposal and its correction are both
retained under [review-operations](review-operations/independent-diagnosis).

The authored round foliage, periodic lawn, coarse background sheets and opaque
car glazing explain visible weaknesses. No additional renderer defect was
isolated. A separate directional-shadow optimization proposal remains unproved;
it requires native parity, shader uniformity and controlled timing evidence
before adoption. These proposed experiments do not replace Round 004.

The headless transcript exposes two concrete DX gaps: unclear discovery of the
existing full cleanup helper, and a malformed module-entry diagnostic that told
the author to default-export an already default-exported class. The correct
input is an imported module or `{ default: SceneSystem }`; scheduling priority
belongs to the class descriptor. `disposeApertureApp(runner.app)` is the existing
awaited cleanup helper for systems and features. The retained proposal describes
the diagnostic, lifecycle recipe and meaningful recovery tests.

The source checkpoint used by this round is
`2b91c1fe530de5503ba1e004d508a9f711f51e41`. Its full check and coverage each passed
5,167 tests in 707 files, and the two stages passed 20 actual native SwiftShader
reports. Coverage met the unchanged thresholds. The separate manual Playwright
CI suite was not run because this environment requires the approved cloud
rendering route. Exact original validation and producer summaries are retained
in [repository-validation](repository-validation). The reviewed Facebook
immersive-web-sdk upstream revision was
`0778f518db51e9d1836977f3b6fed9b53f3f0c6f`.

Next: back up this immutable checkpoint, repair the general capacity and image
journal issues, improve headless and geometry authoring DX, verify the complete
repository, and repeat with fresh independent authors. Keep the reference,
camera contract and 40/20/25/15 rubric. A stable lead still requires two successive
eligible fresh pairs with the originally specified margin and quality floors.
