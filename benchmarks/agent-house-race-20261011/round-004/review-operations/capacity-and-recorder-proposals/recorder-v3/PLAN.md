# Separate private recorder v3 transport correction

Grounding: root reported that both actual R004 diagnostic judges returned
`dataUrlMime: application/octet-stream` from all seven real local view_image
calls. Recorder v2 required image/*, so all responses and subsequent finishes
failed. Root retains actual final response and failed finish argument bytes;
assessments remain provisional and combined scores NULL. This draft does not
read their journals, modify v2, backfill operations, retry or rejudge.

The actual narrow source defect is `record-judge-v2.py` image-response validation,
line 115: the strict `.startswith("image/")` transport requirement. Do not fix it
by changing the reported MIME or trusting all application/octet-stream content.

Proposed v3 keeps the exact recorded tools.view_image/path/original detail and
image(result.image_url, original) call. It accepts only image/png or the observed
application/octet-stream transport for a source independently pinned as PNG.
The fresh request/source PNG signature, IHDR CRC and positive bounded dimensions
are rechecked. No image/jpeg, arbitrary image/*, missing MIME or extra metadata
is accepted. Returned metadata must preserve the actual MIME/detail/characters;
never synthesize successful responses or replay old failed journals.

The current four response fields cannot detect a data URL that has the correct
prefix but truncated/inconsistent payload. A new frozen live helper must decode
the actual result.image_url in memory and produce `decodedBytes`,
`decodedSha256`, and `pngDimensions`. It validates a strict padded base64 data URL,
bounded size and PNG header; v3 checks those exact decoded bytes' SHA/size/dimensions
against the unchanged original pinned source. All facts come from the returned
URL, not a re-read of the input path. Return only bounded metadata; do not log the
full image data URL. Any decoding error is an actual failed response operation.

`validate_live_image_v3.py` is a pure private validator draft, not yet wired into
a v3 recorder. Its focused unexecuted test source covers the observed MIME without
relabeling, normal image/png, unknown/wrong MIME, truncation, same-length altered
bytes, wrong dimensions/detail/path, non-PNG/CRC mismatch, bool lengths, missing
decoded fields and unexpected fields. The live JavaScript parser/hash helper and
fresh copied v3 recorder/spec/task orchestration still need implementation and
actual-tool validation after freeze; this package is not ready for judge dispatch.

If original-detail view_image genuinely re-encodes an image, exact source-byte
parity must fail rather than claim false equivalence. Root must inspect a fresh
actual tool fixture and select a separately disclosed compatible observation
protocol; source hashes alone do not prove returned pixels. Do not loosen the
validator without observing that behavior. The current root-reported MIME alone
does not establish byte parity, so this remains an explicit pending test.

Use a new response metadata schema and source-pinned recorder v3 in entirely
new create-only bundles/journals. Never apply it to existing v2 operation chains
or final bytes. Root's future authentic task performs seven actual image calls,
records both fact reads, and seals original final JSON only after all v3 responses
are successful. Tests must retain wrong/failed operation bytes and verify closed
journals reject further actions. No score/model/geometry/engine hint is involved.

Cooperative public operations are not signed provider attestation or hostile
actor confinement. Decoded fields supplied by a reviewed actual live tool helper
remain public witnesses; do not infer private provider reasoning or comprehension.
