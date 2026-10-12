# Diagnostic preview v3

Use this additive route only for a fresh benchmark round. Keep the historical
preview v2 sources, inputs and evidence unchanged. Before either author starts,
freeze both private lanes with `previewProtocol: "frozen-build-v2"` and
`previewDiagnosticSchema: "aperture.agent-house-diagnostic-preview.v3"`, the same
common disclosure, and the exact v3 client/helper/runner/coordinator dependencies.
Run `preview-service-v3.py` serially. Request-time readonly build freezing, queue
validation, the three-preview allowance, 1800-second active author budget and
equal credited preview waiting keep their existing behavior.

```sh
node tools/agent-benchmark/preview-run-v3.mjs \
  --app /absolute/frozen-built-app \
  --engine aperture \
  --output /absolute/new-preview-attempt \
  --trial 1
```

Invoke this only under the established runtime-pressure lifecycle. It uses the
unchanged approved `runVerifiedScene` route and native SwiftShader configuration.
No direct browser route is introduced. Successful previews still request three
warmup frames, three diagnostic frames and the same three fixed-camera view
frames at the same viewport: nine render requests total. Existing prior/native
fences and presentation proof checks remain. No extra render or queue fence is
added. Timings remain diagnostics and cannot substitute for official trials.

After canonical frame 5, both engines call their existing `inspectGeometry`
adapter once. The pure numeric v2 codec validates supported numeric dtypes,
owned coherent arrays (live SharedArrayBuffer views are refused), finite values,
mesh IDs, component/triangle cardinality, source bytes and aggregate work limits.
The preflight also validates triangle index ranges and affine world/instance
matrices with the same numeric tolerances as official geometry validation.
Number arrays and matrix-list rows use Float64LE; typed arrays keep their dtype.
Limits remain 256 MiB of source numeric bytes including alignment, 4 MiB chunks,
8 MiB numeric descriptor metadata, 5000 meshes, one million matrix rows,
20000 matrix source-type runs, 20 million transformed vertices and 10 million
instanced triangles. Actual bounded synchronous copying/validation work is
performed; the operation timer cannot interrupt synchronous JavaScript.

Numeric arrays and descriptors are discarded after validation. Preview uploads
no binary geometry, source meshes or native geometry capture. The only new
artifacts are a summary at most 64 KiB (`geometry-preflight.json`) and, on failure,
a separate actual bounded error at most 128 KiB (`geometry-preflight-error.json`).
Summary counts distinguish source vertices/indices, matrix rows, effective
instances, transformed vertices and instanced triangles, and retain dtype/source
byte counts. Error attribution preserves the actual name/message/code/stack with
bounded text; it includes no scene advice. The normal immutable artifact receipts
hash these small records. Failed summaries reference the separate error receipt.
The coordinator returns actual error text through the existing own-lane feedback
path, with its retained artifact hash. Success returns the same own canvas PNGs;
summary counts/status survive in retained coordinator evidence.

A preflight error stops the attempt before the view phase, consistent with
existing fail-fast diagnostic behavior. Already completed frames and failure
artifacts survive. Successful attempts still complete all nine requests and three
views. Geometry inspection must not submit new native work; submission and draw
counters are checked before/after inspection without an additional fence.

This check cannot detect a valid numeric subset silently returned by an adapter.
A bounded inspection API may legitimately return a partial result: adapters must
still satisfy the official contract to include every visible mesh and instance.
There is no claim of full visible coverage, native upload parity, full official
manifest size or official eligibility. The 8 MiB preflight check covers numeric
descriptors only; the complete official capture manifest also contains native
metadata and witnesses, so passing does not establish that it fits. Post-warmup
or later scene mutations may also fail only in final trials. Official geometry
capture, observed native counts, visual checking, independent judging and the
60+120-frame workload remain separate and unchanged.

The existing 30-second operation, 240-second client and 270-second verifier
readiness/navigation deadlines remain. Geometry inspection uses an existing
bounded operation, without extending them. Timers do not prove browser teardown.
After failure or timeout, the coordinator still awaits the verified context/
browser shutdown and adopted descendant cleanup before accepting another job.
All evidence paths remain create-only; no failed preview is retried or overwritten.
