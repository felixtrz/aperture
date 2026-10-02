# Resumable recovery and work routing

The ten-minute check is a router, not a substitute for work. Preserve healthy
ongoing work. Otherwise select the first unmet stage, execute its bounded action,
verify its result, retain evidence and checkpoint the next action. Continue between
scheduled checks. Do not repeatedly return the same missing-path status.

## After verified VM loss

Automatically reclone `https://github.com/felixtrz/aperture.git` using the user's
standing recovery authorization. Read `tools/coordination/ADOPTION.md`, restore the
latest remotely verified sanitized checkpoint into a fresh private authority and
reconcile/bound old work. Never reuse a live authority or reset an unexplained
missing/corrupt/busy state. A copied progress receipt is not current VM validation.

Then run from the restored checkout:

```sh
python3 -B tools/recovery/setup.py status
# Under the adopted claim/begin protocol, perform ONE selected stage:
python3 -B tools/recovery/setup.py advance
```

Only on an authorized new setup with the fixed disposable root genuinely absent,
add `--allow-new-root`. Existing unmarked or invalid roots are refused. The helper
never resets roots or locks. Repeat `status` and `advance` until `next_stage` is
`benchmark`. Each stage must clear before the next starts:

1. **pnpm:** Corepack uses writable checkout-local `COREPACK_HOME` and XDG
   directories and explicitly runs `pnpm@10.12.1`. The ambient `pnpm` executable
   may be a different version; do not assume its version matches the repository. Existing dependency stores in the two known local recovery layouts are reused; an unknown store is preserved and blocks installation before any replacement prompt
2. **dependencies:** frozen-lockfile installation, initially ignoring scripts;
   then the four reviewed dependency rebuild targets and TypeScript/Vite probes
3. **build:** all thirteen Aperture packages, with resulting artifact hashes
4. **runtime:** exact `playwright-core@1.60.0` and `@sparticuz/chromium@153.0.0`
   using the committed runtime lockfile, with copied rather than hardlinked bytes
5. **render:** the retained spinning-cube example through `runVerifiedScene`,
   inside `runtime_pressure.py run`; native WebGPU proof, screenshot, no WebGL,
   browser shutdown and descendant-safe lifecycle completion

The first cold recovery on 2026-10-02 verified pnpm 10.12.1, installed 761 locked
packages in about four minutes, built thirteen packages and rendered native
SwiftShader WebGPU with 63 draws/22 submissions and no GPU errors or WebGL attempts.
This is environment verification, not a scored head-to-head benchmark.

## Progress, evidence and interruption

Local machine progress is `.aperture-env/recovery-state.json`. It is atomic and
contains current boot/input identity, stage status and artifact hashes. Status
rechecks those bytes. Changed boot/inputs or missing bytes require revalidation.
A same-boot running/ambiguous stage never becomes permission to retry; inspect the
actual worker, process tree, lifecycle record and effects first. Source changes do
not override that gate. A lock prevents concurrent local setup stages. This progress
file is not a replacement for the adopted coordinator or a dispatch permit.

Each stage produces a receipt under `benchmarks/evidence/staging/recovery-*`.
Retain failures as well as successful results. Review and seal useful evidence with
`tools/benchmark-evidence/archive.py`, then publish actual source/receipts/images,
the sanitized coordinator checkpoint and workflow state through the GitHub connector directly in the current dot conversation. Verify exact remote ref/tree/bytes before calling the stage durable.
Do not publish caches, node_modules, private capabilities, credentials or hidden
reasoning. Locally completed work that has not been published remains local-only.

## Project stages after setup

Maintain a versioned run manifest with: stage, status, exact input revisions and
hashes, owner/claim, outputs and evidence hashes, blocker, next action and actual
active-time classification. A stage is complete only when its required evidence is
verified and durably published. Missing evidence becomes a rerun, not reconstructed
results. The agent router applies this ordered cycle:

| Stage                 | Required action and exit evidence                                                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Benchmark preparation | Freeze candidate/control sources, equal settings/models/budgets, approved references, rubric and edit/alternate-view plan                            |
| Benchmark execution   | Separate authors, both real WebGPU renderers, all attempts retained; full authentic visible transcripts before any scored claims                     |
| Analysis              | Independent blind judgments and review of every available attempt; distinguish agent variance, environment and demonstrated engine gaps              |
| Queues                | Deduplicate patch-compatible fixes, minor-compatible capabilities, major breaking plans; retain maintenance/feature categories and acceptance checks |
| Implementation        | Implement only supported compatible work, test it, publish exact source and checks; no quota stopping condition                                      |
| Rerun                 | Benchmark the immutable result against frozen controls; preserve previous evidence                                                                   |
| Scenario progression  | When actionable gaps close, increase controlled scene complexity and retain earlier regressions                                                      |

If a gate blocks a scored run, preserve it explicitly and do useful preparation or
clearly labeled exploratory work. Never substitute synthetic tests, hashes without
surviving bytes, self-grading, or protected-session reads for real evidence.

## Lifecycle recovery limitation

`cleanup.py` 2.2.0-recovery-lifecycle reconstructs the tested 2.0.1 backup's safe
24-hour cleanup and subreaper lifecycle, adding post-quiescence pinned-runtime
registration. It is not the lost 2.1.1 bytes. Source backup SHA-256 was
`abb81a1e232b4d8979616e49606d3638da27143e2438c25df6fd85a639db376f`.
The runtime wrapper registers only the pinned flat Chromium executable after all
descendants exit; unknown/nested data is preserved. It performs no pressure deletion
and refuses new render lifecycles below 2 GiB free. Pressure retirement is a separate
remaining recovery item, not falsely claimed restored. Ordinary cleanup still needs
the exclusive coordinator cleanup claim, preview and fresh bounded apply approval.
Keep source and unique evidence outside the disposable root. No broad `/tmp` cleanup.
