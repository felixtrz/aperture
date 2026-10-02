# Benchmark evidence archives

Python 3.10+; standard library only. No browser launch, network access, credential
lookup, Git mutation, rendering, or score generation occurs in this utility.

```sh
python3 -m unittest discover -s tools/benchmark-evidence -p 'test_*.py' -v
python3 tools/benchmark-evidence/archive.py seal \
  --spec /tmp/reviewed-run.json --source /tmp/reviewed-evidence \
  --archive-root benchmarks/evidence/runs
python3 tools/benchmark-evidence/archive.py verify \
  benchmarks/evidence/runs/RUN-ID
# Required when consuming a run for a scored comparison:
python3 tools/benchmark-evidence/archive.py verify \
  benchmarks/evidence/runs/RUN-ID --require-scored
```

The source directory contains **only declared artifact files**, not the run
specification. Sealing copies actual bytes into a new run directory and writes
`manifest.json` plus `manifest.sha256`. An existing run ID is never overwritten,
resumed, or upgraded. Corrections and later evidence belong in a new run, with
provenance naming the earlier run and explaining the relationship. Do not edit a
sealed run, even to fix its description.

## What to preserve before a VM disappears

Start the inventory at the first attempt, not after selecting a winner. Retain
failed and abandoned attempts, all camera views and iterations, and heldout views.
Copy these **actual files**, not a prose reconstruction or a local path to them:

- `sources/`: exact authored source, generated meshes/assets and dependencies
  needed to reconstruct each attempt; include changed versions for each attempt
- `references/`: original reference images, models, brief, rubric inputs and any
  other supplied references, with provenance and permission to publish
- `settings/`: complete effective camera transforms, dimensions, render settings,
  scene inputs, seeds, edit parameters, evaluation rubric and blind-review protocol
- `pins/`: source commit, dependency lockfiles, runtime/package versions, renderer
  route and exact approved flags, device/backend information and environment pins
- `renders/`: actual images from every attempt and view, including rejected
  versions; preserve filenames or document an explicit original-to-archive mapping
- `diagnostics/`: actual renderer verification output, failures and check results
- `editchecks/`: actual edit-check inputs/results, including failed checks
- `judgments/`: authentic frozen judgments; preserve outputs before unblinding
- `transcripts/`: available authentic **visible** user/agent/tool conversation
  exports, with source provenance; never protected reasoning, hidden agent logs,
  credential stores or guessed/reconstructed dialogue
- `provenance/`: origin and recovery records, original hashes/names, source
  revisions, candidate-to-blind-label mapping and evidence limitations

Shared artifacts may name several attempts. Include every render associated with
its attempt. A score or judgment must point to the reviewed renders through its
content/provenance. Archive the blind protocol and separately retained identity
mapping; keep identities out of material supplied to a blind judge. For new cloud
renders, use only `pnpm run render:cloud` or `runVerifiedScene` as required by
`AGENTS.md`. This tool never renders or starts browsers.

No file's extension or declared category proves that it contains the original
source/reference. A summary in `sources/` does not satisfy this protocol. Store
summaries as provenance and explicitly declare the source bytes missing.

## Run specification (schema version 1)

The specification is strict JSON: unknown fields and duplicate keys fail.
This is its shape, with placeholder values **to replace**, not recovered evidence:

```json
{
  "schema_version": 1,
  "run_id": "unique-run-id",
  "mode": "exploratory",
  "created_at": "2026-10-02T00:00:00Z",
  "source_revision": null,
  "attempt_inventory_complete": false,
  "review": {
    "reviewer": "reviewer identifier",
    "reviewed_at": "2026-10-02T00:00:00Z",
    "no_secrets_or_private_content": false,
    "only_authentic_evidence": false,
    "all_known_attempts_and_available_artifacts_listed": false
  },
  "transcripts": {
    "status": "unavailable",
    "note": "Explain what authentic visible export is unavailable and why"
  },
  "attempts": [],
  "artifacts": [
    {
      "path": "provenance/recovery.json",
      "attempts": [],
      "origin": {
        "kind": "authored-record",
        "description": "New recovery record; never substitute this for lost source",
        "recorded_at": "2026-10-02T00:00:00Z"
      }
    }
  ],
  "gaps": [
    {"scope": "run", "category": "attempts", "reason": "Original inventory unknown"},
    {"scope": "run", "category": "source_revision", "reason": "Original source commit unknown"},
    {"scope": "run", "category": "sources", "reason": "Original source bytes unavailable"},
    {"scope": "run", "category": "references", "reason": "Original references unavailable"},
    {"scope": "run", "category": "settings", "reason": "Effective settings unavailable"},
    {"scope": "run", "category": "pins", "reason": "Original environment pins unavailable"}
  ]
}
```

- IDs are lowercase ASCII letters/digits/hyphens, maximum 80 characters; `run` is
  reserved as a gap scope. Timestamps are actual UTC timestamps ending in `Z`
- `source_revision` is the exact 40-character Git SHA, or `null` plus a gap; never
  use the current recovery commit as a substitute for an unknown historical one
- Each attempt is `{"id":"attempt-001","outcome":"rendered","note":"..."}`.
  Outcomes: `rendered`, `failed-before-render`, or `incomplete`. Do not infer unknown
  attempt IDs or counts. `attempt_inventory_complete` must truthfully state whether
  the full attempt inventory is known
- `origin.kind` is `source-file` for sources, `reference-file` for references,
  `render-output` for renders, `tool-output` for diagnostics/editchecks,
  `blind-judge-output` or `judge-output` for judgments, and
  `visible-transcript-export` for transcripts. Settings/pins/provenance may use
  `source-file`, `authored-record` or `tool-output`
- `origin.description` identifies the actual source and any renaming/redaction;
  `recorded_at` describes capture/export/recovery time, not an invented original
  creation time. Put longer provenance in an archived file
- `transcripts.status` is `available`, `unavailable`, or `not-applicable`, with an
  explanation. `available` requires authentic export bytes. Do not invent a
  transcript because one is unavailable, or call a summary a transcript
- A gap has `scope` (`run` or an attempt ID), `category` (an artifact directory,
  `attempts`, or `source_revision`), and `reason`. Record partial-category losses
  too: two surviving images do not erase a missing third view
- All categories use allowlisted file types in `archive.py`. No zip/tar files,
  opaque directory dumps, shell state, hidden files or credential paths. Save
  diagnostic text with `.txt` rather than globally ignored `.log` names

## Exploratory versus scored gate

Every run needs at least one real artifact and a completed content review.
Missing expected categories must have explicit gaps; missing a **declared file**
is always a hard error, even for exploratory recovery. A path, URL, report,
checksum, thumbnail or summary never replaces unavailable original bytes.

The `scored` gate additionally rejects every zero-byte artifact and requires no
gaps, a known complete attempt inventory,
a source revision, at least one rendered attempt, no incomplete attempts, original
source/settings for every attempt, diagnostics/editchecks for every attempt,
render images and blind judgments for every rendered attempt, and run-level
reference/pin/provenance artifacts. A documented `failed-before-render` attempt
needs no invented image or judgment; it still needs source, settings, diagnostic
and edit-check evidence. A never-run check should produce an honest explicit
not-run record, not a fabricated success result.

An unavailable visible transcript is explicitly disclosed but does not itself
prevent the scored gate: only accessible authentic exports can be preserved.
The gate validates declared evidence, not scientific validity, fairness, numerical
correctness or whether the declared provenance is truthful. It does **not** create
scores, certify prior scores, or prove that no unknown attempts were omitted.
Nonempty bytes and a valid manifest still cannot prove semantic authenticity.
Preserve genuinely empty original files in an exploratory archive with their
limitations; do not pad or fabricate contents merely to pass this gate.
Use `--require-scored` wherever a downstream comparison requires this gate.
An exploratory archive, including historical recovery, never passes that flag.

## Mandatory content review before sealing and publication

A human or agent must inspect every selected file and all specification metadata,
including image pixels and text embedded in images. Only then set all three review
attestations to `true` and record the reviewer and review time. Confirm:

1. No passwords, access tokens, API keys, private keys, cookie/session material,
   credential-store paths, protected reasoning, private internal notes or unrelated
   personal information are present; review URLs, logs, code comments and exports
2. The originals are authentic and permission covers putting their actual content
   in this repository. Do not publish third-party licensed/private files without
   appropriate authorization. Never copy raw credential directories or hidden logs
3. All known attempts and available authorized artifacts are included; missing,
   withheld, redacted or oversized evidence is explicitly disclosed. A redacted
   derivative must be labeled as such with a gap for any original bytes not archived;
   retain no secret hash that would itself expose sensitive material
4. Sources/references are actual files, judgments are authentic and genuinely blind
   where claimed, and visible transcript exports are not paraphrases or hidden
   reasoning. Preserve original numeric scores only when actually present; never
   invent them to fill a schema or turn qualitative findings into numbers

This is a mandatory review attestation, **not a comprehensive secret detector**.
Category/path allowlists and image-container checks cannot identify all secrets,
private content, counterfeit sources, undisclosed attempts or fabricated judgments.
If review cannot establish safety/authenticity, stop and disclose the limitation.

## Limits, immutability and integrity

Hard limits: 16 MiB per artifact, 64 MiB total artifact bytes per run, 512 artifacts,
2 MiB manifest, 240-character artifact paths, 100-character path components.
Oversized artifacts fail before output allocation, naming the file/size/limit where
applicable. Nothing is silently omitted or replaced by a local-only reference.
Do not lower image quality, discard attempts, or split a single run into misleading
complete subsets merely to pass. Report the full oversized inventory and obtain a
reviewed policy/tool change or an explicitly approved durable storage protocol;
until then archival publication is blocked and the evidence is not complete.

Sealing is create-only; after copying every reviewed byte it writes SHA-256 and byte
counts for every file, then the manifest checksum last. Interrupted/incomplete runs
fail verification. Verification rejects missing, modified, extra, case-colliding,
traversing, symlinked, hardlinked, special and non-allowlisted files. Regular files
(including the manifest and checksum) must have exactly one filesystem link so an
outside alias cannot mutate the archive. It also checks basic PNG
chunk/CRC structure and JPEG/WebP container markers; it does not decode or judge
rendered pixels. No filesystem permissions prevent an outside editor from changing
files; keep the workspace quiescent during sealing/verification.

The adjacent checksum detects accidental manifest changes. Anyone who rewrites
both the manifest and checksum can defeat a self-contained checksum: anchor the
manifest digest in a verified Git commit and supply `--manifest-sha256` on recovery.
Git publication and branch protection provide the durable version boundary.

## Publication and fresh-machine recovery

1. Run focused tests above and the repository's required aggregate checks; report
   failures or blocked checks separately, never call focused tests a full pass
2. Seal and verify each run. Inspect every selected file and `git diff`/new-file
   list for the content-review concerns above. `benchmarks/evidence/.gitignore`
   deliberately overrides the generic nested `references/` ignore rule
3. Stage **all** manifest-listed files, the manifest and checksum; inspect
   `git ls-files --stage benchmarks/evidence/runs/RUN-ID`. Compare that listing
   with the manifest. Ordinary Git blobs are required: LFS pointers, ignored files,
   local-only links and uncommitted bytes are not a successful archive
4. For this project, publish only through the authorized publishing-only Codex job
   using the GitHub connector in the Aperture environment. Check upstream first,
   honor branch protections, and use no force push, merge or release. This utility
   does not commit or publish anything
5. Verify the exact remote commit contains the complete tree and byte-identical
   artifacts. Verify available required checks for that exact commit; disclose any
   unavailable or blocked check. A successful local seal is not proof of a push
6. On a fresh machine, fetch/check out that verified commit, obtain its trusted
   manifest digest, and run (substitute actual run ID and trusted digest):

   ```sh
   python3 tools/benchmark-evidence/archive.py verify \
     benchmarks/evidence/runs/RUN-ID --manifest-sha256 TRUSTED-SHA256
   ```

7. Verify actual remote/fresh-checkout bytes, not only a GitHub file listing. Copy
   source/settings/pins from the archive into a new working run when reproducing;
   never render into or mutate the sealed directory. If evidence is exploratory,
   report its gaps before making any comparison. Exact replay may still depend on
   runtime/device availability even when every archived byte is recoverable

The synthetic unit tests use temporary directories outside the checkout and never
create benchmark evidence or numeric scores in `benchmarks/evidence/runs/`.
