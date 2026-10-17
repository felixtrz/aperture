# Author journal

- 2026-10-17T06:38:33Z — Began fresh vGPU author trial. Read repository instructions, benchmark protocol and supplied reference. No peer source or evidence inspected.
- Initial implementation — Used vGPU 0.6.0 native init/geometry/draw/target/frame/surface APIs. One procedural triangle stream contains the complete street diorama; separate sun-depth and lit passes provide shadows. All scene geometry is authored here. wgpu-matrix supplies projection/view math. Fixed seed 91373.
- Documentation reading — Consulted installed package declaration files for explicit native geometry layouts, offscreen target formats, MSAA and still-frame completion. No renderer helper from another engine used.
