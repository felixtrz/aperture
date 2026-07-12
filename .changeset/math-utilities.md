---
"@aperture-engine/math": minor
---

Math utility round-out (parity plan G3): kernel-style, array-first functions
with optional out-params and no classes (decision 0007). Triangle ops
(`triangleArea`, `triangleNormal`, `triangleCentroid`, `triangleBarycentric`,
`triangleClosestPoint` via the Ericson region test, `triangleContainsPoint`);
line-segment ops (`lineDelta`, `lineClosestPoint`,
`lineClosestPointParameter`, `lineDistanceSq`, and segment-segment
`segmentClosestPoints` for capsule tests); spherical/cylindrical conversions
(`sphericalFromCartesian`, `cartesianFromSpherical`,
`cylindricalFromCartesian`, `cartesianFromCylindrical`) using the orbit
controller's convention (azimuth around +Y, zero on +Z; elevation above the XZ
horizon); and the full Penner easing pack (`easeIn/Out/InOut` for Quad, Cubic,
Quart, Quint, Sine, Expo, Circ, Back, Elastic, Bounce, plus `easeLinear`).
Degenerate triangles return `null` from `triangleBarycentric` (matching
`decomposeTrsMatrix`) and fall back to boundary scans elsewhere.
