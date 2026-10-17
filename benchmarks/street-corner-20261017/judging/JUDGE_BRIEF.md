# Independent visual judging brief

Inspect only the anonymous image set supplied by the coordinator: reference.png
and image-A.png / image-B.png / image-C.png. Do not read timing, code, framework
identities, mappings, author journals, previous benchmark outcomes or another
judge's work. Blinding is procedural on a shared machine. Do not infer or name a
framework. Code quality is outside scope.

The task was a modest, restrained low-poly street corner, comparable in complexity
to a small diorama. All authors saw the same generated reference and were asked
to prioritize composition and major forms over tiny interior details.

Score in half-point increments 0–10:

- composition (25%): framing, camera, proportions and spatial arrangement;
- landmarks (25%): buildings, readable shops, awnings, street/crossing, cars and props;
- lowPolyStyle (15%): coherent restrained faceting and suitable simplification;
- lightingMaterials (20%): form readability, light, shadows, color/material separation;
- finish (15%): completeness and visible artifacts, without grading code.

Use the reference as a target, but do not demand photorealism or detail beyond the
brief. Separate matching the target from subjective visual appeal. Treat small
score differences cautiously. Describe visible evidence rather than hypothetical
rendering techniques. Report confidence and limitations.

Return JSON with keys `judge`, `candidates` (A/B/C, each `scores`, `strengths`,
`weaknesses`, `confidence`), `fidelityRanking`, `appealRanking`, and `limitations`.
Do not read another judge's JSON before saving your own final review.
