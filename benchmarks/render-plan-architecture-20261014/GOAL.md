# Acceptance goal

Demonstrate a meaningful Aperture advantage over Three.js WebGPU on the controlled
workload without reducing visual quality. This goal was made explicit after the
first two architecture comparisons; it does not replace their frozen declarations
or retroactively change their failed acceptance results.

- Identical controlled scene, geometry, camera, resolution and rendering settings;
  retained native shader/resource evidence and image correctness.
- At least 10% lower median queue-completion time than contemporaneous Three.js
  in both declared run orders, beyond measured reference drift, with no median
  end-to-end regression versus Three.js or the previous Aperture specialization.
- Native lighting transitions, transmission producer/consumer relationships and
  disposal pass; required repository checks either pass or have explicit external
  blockers, never silently skipped or presented as green.
- Commit and push the research code, reproducible evidence and acceptance report,
  then verify local and remote commit identity. No merge or release is implied.
- The completion criteria above apply to the available SwiftShader software
  environment. Physical-GPU performance remains unverified: the user confirmed
  no hardware runner is available. Hardware confirmation is required for a
  hardware claim, while software optimization and validation continue here.

Current disposition: **software acceptance passed**. The flat draw-constant candidate reduced queue
medians versus Three.js by 16.7% / 14.5% in the two declared orders. Both gains
exceeded reference drift. End-to-end time was lower than all five controls in
both orders, including every intermediate Aperture candidate. All benchmark
reference images matched exactly within their respective engine baselines.

Native qualification passed 52 states and all 59 paired images. Repository
checks passed every pre-test stage and 5,351 tests; four CLI rendering tests
explicitly fail because `/opt/google/chrome/chrome` is unavailable. Exact
failures are retained; the suite is not represented as fully green.

The earlier Fresnel window still fails its stronger fixed-storage-only guard.
The subsequent opaque-discard deletion also failed and was reverted. Their
negative outcomes and all failed preparations remain retained. No hardware
performance or general engine superiority is claimed.

Further experiments must declare source/settings/order/thresholds before running,
retain failures and preserve rendering quality. A new independent author round
requires a new feasible low-poly reference image shared by both authors; repeated
controlled diagnostics must be identified as causal diagnostics, not new author
rounds. If the available environment cannot substantiate an acceptance criterion,
record the blocker instead of declaring success.

Delivery is on research branch `research/render-plan-20261014`. This revision
contains the selected source, rejected opaque-discard evidence, winning flat
draw-constant evidence and validation report. Git identifies the delivery commit;
its remote identity is checked after pushing. No merge or release is implied.
