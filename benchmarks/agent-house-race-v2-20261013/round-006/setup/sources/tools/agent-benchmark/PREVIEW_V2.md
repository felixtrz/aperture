# Diagnostic preview v2

This additive preview route is reserved for a fresh benchmark round whose inputs
freeze includes both `preview-client.mjs` and `preview-run.mjs`. It does not
replace the first round's frozen preview policy or its original 60+120-frame
trial runner. Authors still implement the existing application adapter.

Before starting either author, set `previewProtocol: "frozen-build-v2"` for both
private lane configurations and freeze that configuration. Run
`preview-service-v2.py` for that new round; the original coordinator remains for
the original round. Each preview freezes the current built app under the own
lane's `previews/NN-frozen-build/` while its lane lock is held and the container
is idle. The request then queues that readonly build and its exact file hash
manifest. Later edits, builds and preview wait timeouts cannot change its inputs.
The coordinator and finished-author auditor validate the own lane, engine,
preview number, path and every retained file hash before consuming those bytes.
Symlinks and oversized files/builds are refused before publishing a request.

```sh
node tools/agent-benchmark/preview-run.mjs \
  --app /absolute/built-app \
  --engine aperture \
  --output /absolute/new-preview-attempt \
  --trial 1
```

Run this directly under the established runtime-pressure lifecycle, exactly as
the full runner. It uses the unchanged native SwiftShader verifier and launch
configuration. It retains three warmup frames, three diagnostic frames and all
three fixed camera PNGs at the normal viewport. It skips full geometry upload
parity and performance scoring. Its distinct schema explicitly marks these
outputs as diagnostics; the offline scorer rejects them as full trial evidence.
Each retained frame includes observed CPU submission duration, the application
render promise duration, native queue-completion latency and end-to-end elapsed
time. These are CPU SwiftShader diagnostic timings, without component or overall
benchmark scores. Native submitted draws and submissions establish each frame's
actual work; no application-reported performance statistics are used.

Each application readiness, frame, native queue fence, presentation proof, canvas
PNG and recording operation has a 30-second deadline. A 240-second client budget
limits the sequence, and the verifier uses its existing 270-second timeout option.
These timers bound the attempt's work and publish failure phase/counters; they
never establish that a browser is terminated. The existing verified route still
awaits context/browser shutdown and the lifecycle wrapper still waits for all
descendants. Do not start a replacement render after a timeout while the previous
lifecycle is unresolved. Partial PNGs, failed reports and exact input copies are
preserved without rewriting the attempt.
