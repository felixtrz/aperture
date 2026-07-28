# Reference asset licensing

## `studio-neutral.hdr`

`studio-neutral.hdr` is a procedurally generated neutral RGBE environment map
created for Aperture. It contains broad gray key, fill and rim gradients with no
photographic content, trademarks or third-party source material.

- Copyright: Aperture contributors
- License: MIT (the same license as this package)
- Generator: `scripts/studio-neutral-hdr.mjs`
- Intended use: deterministic offline material previews and scaffold lighting

The generated file is 32 × 16 pixels and is rebuilt into `dist/` during package
preparation. Its small resolution is deliberate: the renderer derives diffuse
irradiance and a specular PMREM from it, while the compact source keeps the
published package increase far below the initiative's 512 KB limit.
