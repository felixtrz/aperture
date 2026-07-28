# StandardMaterial image-based lighting

**Status:** authoritative implementation record

This page is the single source of truth for Aperture's executable
StandardMaterial image-based-lighting (IBL) path. Other architecture and
readiness pages should link here instead of maintaining their own capability
claims.

## End-to-end path

IBL remains a derived view of ECS-authored lighting:

```text
ECS environment light
→ extracted EnvironmentPacket + stable environment-map handle
→ renderer-owned HDR/equirect source asset
→ equirectangular-to-cube projection
→ diffuse irradiance convolution
→ specular GGX PMREM mip chain + BRDF integration LUT
→ StandardMaterial IBL bind group
→ IBL-specialized submitted pipeline
→ WGSL diffuse and specular environment sampling
```

The renderer never writes the prepared textures, samplers, bind groups, or
pipeline state back into ECS. The environment entity and its asset handle are
authoritative; every GPU resource is disposable derived state.

An RGBE HDR source is projected to a cube map. Diffuse convolution and
specular PMREM preparation use renderer-owned compute passes. The
StandardMaterial shader samples diffuse irradiance for the diffuse lobe and
the prefiltered radiance/BRDF LUT for the specular lobe. This is the active
production path, not readiness-only scaffolding.

## Submitted pipeline truth

Readiness must agree with the pipeline used by the submitted frame. Relevant
pipeline-key tokens are:

- `iblDiffuse`: the submitted StandardMaterial pipeline samples diffuse IBL.
- `iblSpecularBrdf`: the submitted pipeline samples PMREM with the BRDF LUT.
- `iblSpecularProof`: the submitted proof/fallback specular IBL variant is
  active.

A descriptor, texture, or bind group being prepared does not by itself mean
that IBL contributed to a frame. `pipeline-active` and lighting-health reports
are derived from the submitted key. Conversely, a submitted IBL token must not
be reported as deferred or inactive.

## Readiness states

`createStandardMaterialIblReadinessReport()` distinguishes these states:

| State                    | Meaning                                                                     |
| ------------------------ | --------------------------------------------------------------------------- |
| `not-required`           | No StandardMaterial draw needs the IBL path.                                |
| `not-requested`          | No environment was authored for the frame.                                  |
| `source-missing`         | An environment was requested, but no usable source resource exists.         |
| `preparation-pending`    | Required projection/convolution/prefilter resources are not ready yet.      |
| `preparation-failed`     | Environment preparation failed and IBL cannot be bound.                     |
| `diffuse-ready`          | Diffuse irradiance is ready; specular IBL is not.                           |
| `diffuse-specular-ready` | Diffuse and specular resources and bindings are ready.                      |
| `pipeline-active`        | The submitted StandardMaterial pipeline samples the prepared IBL resources. |

`render.environment.requestedButInactive` covers the important mismatch where
an environment exists but neither IBL token is used. Highly metallic visible
materials without submitted specular IBL produce
`render.material.metalWithoutSpecularIbl`.

## Lifetime and cache behavior

Environment preparation is cached per WebGPU app/device and versioned source
resource key. Reusing the same environment version reuses the projected cube,
diffuse texture, PMREM texture, samplers, and StandardMaterial IBL bind group.
Changing the source version creates a new cache key. Normal steady-state frames
therefore do not repeat equirect projection, irradiance convolution, or PMREM
generation.

The cache is renderer-owned and held per app/device; it is not global gameplay
state. JSON reports expose stable keys, versions, creation/reuse counts, and
readiness only—never raw WebGPU handles.

## Inspection

Use `render_diagnose` for a compact submitted-frame view. The report includes
environment count, diffuse/specular readiness, diffuse/specular active flags,
visible/high-metallic material counts, output configuration, and actionable
warnings. `frame_capture` embeds the same `lightingHealth` report so its IBL
claim is tied to the frame that produced the PNG.

For low-level investigation, inspect the environment preparation reports,
StandardMaterial IBL bind-group report, and submitted material pipeline key.
All JSON projections are handle-safe and serializable.
