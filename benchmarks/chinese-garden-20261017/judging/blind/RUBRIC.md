# Anonymous visual review

Compare reference.png against image-A.png, image-B.png and image-C.png. Judge
only visible pixels. Do not infer framework, author identity, cost or implementation.
Do not read source, parent reports, coordinator mapping, other judge outputs or
first-iteration images. Inspect every image at full available resolution.

Assign each candidate a 0–10 score (half-points allowed) for:

- composition (weight 0.25): camera/framing, spatial arrangement and scale versus reference;
- landmarks (0.25): pavilion, open moon gate, bridge, pond, walls, pines/bamboo/rocks;
- lowPolyStyle (0.15): coherent restrained faceting, silhouettes, crafted shape language;
- lightingMaterials (0.20): grounding/shadows, depth, warm light, jade water, material/color separation;
- finish (0.15): distracting defects, clipping, floating parts, broken surfaces and unfinished presentation.

Use the reference as the target. A coherent alternative can earn high appeal but
still lose reference-fidelity points. Distinguish score categories rather than
penalizing the same omission everywhere. A 5 is a recognizable but substantially
rough approximation; 8 is strong with limited gaps; 10 is an exceptional match.
State concrete visible reasons and uncertainty. Report a separate subjective
appeal ordering so fidelity and attractiveness do not become conflated.

Write JSON with:
{"judge":"YOUR_LENS","candidates":{"A":{"scores":{"composition":0,"landmarks":0,"lowPolyStyle":0,"lightingMaterials":0,"finish":0},"strengths":[],"weaknesses":[],"confidence":"low|medium|high"},"B":{},"C":{}},"fidelityRanking":[],"appealRanking":[],"crossImageObservations":[],"limitations":[]}

Do not discuss code quality. Do not manufacture objective pixel-error metrics.
The coordinator will calculate weighted totals from your raw scores. Ties and
honest disagreement are acceptable; do not read or coordinate with another judge.
