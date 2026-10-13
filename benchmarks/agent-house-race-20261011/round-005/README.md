# Round 005: retained, ineligible comparison

The fresh independent authors used the same house/road/car reference, blank
JavaScript starters, 1,800 active seconds, three preview opportunities, native CPU
SwiftShader, fixed cameras and balanced 40/20/25/15 visual/geometry/runtime/time
rubric. Neither author received previous work or the other author's context.

All six application attempts retained 60 warmup and 120 measured samples. Five
official supervisor operations completed; the final supervisor was interrupted.
No failed trial was retried or substituted, and no capture limit was relaxed.

| Unscored observation                            |     Aperture |     Three.js |
| ----------------------------------------------- | -----------: | -----------: |
| Active author time                              |  1,210.745 s |  1,457.607 s |
| Raw median of trial frame medians               | 5,500.340 ms | 4,076.950 ms |
| Effective measured draw calls per frame         |           68 |        2,814 |
| Submitted triangles per measured frame          |      415,401 |    2,251,077 |
| Application attempts with all timing samples    |            3 |            3 |
| Complete geometry and three-view exports        |            3 |            0 |
| Genuinely completed official wrapper operations |            2 |            3 |

Aperture's author finished about 17% faster, while its scene's raw median frame
time was about 35% slower. The scenes use different geometry, materials, effects
and screen coverage, so these values do not isolate engine speed. Timing values
use the original frozen order-statistic definition.

Three.js's three attempts refused geometry export after exhausting the 10,000
retained-segment limit, despite retaining less than 6 MB. The recorder captured
uploads for buffers outside the vertex-geometry evidence scope. All timing
samples and failures remain retained; no preview image replaces the missing
official captures.

During Aperture's final attempt, the execution-terminal transport failed and
the driver and pressure supervisor exited from signal 9. The application
continued and completed its own cleanup with an actually observed kernel exit
status of 0. Its data and views survived. The original run manifest remains
active; supervisor completion, descendant reaping and a capacity completion
checkpoint were not fabricated. Five original operation records remain; no
sixth record has been backfilled.

The standalone frozen offline review validates Aperture's typed artifacts,
including the final application's data, and rejects all three failed Three.js
captures. That review is not proof of final wrapper completion. All formal
quality, runtime, authoring and combined scores, the winner and a stable lead
remain unset. [root-findings.json](root-findings.json) records the raw evidence
references and limitations.

The next batch repairs capture scope, durable supervision and the scoring
completion gate. Fresh author pairs must establish the result under the same
rubric. This preserved round remains ineligible.
