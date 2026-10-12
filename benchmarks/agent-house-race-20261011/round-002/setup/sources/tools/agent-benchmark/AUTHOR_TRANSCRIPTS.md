# Public author transcripts

The coordinator provisions separate private Docker workspaces and a private
`.aperture-env/agent-house-race/control/lanes.json`. Each fresh author receives
only its lane ID, assigned engine SDK and documentation, public prompt and common
reference image. Authors route public operations through `author-lane.py`:

```sh
python3 -B tools/agent-benchmark/author-lane.py LANE start
python3 -B tools/agent-benchmark/author-lane.py LANE note 'Public progress note'
python3 -B tools/agent-benchmark/author-lane.py LANE exec 'npm run build'
python3 -B tools/agent-benchmark/author-lane.py LANE preview
python3 -B tools/agent-benchmark/author-lane.py LANE feedback 1
python3 -B tools/agent-benchmark/author-lane.py LANE finish
```

The recorder retains exact shell commands, binary stdout and stderr, exits,
public notes, UTC and monotonic timestamps, public prompt/reference hashes,
preview requests and final source hashes. It never collects private model
reasoning or provider session files. Docker constrains the application filesystem;
the agent's host tool routing is cooperative and is not hostile actor confinement.

Commands are supervised with a Linux child subreaper so background descendants
are stopped before the next operation. Deadlines are bounded by the remaining
author budget. The coordinator services at most three preview requests serially
through the existing approved benchmark runner and adopted lifecycle. Waiting
for that coordinator is measured separately and credited back equally to both
author budgets; raw wall time remains intact. Authors receive only their own
capture or public error artifact paths. Public error text is also returned inline
(up to 64 KiB, with full artifact hash and a truncation indicator). `feedback 1`,
`feedback 2` or `feedback 3` retrieves an existing own response without spending
another preview or changing the budget. Each retrieval records public artifact
hashes; it never reads another author's response.

After an author finishes, the coordinator runs the offline audit without sharing
source or audit information with either author:

```sh
python3 -B tools/agent-benchmark/audit-authors.py LANE \
  --output /absolute/round001/author-audits/LANE
```

Keep audits outside the configured recorder `transcriptRoot`: for example, with
public records in `/absolute/round001/authors/LANE`, use the sibling
`/absolute/round001/author-audits/LANE`. Do not place an audit inside its author
records or writable workspace.

The audit requires a complete hash-chained event stream and final manifests. It
checks command records against exact stdout/stderr hashes, public prompt and
reference pins, monotonic budget and preview-wait accounting, finish counters,
and every source/build file against the finished workspace. It copies all source
and built assets except `node_modules` and `.git`, copies public operational
records, and reads the retained files back to verify their bytes. The output is:

```text
audit-final/
  audit.json
  transcript.md
  source/                 # complete source and built assets
  public-records/          # manifests, events, commands, preview receipts/captures
```

Files are create-only and become read-only after fsync. An existing output
directory is refused. A failed new attempt retains `audit-failure.json` and any
partial copies, which are never upgraded or overwritten. Final native trials
should consume `audit.json`'s `retainedBuiltAppRoot`, preserving the exact authored
application independently of its original workspace.

`audit.json` uses `aperture.author-audit.v1`, with `status: "verified"`, verification
checks, public record hashes, final source pins and retained file hashes. It
reports raw wall time, preview waiting, active budget time, command durations,
exit counts, and exact repeated-command counts. Its retry counter counts only an
identical shell script whose preceding identical invocation failed; other repair
attempts are not inferred. `transcript.md` shows all public commands and outputs
without truncation; binary records remain authoritative for non-UTF-8 output.

Focused offline tests use temporary inputs and fake container transport:

```sh
python3 -B -m unittest discover -s tools/agent-benchmark -p 'test_*.py' -v
```
