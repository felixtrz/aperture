# Author journal

- 2026-10-17T06:38:33Z — Began fresh vGPU author trial. Read repository instructions, benchmark protocol and supplied reference. No peer source or evidence inspected.
- Initial implementation — Used vGPU 0.6.0 native init/geometry/draw/target/frame/surface APIs. One procedural triangle stream contains the complete street diorama; separate sun-depth and lit passes provide shadows. All scene geometry is authored here. wgpu-matrix supplies projection/view math. Fixed seed 91373.
- Documentation reading — Consulted installed package declaration files for explicit native geometry layouts, offscreen target formats, MSAA and still-frame completion. No renderer helper from another engine used.

- 2026-10-17T06:44:40Z — Capture `first` failed: native draw requires prepared ShaderSource v2, while raw WGSL strings were supplied. Migrated both shaders to .wgsl imports using the package Vite preparation plugin. Standalone first build command also used obsolete --root syntax; corrected by running in author directory.
- 2026-10-17T06:46:10Z — Capture `prepared` failed in geometry binding validation: the shadow shader declared only position, but vGPU requires all named geometry attributes to have matching shader inputs. Added normal/color inputs to the depth vertex entry.
