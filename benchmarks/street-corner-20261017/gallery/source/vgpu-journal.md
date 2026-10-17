# Author journal

- 2026-10-17T06:38:33Z — Began fresh vGPU author trial. Read repository instructions, benchmark protocol and supplied reference. No peer source or evidence inspected.
- Initial implementation — Used vGPU 0.6.0 native init/geometry/draw/target/frame/surface APIs. One procedural triangle stream contains the complete street diorama; separate sun-depth and lit passes provide shadows. All scene geometry is authored here. wgpu-matrix supplies projection/view math. Fixed seed 91373.
- Documentation reading — Consulted installed package declaration files for explicit native geometry layouts, offscreen target formats, MSAA and still-frame completion. No renderer helper from another engine used.

- 2026-10-17T06:44:40Z — Capture `first` failed: native draw requires prepared ShaderSource v2, while raw WGSL strings were supplied. Migrated both shaders to .wgsl imports using the package Vite preparation plugin. Standalone first build command also used obsolete --root syntax; corrected by running in author directory.
- 2026-10-17T06:46:10Z — Capture `prepared` failed in geometry binding validation: the shadow shader declared only position, but vGPU requires all named geometry attributes to have matching shader inputs. Added normal/color inputs to the depth vertex entry.
- 2026-10-17T06:48:15Z — Viewed successful capture `matched`. Revised camera elevation, foliage outward normals, lighting direction/fill and PCF softness, readable side sign direction, tapered car cabin and wheel end caps. All major landmarks present in first image.
- 2026-10-17T06:50:50Z — Viewed `refined`. Fixed backdrop shadow sampling outside the light frustum; reframed to include the front slab corner. Enlarged/repositioned cars toward reference. Replaced block lettering with permitted procedural Canvas2D sign textures on world-space facade planes, drawn through native vGPU.
- 2026-10-17T06:52:10.608716Z — Viewed successful final capture `composed`: complete diorama in frame, backdrop edge artifact resolved, readable signs and revised cars. Frozen final implementation, wrote README and result.json. Five total attempts; three verified images. No open blockers.
