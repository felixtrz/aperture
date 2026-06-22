# Color Management

Updated: 2026-05-21

This document records Aperture's current color-space contract for source
textures, StandardMaterial rendering, and display output.

## Invariants

- StandardMaterial lighting math runs in linear RGB.
- Base-color and emissive textures are authored as sRGB data and should use an
  `*-srgb` WebGPU texture format such as `rgba8unorm-srgb`.
- Metallic-roughness, normal, occlusion, and generic data textures are sampled
  as linear/data values and must not use `*-srgb` formats.
- Texture source assets carry both `colorSpace` and `semantic` metadata. The
  WebGPU backend keeps that metadata in Aperture descriptors for diagnostics,
  but strips it before calling `device.createTexture(...)`.
- StandardMaterial texture readiness and backend texture creation both diagnose
  color-space/format mismatches before rendering.
- StandardMaterial output applies tonemapping in linear space, then encodes the
  result to the app output color space. Browser apps default to `srgb`, so the
  final shader write uses linear-to-sRGB transfer encoding before presentation.

## Current Scope

The explicit output color-space shader wrapper currently covers the
StandardMaterial browser pipeline because that is where the Tier 10 tonemap
hook is implemented. Other material families still render through their
existing LDR/debug paths and should move onto the same output-stage contract
when a broader post/output pass is added.

## Diagnostics

Texture mismatches are reported at two layers:

- `validateTextureAsset(...)` catches source texture color-space policy and
  format mismatches.
- `createTextureGpuResource(...)` rejects descriptor metadata where
  `colorSpace: "srgb"` does not match an `*-srgb` format, or a linear/data
  texture uses an `*-srgb` format.

These diagnostics keep the source asset contract renderer-independent while
ensuring the WebGPU upload path cannot silently sample albedo/emissive data as
linear data, or data textures as sRGB colors.
