---
"@aperture-engine/render": patch
---

glTF meshes with a lit (non-unlit) material but no `NORMAL` attribute now get
synthesized smooth vertex normals at import, per the glTF spec's requirement
that clients compute normals when a shaded mesh omits them. Previously such
meshes had nothing for the standard material to light against and rendered
black (e.g. a position-only EXT_meshopt_compression cube). Normals are
area-weighted face normals accumulated per vertex; unlit primitives and
meshes that already declare `NORMAL` are untouched, so their vertex layout is
unchanged.
