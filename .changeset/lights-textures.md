---
"@aperture-engine/render": minor
"@aperture-engine/webgpu": minor
"@aperture-engine/app": minor
---

Additional lights & texture types (parity plan E5) — a **hemisphere light** and
**3D / 2D-array texture assets**, plus the LUT color-grade migrated to a real 3D
texture. Light probes / spherical harmonics are deferred (see below).

**Hemisphere light (AC1)** — a new `LightKind.Hemisphere`, the three.js
`HemisphereLight`: a soft two-color ambient gradient. `color` carries the sky
color, a new `groundColor` authoring field the ground color, `intensity` scales
both. The lit `StandardMaterial` shader adds an ambient branch
`mix(groundColor, skyColor, saturate(0.5 + 0.5*dot(N, +Y))) * intensity` — an
up-facing surface reads the sky, a down-facing one the ground — present in BOTH
the direct and clustered light-loop variants (the clustered-sampling string
transform was taught the new branch, pinned by a "hemisphere survives clustering
exactly once" test). Like ambient/environment the light needs **no transform**
(the gradient axis is a fixed world +Y). Authorable via `withLight({ kind:
"hemisphere", color, groundColor, intensity })` (`@aperture-engine/render`) and
`spawn.light({ kind: "hemisphere", color, groundColor })`
(`@aperture-engine/app`); `groundColor` is ignored by every other light kind. A
non-hemisphere `light.invalidHemisphereColor` value is caught by
`validateLightInput` (the `Color` component itself already clamps to [0,1]).

**The packed light record does NOT grow.** `LIGHT_PACKET_WORDS` stays 31: the
snapshot codec transports the hemisphere ground color through the otherwise-
unused range/innerConeAngle/outerConeAngle float slots (extraction zeroes those
for a hemisphere light so the packet round-trips byte-exact), and the GPU light-
float layout reuses the cone/width slots 6-8 with a new `PackedLightKindId`.
Every other light kind's packed floats, metadata, and snapshot bytes are
byte-identical (pinned by a codec round-trip fixture + a packing literal test),
so **no determinism fixture moved** and `test/determinism` is GREEN with no
refresh. Ships `examples/hemisphere-light` (a sphere whose top reads sky-blue and
bottom reads ground-warm) with a pixel e2e; feature-audit §6 hemisphere row → ✅.

**3D + 2D-array textures (AC2)** — `TextureDimension` gains `"3d"` (a volume
texture) and `"2d-array"` (N stacked layers), and a custom-WGSL material texture
binding's `viewDimension` gains them too (`texture_3d<f32>` /
`texture_2d_array<f32>`). The texture realizer threads the WebGPU storage
`dimension: "3d"` for a volume (uploading every depth slice in one
`writeTexture`) and passes an explicit `"3d"`/`"2d-array"` texture VIEW for those
custom bindings; `2d`/`cube` keep their pre-E5 descriptors and cache keys
byte-for-byte (pinned by a "no `dimension` field on 2d descriptors" literal
test). The `viewDimension` participates in the material pipeline key ONLY when
non-default — a `dim:3d` / `dim:2d-array` token — so 2d bindings keep byte-
identical keys (pinned by a `dim:` token test). Ships `examples/volume-texture-
lut`: ONE custom material (deliberately single, to avoid the known multi-distinct-
custom-material black-render bug) samples a 4×4×4 LUT volume whose four blue-axis
slices carry distinct colors, with a pixel e2e proving the depth sampling
coordinate selects the right slice. Feature-audit §12 3D/array row → ✅.

**LUT color-grade migrated to a real 3D texture (AC2).** The E4 LUT effect
(`post-lut.ts`) previously stored its 3D LUT as a 2D N-slice strip sampled with
manual `textureLoad` trilinear interpolation ("3D-texture-lite"). It now uploads
a genuine N×N×N `texture_3d<f32>` and samples it with **hardware** trilinear
filtering (`textureSampleLevel` + a linear clamp-to-edge sampler and the standard
half-texel scale/bias). The **public `data` contract is unchanged** — callers
still pass the N-slice strip; the strip bytes are reshaped into the volume layout
at upload time (`reshapeLutStripToVolume`, unit-tested), so `createIdentityLut-
StripData`, the config surface, and existing example grades need no change.
`examples/post-tail`'s LUT e2e stays GREEN (same cool-grade result), resolving the
E4 "real 3D textures remain a follow-up" note.

**Light probes / SH deferred (AC3).** A `LightProbe` / `SphericalHarmonics3`
system (SH storage, probe placement + blend, a bake pipeline) is **not** shipped
— it is recorded explicitly in `docs/DECISIONS.md` decision 0028 as a follow-up
requiring an end-to-end indirect-lighting proof, so the audit's light-probe row
stays honestly ❌. The hemisphere light covers the two-color ambient case and
diffuse IBL the captured-environment case.

Honest deviations: the hemisphere gradient axis is fixed world +Y (three.js's
default HemisphereLight orientation) rather than the light's transform, so a
rotated hemisphere light is not modeled — the light carries no transform at all.
The custom-material snapshot **batch** key uses a compact binding form that omits
the `dim:` variant token (only the material's real GPU pipeline key carries it),
so the volume-texture e2e proves the 3D path through pixels + the binding count
rather than the batch key. 2D-array assets are supported end-to-end (realization,
binding, and view) but the shipped example exercises the 3D path; a 2D-array
atlas is covered by unit tests, not its own browser example.
