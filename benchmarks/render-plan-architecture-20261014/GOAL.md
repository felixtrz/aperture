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

Current performance disposition: **not achieved**. Both completed architecture
comparisons failed their original gates. The cached plan, uniform transport and
facing shortcut do not establish an advantage over the existing specialization or
Three.js. Negative results remain retained, and the implementation is experimental.

Further experiments must declare source/settings/order/thresholds before running,
retain failures and preserve rendering quality. A new independent author round
requires a new feasible low-poly reference image shared by both authors; repeated
controlled diagnostics must be identified as causal diagnostics, not new author
rounds. If the available environment cannot substantiate an acceptance criterion,
record the blocker instead of declaring success.
