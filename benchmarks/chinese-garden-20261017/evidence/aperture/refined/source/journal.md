# Aperture garden author journal

- Started 2026-10-17T03:19:21Z. Read protocol, AGENTS, visual-quality defaults, app and procedural mesh docs; inspected reference.
- Current app facade, generated worker, ECS system initialization, and render snapshots retained. All geometry generated locally, without images or scene imports.
- Plan: batched procedural triangle meshes by material, with semantic ECS entities; warm directional sun, IBL, shadows, SSAO, ACES. Main landmarks precede microdetail.
- Capture `first` passed on native WebGPU (started 03:23:57.936Z, finished 03:25:19.333Z; queue 0.44 ms). First visual inspection showed reversed roof/ground/ring triangle winding, oversized pine crowns, and camera elevation too low. Corrected authored winding, raised the camera, and made pine foliage flatter/smaller. These are authoring errors, not engine failures.
- The facade exposes native `mesh.triangleList` and `mesh.extrude` with real openings; these eliminated custom mesh registry boilerplate. Completion uses generated-app diagnostics plus the capture harness GPU-completion wait; no simple public generated bootstrap frame callback was apparent in the docs.
- Capture `composition` visually inspected. Roof now complete, camera angle better, real moon opening visible. Water had a coplanar conflict with the foundation top (both y=0.18), corrected by lowering the slab. Reduced palette brightness, moved right pine away from the gate, slightly enlarged the pool, reduced pavilion footprint, and added denser ground cover.
- Switched the static scene to supported `render.cadence: demand` after observing long continuous SwiftShader capture completion. Worker and snapshot architecture remain unchanged.
- Capture `garden` passed in 11.36 s versus 81–89 s previously, after using demand cadence (not a controlled performance measurement; same scene also changed). Pool depth conflict eliminated. Water remains intentionally stylized; no planar/scene reflections implemented.
- Final detail pass adds subtle real mesh wavelets, correct wall-cap winding, quieter roof seams, and a small concealed path/planting continuation beyond the gate to make its open depth legible.
