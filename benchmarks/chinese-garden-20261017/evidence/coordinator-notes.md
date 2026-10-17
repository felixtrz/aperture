# Coordinator record

All author trials used the same shared capture script, with no changes to that
script after dispatch. Capture jobs were serialized. An early long Aperture
capture held the slot while the other two authors queued; their queue durations
are retained separately. The coordinator gave queue-status information, without
framework or design suggestions. Authors stopped after declaring completion.

All three finished within the 25-minute limit and exhausted their six capture
attempts. Their scene sources matched their selected final capture snapshots.
The 1,237 engine/package files in the pretrial hash manifest remained unchanged.

Review images were randomized to A/B/C and copied to a neutral workspace outside
the Aperture repository. Two fresh-context judges received only the reference,
final images and fixed rubric. A third received anonymized timing and journal
notes, reference, first captures and final captures. Judges could technically
access the shared filesystem, but were explicitly instructed to inspect only
their assigned packet and not communicate. Blinding is procedural, not an OS
security boundary. All judges inherited the same parent model and reasoning.

The effort packet initially used a nonexistent capture field `totalMs`, producing
null values for that field. The coordinator corrected it from `elapsedMs` and
notified the effort reviewer. Candidate totals and capture build/queue/render
durations were correct throughout. No scene, timing record or rubric changed.

Post-trial reproduction is separate from the six-attempt author allocation.
The new coordinator reproduction script initially omitted the wrapper's required
`APERTURE_WEBGPU_RUNTIME` environment variable. The first Aperture and vGPU
rebuilds stopped before browser launch. Logs were retained. After correcting that
script, all three rerenders passed native WebGPU verification without scene edits.
This coordinator error is excluded from author timings and failures.

The rerenders reproduced Aperture and vGPU PNG bytes exactly. Three.js had slight
pixel variation (mean absolute RGB channel differences approximately 0.13/255).
Its built-in DenoiseNode creates noise using an unseeded SimplexNoise instance,
a plausible source; no controlled attribution experiment was performed. Reviewers
used the original frozen images. See reproducibility.json for exact comparisons.
