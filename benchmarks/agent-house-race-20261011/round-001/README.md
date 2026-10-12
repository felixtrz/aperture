# Round 001: exploratory house benchmark

Both independent blind judges preferred Three.js (`case-Q`) over Aperture
(`case-P`). Their mean visual scores were **7.6 versus 6.05**; mean geometry
scores were **8.0 versus 7.5**. They favored Three's continuous roof and car
silhouette, richer planting and more coherent materials. They also noted its
heavy foliage construction and several weaknesses in both scenes. Original
judgments: [r001-a](judges/r001-a.json), [r001-b](judges/r001-b.json).

This pair is **exploratory**. There is one final-build native capture per engine,
with 60 warmup and 120 measured frames, rather than the three fresh final-build
trials required by the method. Three's earlier successful preview used a different
build. The [protocol incident](protocol-incident.json), preview deadlines and late
results affect the authoring-time comparison. No combined score or stable lead
is established.

| Recorded measure                                |              Three.js |              Aperture |
| ----------------------------------------------- | --------------------: | --------------------: |
| Active author time, seconds                     |               738.042 |               820.079 |
| Raw author wall time, seconds                   |             1,638.302 |             1,125.482 |
| Credited preview waiting, seconds               |               900.260 |               305.404 |
| Recorded commands / unsuccessful commands       |                12 / 1 |                35 / 4 |
| CPU submission median / p95, ms                 |         2.515 / 4.935 |         5.315 / 8.200 |
| Queue completion median / p95, ms               | 3,686.455 / 4,925.920 | 3,667.690 / 4,716.255 |
| End-to-end median / p95, ms                     | 3,691.090 / 4,929.795 | 3,675.425 / 4,721.200 |
| Native submitted draws per measured frame       |                   143 |                    34 |
| Native submitted triangles per measured frame   |             1,757,299 |                53,709 |
| Unique authored vertices / triangles            |      153,883 / 51,359 |      161,121 / 53,707 |
| Render instances / instanced authored triangles |      37,075 / 879,905 |           32 / 53,707 |
| Degenerate instanced triangles                  |                    88 |                     0 |
| Exact submitted-position upload matches         |               67 / 67 |               32 / 32 |

These are descriptive observations from the running CPU SwiftShader applications.
CPU submission includes browser scheduling and Aperture's worker round trip;
queue completion is an elapsed native queue fence, not a physical GPU timing.
Submitted draws/triangles include pass and instance multiplicity. The scenes have
different detail and construction costs, and position-upload matches do not prove
index, shader-position or full world-transform parity. Aperture's normal worker
protocol was observed advancing snapshot frames 60–180 without worker errors;
the raw measurement retains its separate source-audit eligibility caveat.

Raw final measurements are [Three preview 02](authors/three-r001/previews/02-artifacts/attempt/measurement.json)
and [Aperture preview 03](authors/aperture-r001/previews/03-artifacts/attempt/measurement.json).
The [original summary](exploratory-summary.json) preserves complete timing
distributions, capture hashes, anonymous mapping and geometry limits. The blind
inputs retain canonical, left and rear views and the actual rubric.

All six preview requests survive: Aperture previews 01/02 failed and 03 eventually
rendered; Three previews 01/02 rendered and 03 expired without another browser
launch. Original author timeout events and final statements remain unchanged,
alongside late coordinator replies. Audited final source/dist/package/lock files,
public command bytes, native payloads, failure records, cleanup audits and frozen
per-attempt app/harness inputs are retained.

The [completed freeze](../freezes/round-001-completed.json) pins **2,351 files**
(144,846,324 bytes), with **64** actual working-tree source/build/harness input
joins. Its SHA-256 is
`3a10d2616b05281b8775b0560b7aa30f8bf5683d4fd14e3be88e61fe049544be`.
The [reviewed request](reviewed-seal-request.json) lists every exact path and
origin. Setup/common inputs retain their independent [input freeze](../freezes/round-001-inputs.json).
The freeze verifies byte integrity; it does not certify scientific validity or
scores. This README remains editable and covered by formatting.

The separate [shebang supplement](../freezes/round-001-shebang-supplement.json)
pins 17 original dependency-cache files (20,189 bytes) plus its
[reviewed request](reviewed-shebang-seal-request.json): 18 files, 39,393 bytes,
with 17 actual input-copy joins. Checking all 9,579 initially unsealed cache paths
with `Prettier.getFileInfo` identified these files as JavaScript via Node shebangs,
including unmarked Prettier and generated declaration blobs. Their complete
contents were inspected and matched to original audit SHA-256/size pins, SHA-512
content-address filenames and retained package-index integrity/path/size records.
No retained executable was run. The completed freeze above remains unchanged.

The remaining incidental dependency-store payloads are **retained but unsealed**:
9,562 files totaling 689,969,969 bytes, for which that check inferred no parser.
Their original finish/audit hash manifests remain unchanged. Across both completed
freezes, 135 individually inspected package-index JSON files and these 17 shebang
files are sealed. Two mutable lane locks and 14 already-frozen setup files are
excluded from the new batches. No directory glob exemption is introduced, and no
original evidence was reformatted.
