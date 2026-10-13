# Capacity admission and bounded cache maintenance

An interrupted run never becomes completed by age or by an application outcome.
Future policies may explicitly pin root-authorized interruption receipts solely
for quiescence checks. Raw ACTIVE manifests, original audits and old slot states
remain untouched; cache targets still require genuine completion/registration.
See [INTERRUPTION_AND_DURABLE_LAUNCH.md](INTERRUPTION_AND_DURABLE_LAUNCH.md).

Capacity is infrastructure, not a score, scene limit, author-time extension or
permission to retry. Defaults retain the runtime wrapper's strict 2-GiB floor
and ordinary cleanup's 24-hour policy. The opt-in path requires an exact readonly
root-reviewed policy SHA; it never deletes unknown/nested files, source, evidence,
dependency stores or other registrations.

## Policy and phases

`capacity.py` validates `aperture.runtime-capacity-policy.v1`. Required fields:

- `status: "root-reviewed"`, `root`, `runtimeRoot`, exact `rootMarker`,
  `filesystemDevice`, `floorBytes: 2147483648`, `createdNs`, `expiresNs`;
- external `stateDirectory`, `helperSource` with exact path/bytes/SHA of the
  unchanged approved helper, and frozen `sourcePins` for all capacity dependencies;
- `declaredReservesAcknowledged: true`, `externalGrowthReserveBytes`,
  `cacheLifetime: "retained" | "controlled-post-close"`;
- ordered `slots`: `id`, anchored `jobPattern`, `retainedReserveBytes`,
  `peakReserveBytes`, optional `expectedInputBytes` and `createsPinnedChromium`;
- `maintenance`: explicit `enabled`, bounded `maximumPasses`,
  `maximumRetirements`, and at most 40 explicit `initialKnownRuns`.

Operational reserves cover all remaining phases: setup/dependency/SDK/archive
growth, both authors and up to three previews each, six official artifacts/input
copies, finish/audit copies and judge inputs/logs. Include filesystem rounding,
runtime sidecars, reports and browser profiles. Existing occupied files already
reduced observed free bytes. Separate filesystems need separate policies; the
current implementation refuses a different scratch device and callers must place
accounted outputs on the reviewed device. Declared reserves are not quotas.

Use distinct preparation and post-setup author policies: the former budgets
outstanding setup, and the latter reobserves actual free after setup is complete
without counting that completed allocation again. `prepare-round.py` accepts
both `--capacity-preparation-policy`/`--capacity-preparation-policy-sha256` and
`--capacity-policy`/`--capacity-policy-sha256`. It creates before-preparation and
before-author admission receipts, freezes the common policy/configuration, and
does not activate authors. `author-lane.py start` checks the frozen whole-round
receipt and fresh actual free bytes before starting either clock.

An independent receipt can be prepared without launching a process:

```sh
python3 -B tools/agent-benchmark/capacity.py \
  --policy /absolute/readonly-policy.json --policy-sha256 REVIEWED_SHA \
  admit-phase --output /absolute/new-create-only-admission
```

Admission sums remaining retained growth, maximum serialized transient growth,
new cache allocation and the unchanged floor. It credits **zero prospective
reclamation**. `controlled-post-close` budgets one cache peak at the first
remaining slot that actually creates Chromium, including mixed CPU/native
schedules. This requires verified completion/checkpoint/maintenance before the
next slot, with fresh admission each time; it is not a promise that cleanup will
succeed. `retained` budgets every newly created cache.

## Runtime/coordinator integration

Before `run`, the existing runtime wrapper accepts optional
`--capacity-policy`, `--capacity-policy-sha256`, `--capacity-slot`, and
`--capacity-retained-minimum-bytes`. All policy/slot arguments are required
together. The wrapper checks the old floor, serializes the capacity session,
observes a fresh admission, executes the existing descendant-safe lifecycle,
captures original completed MF/audit bytes externally, then optionally runs one
bounded maintenance pass. No hash/maintenance work overlaps measured frames.

Preview slots consume queued request order independent of engine. Current
request-time frozen-build bytes are verified by the existing recorder; excess
above the common estimate increases the slot minimum. Official slots follow the
preselected six-attempt order. The final official policy/argv are frozen after
actual audited app sizes are known, and the driver refuses a minimum below those
fresh inputs. Unused previews are handled by a separately reviewed final phase
policy, not fake completed preview slots or altered author counts.

The exact helper retains its production roots/runtime pins, 40-file maximum,
8-GiB stop and one-hour fresh plan. Only initial explicitly authorized caches or
this policy's actually completed runs are eligible. An unreachable 8-GiB target
is truthfully `completed-bounded-plan-exhausted`; successor admission uses actual
post-free bytes, not a projected total. A failed/partial maintenance or unresolved
lifecycle leaves a sticky blocker. Never retry, reset state, force completion,
lower the floor or prune other files to make admission pass.

## Original native evidence and later retirement

`checkpoint_manifest` returns the immutable **original** completed manifest bytes
for preview/official proof copies. If the live MF changed, it joins original,
exact before/after/current SHA and cache-only registration/provenance changes.
Retirement may occur in a later slot; lookup is bounded to the frozen policy's
own maintenance directories, not a broad receipt search. Job/state/timestamps/
exit/recreation and all other registrations must remain unchanged. The native
verifier's observed executable hash remains historical evidence after that
regenerable cache is removed; do not regenerate or replace old proof bytes.

Capacity refusal/error is preserved as actual infrastructure feedback. Original
request, author allowance, raw wall time and existing equal verified preview wait
credit survive. No lost preview is silently retried. A post-dispatch asymmetric
incident still affects eligibility; successful cleanup does not repair history.

## Guarantee limits and validation

The existing preview freeze caps 4096 files/directories, 64 MiB per file and
256 MiB total and checks inode/byte changes. Command scripts/time are bounded;
future author writes/stdout, final source aggregate, profiles and unrelated
writers are not hard quota bounded. Conditional operational admission must state
those limits and show the alternative enforced-cap deficit/unbounded terms.

CPU tests use fresh synthetic marked roots only, never real cache retirement.
They cover arithmetic/mixed slots, actual close/checkpoint/retirement, preserved
unknown data, sticky failure, serialization and fresh actual input increases.
Real native activation requires separately scheduled root review; estimates or
CPU fixtures are not native/scoring proof. Retain every failed stage and exact
argv/stdout/stderr/exit/MF/maintenance bridge.
