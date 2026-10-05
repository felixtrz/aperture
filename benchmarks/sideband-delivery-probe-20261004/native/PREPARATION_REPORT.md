# Native sideband fixture preparation result

**Ready for independent review; native execution remains unrun.**

The final CPU preparation run passed **7/7 tests**, with zero browsers and zero
HTTP servers. It exercised all three cases through actual compiled extraction,
source serialization, SAB buffers and the mirror. An additional asynchronous
MessagePort integration used the actual compiled renderer/scheduler and verified:

- before-poll: frame/local-mirror pairs `(1,1) → (2,2)`;
- late-delivery: `(1,1) → (2,1) → (3,2)`, retaining same-frame deduplication;
- cold changed: `(2,1)`, with source version 2 and a fresh mirror's first ready
  transition at local version 1.

All retain exactly one snapshot notification. Changed CPU-submitted bytes equal
the actual changed source mesh. Native pixels are not yet available or claimed.

Evidence: [cpu-002.log](cpu-002.log). The first six-test preparation pass remains
in [cpu-001.log](cpu-001.log); its source pins and the exact two subsequently
extended source files remain in `source-pins-candidate-001.json` and
`retained-candidate-001/`. Their byte hashes were checked against that first pin
manifest. No failed native attempt exists.

## Input and acceptance checks

The frozen candidate [source-pins.json](source-pins.json) binds **6,581 files** and
**48 native-runtime symlink targets**, including exact inherited sources/compiled
inputs/runtime, preceding CPU evidence and the new executable fixture. SHA-256:

`64f8e9f3a1042ed36d2c230ad8be98afff95556cfb10b40a1015cf3bf6125d66`

Static traversal resolved **798 browser/worker module bodies** to pinned inputs
using the actual serving/rewrite functions, without opening a server. Fifteen
explicitly synthetic corruptions reject: frame, mirror version, extra snapshot,
source bytes, uploaded bytes, uninitialized or uncertain bytes, stale submission,
draw count/method, index format, missing upload, WebGL, absent native proof and
missing fence. Synthetic pixel controls reject unequal cold pixels and missing
visible change. Permit controls reject the preparation begin and mismatched
session, attempt, pin digest or boot. These synthetic inputs are never native
results.

## Exact minimal native plan

The [README](README.md) supplies the full bounded commands and permit fields:

1. `before-poll`, `attempt-001`: baseline and changed captures.
2. `late-delivery`, `attempt-001`: baseline, early old-mirror and next-frame
   converged captures; stationary deduplication is recorded without another image.
3. `cold-changed`, `attempt-001`: one fresh changed-state capture.

That is **three native sessions, six PNGs**. Each needs its own independently
verified fresh true begin with operation `run-sideband-native-SESSION`, matching
canonical spec and this exact source-pins digest. The runner checks the bound
task/incarnation/current boot and direct `runtime_pressure.py` parent, then uses
only `runVerifiedScene` with the existing pinned runtime. It cannot use the
preparation permit.

After successful native completion, `compare.mjs comparison-001.json` will require
four exact decoded-RGB equalities and a visible baseline/change difference,
while revalidating consumed frames, actual native submission joins and uploaded
asset bytes. None of those native conclusions is asserted by this preparation.

The late-message ordering intentionally permits the early old-mirror frame and
requires convergence on the next SAB frame. There is no cross-frame atomicity,
automatic demand-sideband wake, engine-fix, performance, GPU-readback or artistic
score claim. Original CPU evidence, engine and prior frozen benchmarks are unchanged.
