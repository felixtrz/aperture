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
- Physical-GPU confirmation is required before claiming a hardware architecture
  advantage. The user confirmed no physical-GPU runner is available. This
  criterion is blocked; all available native measurements are SwiftShader software
  WebGPU queue fence latency, not hardware timestamps.

Current disposition: **software target observed; overall acceptance incomplete**.
The final fixed-storage/Fresnel candidate reduced queue-completion medians versus
Three.js by 14.6% / 15.4% in the two declared orders. Both gains exceeded reference
drift, with no end-to-end regression against Three.js or the previous owner-v4
specialization. All 50 full native safety images matched the retained general
baseline and disposal passed.

The final experiment also declared a stronger guard against the intermediate
fixed-storage-only candidate. That guard failed in reverse order: end-to-end time
was 240.885 ms versus 234.925 ms, a 2.5% regression. Its full experimental benefit
gate remains **failed**; the original Three.js criterion passing does not override
that result. Incremental Fresnel benefit remains uncertain. Earlier architecture,
shadow-offset and fixed-storage-only failures remain retained. Hardware
confirmation remains blocked. The implementation stays experimental.

Further experiments must declare source/settings/order/thresholds before running,
retain failures and preserve rendering quality. A new independent author round
requires a new feasible low-poly reference image shared by both authors; repeated
controlled diagnostics must be identified as causal diagnostics, not new author
rounds. If the available environment cannot substantiate an acceptance criterion,
record the blocker instead of declaring success.

Delivery is on research branch `research/render-plan-20261014`. This revision
includes the selected source and the shader-probes/fixed-storage evidence
addenda; its commit identity is supplied by Git and verified against the remote
after pushing. Delivery does not imply that all performance criteria passed.
