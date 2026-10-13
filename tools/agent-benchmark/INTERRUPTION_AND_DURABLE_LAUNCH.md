# Explicit interrupted runs and durable official launches

An application outcome and a wrapper completion are different evidence. An
interrupted supervisor may leave valid application captures while its original
manifest stays `active`. Preserve that manifest, its start-only audit, every
capture and the old capacity slot. Never manufacture a wrapper exit, completion,
reaping, score, cache registration or retirement.

`tools/recovery/interruption_resolution.py` creates separate immutable evidence
outside scratch. It requires a readonly, exact SHA-pinned authorization with:

- `schema: "aperture.interruption-resolution-authorization.v1"`,
  `status: "authorized"`, `authorizedBy: "/root"`;
- `interruptionKind: "supervisor-interrupted"` for an observed failed
  supervisor, or the narrowly supported `"command-not-launched"` below;
- exact `root`, `rootMarker`, `rootIdentity: {device, inode}` from the actual
  opened root directory, `run`, new `outputRoot`, `helperSource` file pin;
- `rootReview` file pin and `supervisorPids` whose failed kernel statuses and
  PID/start-time/session/group identities were actually observed;
- `applicationPid` from the same ownership snapshot. An application exit is
  reported only when the root review witnessed that same instance as a zombie
  with a terminal kernel wait status; otherwise it stays `null`;
- `nativeApplication: {inputs, outcome, verified}` exact file pins when the
  review retains those primary records. They must join the same native run and
  outcome, not merely repeat a reviewed status string.

The root review uses `aperture.root-reviewed-interruption-observation.v1` and pins
the original ACTIVE manifest/audit, their preserved copies, initial ownership
snapshot, same boot, actual process closure and own application outcome. Its
wrapper/driver completion, wrapper reaping, old capacity completion, scoring,
source rewriting and root signaling fields must remain false. Missing evidence
fails closed. The helper checks only `/proc/*/stat` identities and boot identity;
it never reads process environments or command lines, signals processes, or uses
a stale-age predicate. The start audit must identify the selected root and occur
at or after the manifest's creation.

`command-not-launched` supports only an exact `FileNotFoundError` from the held
`cleanup.run_command` Popen launch branch. Its audit must contain the original
start followed by `run-error`, `phase: "launch"`,
`reason: "FileNotFoundError"`, `completion_persisted: false`; the ACTIVE
manifest's registered files must be empty. Authorization and review join exact
`launchEvidence` pins for `command`, `result`, `stdout`, `stderr`,
`cleanupSource` and `runtimePressureSource`. The recorded wrapper command's
`--` suffix, `childArgv`, root, job and retained logs must agree with the review's
`attemptedCommand` and `missingExecutable`. The absolute executable must still
be absent. The actual recorded wrapper return is 2; it is retained separately
from an application or completed lifecycle exit. This case requires empty
`supervisorPids`, null `applicationPid`/application outcome/kernel status and
`managedCommandLaunched: false`. It claims no managed command was returned by
Popen, not that no transient internal fork ever occurred. Other launch errors,
waiting failures, timeouts and ambiguous records fail closed. Both interruption
kinds preserve the raw ACTIVE manifest and cannot resume the old run.

```sh
python3 -B tools/recovery/interruption_resolution.py \
  --authorization /absolute/root-authorization.json \
  --authorization-sha256 EXACT_SHA \
  --output /absolute/new-resolution
```

Resolution requires the actual exclusive lifecycle and registration locks, no
live known-owned session/descendant, unchanged original bytes and two stable
observations. Zombies mean execution ended; they do not mean a new caller reaped
them. A reused PID is distinguished by start time and is never signaled. The
receipt says `resolved-interruption`, `wrapperCompleted: false`,
`wrapperReaped: false`, `wrapperExitCode: null`, `resumePermitted: false` and
`scoringEligible: false`. No scratch or old slot state is rewritten.

Future root-reviewed capacity policies and official plans explicitly carry the
same `resolvedInterruptionReceipts` array of exact `{path, bytes, sha256}` pins.
There is no ambient receipt discovery. Under the exclusive lock, future
quiescence revalidates authority, original bytes, boot and process closure. Only
quiescence accepts the effective resolved state. Completed-manifest/audit,
checkpoint, registration, cache selection and scoring requirements remain
unchanged. Use a new capacity state directory and fresh policy; do not resume the
interrupted slot or substitute its application outcome. Pressure cache targets
still require raw genuinely completed manifests and exact registrations.

For fresh official rounds, `durable-official-driver.py launch` starts a separate
session containing the recorder and driver. A readonly launch spec contains
`schema: "aperture.durable-official-driver-launch.v1"`, exact `plan` and
`authorization` file pins, new `outputRoot`, the current physical
`pythonExecutable`, and `recorderSha256`. The held active public driver is used so
its helper imports match the policy's actual source paths; dispatch-frozen copies
remain joined independently. The driver must be readonly before dispatch.

```sh
python3 -B tools/agent-benchmark/durable-official-driver.py launch \
  --spec /absolute/launch-spec.json --spec-sha256 EXACT_SHA
```

The launch leaf records source/spec/command inputs and a real PID/start-time/PGID/
SID handshake before returning. Detached supervision uses retained regular files,
not a PTY or pipe to the transport. The recorder actually waits for the driver
and writes its actual exit; the driver still waits for every adopted native
wrapper. There is no outer lifecycle wrapper. A missing handshake remains
unknown and blocks another launch; it never triggers a signal or retry. Monitor
the retained files and exact numeric process identities. Session isolation
protects against transport/session loss, not host OOM, reboot or targeted
supervisor SIGKILL. Public records are cooperative evidence, not adversarial
confinement or provider-private transcripts.

Formal component scores additionally require the selected official execution
start pin and all six genuine operation/lifecycle/capacity joins. Application-only
summaries retain raw metrics but remain unscored. Interruption receipts never
serve as this proof; see [SCORE_ROUND.md](SCORE_ROUND.md).
