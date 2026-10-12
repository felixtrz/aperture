# Preparing a fresh author round

`prepare-round.py` creates isolated SDK and author lanes for round 002 or a later
round. It consumes the latest built packages and public documentation. Finish the
full repository check and reference producer first; this script performs neither
operation and disables package lifecycle scripts while packing.

Review the planned paths without creating files or starting containers:

```sh
python3 -B tools/agent-benchmark/prepare-round.py --round 2
```

After reviewing the current validation and producer evidence, prepare the round:

```sh
python3 -B tools/agent-benchmark/prepare-round.py --round 2 --prepare \
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
scoring workload remain unchanged. Both lanes use `frozen-build-v2` previews;
the common procedural instructions explain build freezing and retrieving an
existing response. No earlier result, transcript, scene source or benchmark
implementation advice enters the author prompt or SDK.

Review `benchmarks/agent-house-race-20261011/round-002/setup/preparation.json`,
the prompts, starter files, SDK snapshot and pending configuration. Freeze these
exact inputs before author dispatch. The recipe stages
`.aperture-env/agent-house-race/control/lanes-r002.pending.json`; it never writes
the active `lanes.json`. The root coordinator activates that configuration only
after all previous lifecycles and authors are closed, starts
`preview-service-v2.py`, and dispatches two fresh agents with `fork_turns: "none"`
and the same model. Replace `--round 2` with `--round 3` for the next fresh pair.

The first engine in the six-trial sequence alternates by round. Each scored trial
still uses a fresh browser, 60 warmup frames and 120 measured frames. Diagnostic
previews never substitute for scored trials. The recipe's receipts establish
which inputs were supplied; the root reviews whether the validation/producer
evidence proves readiness before activating the lanes.
