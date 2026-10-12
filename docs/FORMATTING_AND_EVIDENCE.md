# Formatting and retained evidence

`pnpm run format:check` checks all editable repository files with standard
Prettier. `pnpm run format` applies the same policy. Both commands first verify
the retained evidence inventory, then supply Prettier with temporary exclusions
for those exact, verified file paths. They retain the ordinary `.gitignore` and
`.prettierignore` rules. The temporary file is created outside the checkout and
removed when the command finishes.

Historical benchmark sources, captures, receipts and judgments must keep their
original bytes. Reformatting them changes their recorded hashes and erases the
ability to distinguish original evidence from later edits. Their integrity gate
is `pnpm run check:preserved-evidence`, which also runs at the beginning of the
full repository check. Missing, changed, redirected or non-regular files fail;
formatting stops before writing anything when verification fails.

The explicit inventory is
[`scripts/preserved-evidence.json`](../scripts/preserved-evidence.json). Its
`baselineRevision` identifies the original Git tree from which these retained
paths and bytes were recovered. During inventory creation, each working-tree
file was checked against its original Git blob before its SHA-256 was recorded.
It includes the retained benchmark files, coordination evidence and the canonical
recovery checkpoint. It permits no exclusions in package source, tests or active
tooling. The actively executed recorder additionally checks against its existing
`freeze-006.json`, including its original source pins and 24-test result.

New benchmark files are covered by formatting automatically: there is no blanket
`benchmarks/**` exclusion. A fresh freeze is a reviewed preservation decision
with explicit input provenance and unchanged original bytes, rather than a way
to suppress a style failure. Repair active source formatting directly.
When a frozen implementation needs changes, copy it into new editable tooling or
a new versioned trial and retain the original. Never regenerate expected hashes
to bless changes to retained evidence.

## Fresh experiment batches

Keep the committed historical inventory unchanged. Fresh experiments register
independent manifests in
[`scripts/experiment-freezes.json`](../scripts/experiment-freezes.json).
Registrations pin each manifest's exact repository-relative path and SHA-256.
Both the check and formatter verify that pin, every listed artifact's SHA-256
and byte count, and the working-tree input-copy joins before excluding the
individual files. Missing or tampered manifests and artifacts fail closed.
Unlisted files remain covered; registering one batch never exempts its directory.
Fresh exact paths may include literal `+` and `@` in package/store filenames.
These characters do not grant globs, traversal or access to private author
environments. The historical baseline path grammar and inventory are unchanged.

After inspecting every retained file and its provenance, write an explicit request
outside the private author environment. This example describes the format only;
replace its paths, origins, reviewer and timestamp with the actual reviewed batch:

```json
{
  "schema": "aperture.experiment-freeze-request.v1",
  "purpose": "Preserve the complete first attempt, including its failure",
  "review": {
    "reviewedBy": "actual reviewer",
    "reviewedAt": "2026-10-11T23:00:00Z"
  },
  "provenance": {
    "kind": "working-tree-snapshot",
    "note": "Actual copied working-tree inputs; no committed revision is claimed",
    "inputs": {
      "actor-a/src/main.ts": "benchmarks/agent-house-race-20261011/inputs/actor-a/main.ts",
      "packages/app/src/index.ts": "benchmarks/agent-house-race-20261011/inputs/engine/index.ts"
    }
  },
  "files": {
    "benchmarks/agent-house-race-20261011/inputs/actor-a/main.ts": "Original reviewed actor source bytes",
    "benchmarks/agent-house-race-20261011/inputs/engine/index.ts": "Original reviewed working-tree engine input copy",
    "benchmarks/agent-house-race-20261011/attempt-001/failure.json": "Original failed-attempt diagnostic output"
  }
}
```

Run the create-only sealer from the repository root:

```sh
node scripts/seal-experiment-evidence.mjs \
  --spec /absolute/reviewed-batch.json \
  --output benchmarks/agent-house-race-20261011/freezes/batch-001.json
```

The sealer reads only individually declared retained files under `benchmarks/`.
It does not enumerate directories, consult current source files, or read private
`.aperture-env` author environments. Its `capturedAt` records sealing time; the
review timestamp and artifact origins come from the reviewed request. Public
source labels join to retained copies and their actual hashes. Later changes to
live package source do not change an earlier experiment's provenance. Supply
dependency, source, prompt, image, contract, harness, operational transcript,
native attempt, metric and review copies explicitly; preserve every failed
attempt as well as successful ones. Empty original files may remain empty.

The command refuses an existing output path and prints the exact registration
record. Inspect its manifest, then add that record to the registry's `inventories`
array. This deliberate registration step activates the formatter exclusions;
sealing alone does not register an exemption. The registry remains editable and
formatted. No invented Git SHA appears in fresh manifests, and the old baseline
inventory is never regenerated. Keep manifests and registration pins in the
reviewed Git revision when publishing the evidence.

This gate detects changes to retained bytes; it does not authenticate historical
claims, score benchmarks, review private content, or replace the existing archive
verifier. The inventory itself needs the same Git review and durable revision
boundary as any checksum manifest. See
[benchmark evidence archives](../tools/benchmark-evidence/README.md) for the
separate evidence sealing, provenance and scoring requirements.
