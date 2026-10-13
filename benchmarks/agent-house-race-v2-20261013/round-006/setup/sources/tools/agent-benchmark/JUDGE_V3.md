# Recorded blind image-tool transport v3

The public `record-judge-v3.py` uses a new
`aperture.blind-judge-operation-spec.v2` with
`responseMetadataSchema: "aperture.live-image-transport.v3"`. Historical v2
sources, failed commands/journals and returned assessments remain immutable.
Never backfill old operations, relabel a reported MIME, or rejudge a failed round
as an undocumented repair.

Each fresh opaque reviewer root contains readonly copies of
`record-judge-v3.py`, `judge_image_v3.py`, `live-image-response-v3.mjs`, the exact
rubric, seven PNGs (shared reference plus three views per case) and two neutral
fact files. A readonly spec supplies actual unique `judgeId`, `bundleRoot`, own
external create-only `outputRoot`, opaque `caseIds`, nine pinned `inputs`,
`recorderSha256`, `validatorSha256`, `liveHelperSha256`, and pinned `rubric`.
The spec and all sources/inputs must be source-pinned before model dispatch.

`prepare-judge-v3.py --spec ABS --spec-sha256 SHA --output NEW_TASK` produces a
readonly task, not a model invocation. Only its own task may be read once to
bootstrap. Thereafter all operations route through the own recorder:

```text
start
helper
facts ALLOWED_FACT_ID                     # both exact neutral files
image-request ALLOWED_IMAGE_ID            # each of the seven images
image-response ACTUAL_REQUEST_ID --metadata-json EXACT_LIVE_METADATA
finish --json-text EXACT_ORIGINAL_FINAL_JSON
```

The task embeds exact pure helper definitions after only removing export
keywords. Prepend them to each fresh `functions.exec` image cell. They use no
Node/browser globals, imports, atob, crypto, TextEncoder or Buffer. Call actual
`tools.view_image` with the returned original-detail arguments and forward its
actual `image_url` through `image(result.image_url, "original")`. Compute bounded
metadata from that same returned URL; never use the source file as a substitute.
The data URL is decoded and SHA-256 hashed in memory, without logging the URL or
putting it in a shell argument. Only small MIME/detail/character-count/decoded-
size/SHA/dimensions metadata crosses the recorder command line.

Known transports are exactly `image/png` and `application/octet-stream` for an
independently pinned local PNG. Unknown MIME/encoding, invalid padding, missing
bytes, altered source/return SHA, dimensions, tool/path/detail or metadata fail
closed and remain recorded failures. The validator independently checks source
PNG signature/IHDR CRC/dimensions and compares returned bytes' exact SHA/size.
Original-detail transport that re-encodes bytes therefore fails rather than
claiming equivalence. An actual-tool fixture must validate any new transport
behavior before fresh dispatch; MIME matching alone is insufficient.

The recorder requires the exact helper read, both facts, all seven successful
unique live response witnesses and no unresolved requests before preserving the
exact original final JSON bytes. Its journal records public commands, outputs,
errors and hash-chained events. A failed finish is not a completed judgment.

This is cooperative public tool routing. Witness metadata and source pins are
not a platform-signed proof of viewing/comprehension, private provider reasoning,
or adversarial confinement. Do not inspect provider sessions or write fabricated
operation metadata. Independent native/source verification and the frozen
quality rubric remain separate from this transport protocol.

`test_live_image_response_v3.mjs` compares the pure SHA implementation with an
independent Node oracle across block boundaries and executes the same source in
a V8 context where decoder/crypto globals are undefined. Python tests exercise
both accepted MIME values, rejection and actual recorder CLI journal completion.
Those CPU fixtures are not substituted for seven actual reviewer image calls.
