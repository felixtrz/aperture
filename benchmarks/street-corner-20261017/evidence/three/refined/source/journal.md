# Author journal

- 2026-10-17T06:39:07Z — Timer started; read repository AGENTS, frozen benchmark protocol and visual-quality guidance. Inspected reference. Chose an orthographic west/south view and a small square street diorama, modeled procedurally.
- 2026-10-17T06:43:00Z — First scene authored: café and bookshop with readable shopfronts, roof details, awnings, sidewalk, roads, crossing, two cars, two trees, lamps, bench and café seating. Uses Three.js WebGPURenderer with its automatic fallback explicitly disabled; still frame waits for verifier GPU completion.

- 2026-10-17T06:44:38Z — Capture `first` passed native WebGPU verification: 0 WebGL attempts, no GPU errors. Capture queue waited 67.2 seconds; render/lifecycle 3.8 seconds. Inspection found hidden café text, overly smooth trees, flat lighting, and a low viewing angle.
- 2026-10-17T06:47:00Z — Raised sign visibility by lowering awnings, replaced tree clusters with faceted irregular canopies, moved foliage outward, enlarged cars modestly, adjusted camera elevation and lighting, darkened asphalt, and added restrained GTAO contact shading. Changed removed PCFSoftShadowMap to supported PCFShadowMap after reading current Three source.
