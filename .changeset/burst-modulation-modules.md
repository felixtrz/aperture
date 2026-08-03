---
"@aperture-engine/webgpu": minor
"@aperture-engine/particles": minor
---

Apply the remaining modulation modules on the burst particle path:
`speedOverLifetime`, `colorBySpeed`, `sizeBySpeed`, `rotationBySpeed`, noise
turbulence, and orbital/radial velocity now affect burst-mode emitters the same
way they affect continuous emitters. The burst render shader evaluates the
speed curve analytically through packed running integrals
(`D = v0·L·S0(u) + g·L²·S1(u)`), derives by-speed size/color/rotation from the
modulated instantaneous velocity, rotates the ballistic trajectory around the
burst origin for orbital velocity, and samples the same noise hash field as
the continuous CPU path. The burst param buffer appends the module curve
tables and parameters (124 → 272 floats) and the per-particle burst record
appends the emitter-origin vec4 (stride 16 → 20 floats); both extensions
append after the existing fields, so prior offsets are unchanged.
Non-batchable (local-space) bursts apply noise and orbital motion through the
shared CPU buffer writer, with world-plane collision still burst-off.
`markUnsupportedModuleFeatures` no longer flags these six modules as
burst-unsupported, so converted effects using them validate clean in burst
mode.
