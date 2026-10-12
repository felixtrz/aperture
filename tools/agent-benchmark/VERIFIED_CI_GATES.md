# Verified cloud shader gates

Build the WebGPU package first, then run these commands under the adopted
runtime-pressure lifecycle with the provisioned native SwiftShader runtime:

```sh
node tools/agent-benchmark/verified-ci-gates.mjs shader /absolute/new-shader-output
node tools/agent-benchmark/verified-ci-gates.mjs tonemap /absolute/new-tonemap-output
```

Both commands use the unchanged `runVerifiedScene` route, exact approved launch
configuration, loopback-only network policy and awaited browser/server cleanup.
They fail when WebGPU is unavailable. Output directories are create-only.

The shader gate imports the original CI gate's pure case builder. Its current
42 cases cover six mesh families with plain/motion-vector outputs and six string
families with five output operators. Twelve additional StandardMaterial cases
cover the corrected world normal and tangent helpers, skinned/morphed variants,
motion vectors and shadow/IBL composition. Every module's real native
`getCompilationInfo` messages and validation error scope survive in
`native-results.json`. The existing none/linear byte-identity assertions remain
and their exact before/after hashes are retained. The original gate performs
module compilation; these family pipelines are not claimed to have been drawn.
A separate native canvas draw establishes the verifier's rendering proof.

The tonemap gate imports the exact original CI compute builder, six input
colors, AgX/neutral/Reinhard Three.js reference values and `5e-3` tolerance. It
creates and submits each native compute pipeline, copies actual GPU results to
readback buffers, retains every f32 value and raw readback byte, and compares the
values independently in Node. Nonfinite values, missing outputs, byte/float
disagreement or reference drift fail. The canvas displays the actual compute
output buffer as color swatches; screenshot pixels are not numeric test inputs.

Each attempt retains the full scene HTML, case configuration, individual input
WGSL files and hashes, source builders/harness, native proof report and PNG.
Successful validation creates `validation.json`. Failed validation preserves
available compilation/readback records and creates `failure.json`; it does not
rewrite or remove partial evidence. These are correctness gates with no
performance score or physical-GPU claims.

The existing CI scripts still run their original browser route when invoked
directly in other environments. Their new main guards make imports of the pure
builders safe. Cloud callers must use this approved verified equivalent.
