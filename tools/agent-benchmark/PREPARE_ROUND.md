# Preparing a fresh author round

Freeze the durable driver recorder and explicit interruption helper along with
the other control sources. After actual final author audits, use a separately
root-authorized, readonly launch spec for session-isolated official supervision.
Never resume an interrupted slot or count an interruption receipt as scoring
proof. The actual driver passes its pinned execution start to offline summary
validation; app-only summaries stay unscored. See
[INTERRUPTION_AND_DURABLE_LAUNCH.md](INTERRUPTION_AND_DURABLE_LAUNCH.md).

Fresh Aperture SDKs also retain the generic checked browser example and its
standalone tsconfig under `/sdk/examples`. Authors copy both files together into
their `/work` project before compiling, so relative includes and public package
imports resolve against the preinstalled dependencies.

`prepare-round.py` creates isolated SDK and author lanes for round 003 or a later
round using the binary geometry v2 capture protocol. It consumes the latest built packages and public documentation. Finish the
full repository check and reference producer first; this script performs neither
operation and disables package lifecycle scripts while packing.

Review the planned paths without creating files or starting containers:

```sh
python3 -B tools/agent-benchmark/prepare-round.py --round 3
```

After reviewing the current validation and producer evidence, prepare the round:

```sh
python3 -B tools/agent-benchmark/prepare-round.py --round 3 --prepare \
  --validation-evidence /absolute/latest-check-summary.json \
  --reference-evidence /absolute/latest-producer-summary.json
```

All destinations must be new. A failed preparation retains its partial artifacts
and containers for inspection; it does not retry, overwrite evidence or activate
the configuration. Resolve an incomplete preparation before dispatching anyone.

The recipe packs all 14 publishable packages with pnpm 10.12.1, copies public
source, emitted JavaScript/types and the public authoring docs, and inventories
individual file hashes. The snapshot records the actual base Git HEAD and dirty
working-tree bytes; it does not invent a commit. A deterministic SDK archive and
exact preparation sources survive beside the input manifest. Inputs are checked
again after setup to reject concurrent source changes.

Both starters use Vite 8.0.16, TypeScript 6.0.3, Prettier 3.8.3, the same blank
JavaScript entry and no implementation adapter. Three.js remains 0.186.1. Aperture
uses the exact packed SDK through file dependencies and overrides. Each own
Docker container has two CPUs, 5 GiB memory and a PID limit of 128; mounts contain
only its own writable work, its own readonly reference, the public proxy CA, and
the Aperture SDK for that lane. Docker default proxy credentials remain private.
Dependency caches live at `/opt/aperture-pnpm-store` in each container, outside
the retained `/work` source tree. Exact dependency lockfiles are retained.

The common scene brief, reference, cameras, quality rubric, author budget and
scoring workload remain unchanged. Both lanes use `frozen-build-v2` request snapshots and diagnostic preview v3;
the common procedural instructions explain build freezing and retrieving an
existing response. No earlier result, transcript, scene source or benchmark
implementation advice enters the author prompt or SDK.

Review `benchmarks/agent-house-race-20261011/round-003/setup/preparation.json`,
the prompts, starter files, SDK snapshot and pending configuration. Freeze these
exact inputs before author dispatch. The recipe stages
`.aperture-env/agent-house-race/control/lanes-r003.pending.json`; it never writes
the active `lanes.json`. The root coordinator activates that configuration only
after all previous lifecycles and authors are closed, starts
`preview-service-v3.py`, and dispatches two fresh agents with `fork_turns: "none"`
and the same model. Historical round-002 setup remains immutable. Later pairs use a new round number.

The first engine in the six-trial sequence alternates by round. Each scored trial
still uses a fresh browser, 60 warmup frames and 120 measured frames. Diagnostic
previews never substitute for scored trials. The recipe's receipts establish
which inputs were supplied; the root reviews whether the validation/producer
evidence proves readiness before activating the lanes.

The fresh SDK additionally retains the generic public
`RENDERED_GEOMETRY_INSPECTION.md` and `HEADLESS_SOURCE_REALMS.md` guides. Public
SDK inputs exclude architecture audits, benchmark outcomes and scene source.
Both prompts disclose the same lossless binary transport, post-measurement export,
bounded native byte-copy instrumentation and finite readiness/navigation deadline.
See [binary geometry v2](GEOMETRY_V2.md). Preparation records the full protocol
object and selects `run-v2.mjs`; historical v1 recordings and sources remain
unchanged. `official-trials-v2.py` consumes a root-pinned launch plan and explicit
root readiness attestations. It never retries. All six closed attempts followed
by an ineligible summary are recorded as completed-ineligible with the summary's
nonzero exit status; missing/contradictory evidence or unresolved lifecycle
completion halts for reconciliation.

Fresh rounds additionally freeze `previewDiagnosticSchema:
"aperture.agent-house-diagnostic-preview.v3"` for both lanes. The shared prompt
explains the symmetric numeric export preflight after six canonical frames.
Successful previews still request nine frames and the same three views, with the
same deadlines and credited wait; failures return actual adapter/codec errors.
The input inventory pins the new client, helper, runner, coordinator and
[preview v3 disclosure](PREVIEW_V3.md), plus the unchanged numeric v2 codec and
inherited lifecycle/verified route. These diagnostics do not establish complete
visible coverage, native parity, full official manifest size or eligibility.
Historical preview v2 inputs and evidence remain unchanged.
