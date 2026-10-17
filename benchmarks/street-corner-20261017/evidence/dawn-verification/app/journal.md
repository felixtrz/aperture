# Aperture author journal

- 2026-10-17T06:37:57Z: Author timer started. Read protocol, repository guidance, visual-quality and procedural-still docs; inspected reference. Authoring through generated browser app, public ECS system facade, demand cadence.
- 2026-10-17T06:42:00Z: Created first scene with raised street block, cream cafe, adjoining green bookshop, wrapped striped awnings, flat roofs, windows, book displays, cars, trees, street lights, seating. Procedural block lettering keeps shop signs independent of external fonts/textures. No browser launches outside common capture harness.

- 2026-10-17T06:42:10Z: First static build command used an unsupported Vite --root flag; reran from author working directory. Checked custom crown winding and corrected outward triangle normals before capture.

- 2026-10-17T06:44:50Z: Capture `first` failed after 120-second exact-frame wait. Report immediately identified zero-area custom foliage triangles at spherical poles. Skipped the degenerate half of each polar quad; no engine changes. Capture count: 1.

- 2026-10-17T06:45:43Z: Capture `poles-fixed` passed in 8.45 s total; exact-frame GPU phase 4.7 s. Inspected image. Composition and all requested landmarks present, but normalized sRGB hex values were incorrectly authored as linear PBR colors, producing pastel washout. Added explicit sRGB-to-linear conversion, enlarged framing from 18.7 to 16 orthographic units, reversed side-sign local lettering order, lowered awnings below cafe sign and corrected wheel/windshield transforms.

- 2026-10-17T06:48:00Z: Inspected `color-framing` (capture 3, passed, 8.24 s). Linear color correction restored dark asphalt, blue/mustard car paint and green bookshop. Detected the facade Euler helper uses XYZ order: the rotated blue car windshield needed YXZ composition. Switched local geometry rotations to public quatFromEulerYXZ, added modest warm window details, shifted blue car toward reference placement and centered camera framing.

- 2026-10-17T06:50:24Z: Inspected `composed` (capture 4 passed). Cars now have coherent windshield orientation; cafe sign and warm interiors read clearly. Final lighting pass: fixed 24-unit shadow camera around the diorama, PCSS contact-softening, slightly stronger warm sun with lower exposure and warmer plaster. Existing huge backdrop should not dictate shadow coverage.

- 2026-10-17T06:51:53Z: Inspected `warm-light` (capture 5 passed, 9.58 s). Warm plaster and shadow fit accepted. Final foliage adjustment replaces elongated latitude triangles with uniformly distributed 80-triangle subdivided icosahedra and three restrained leaf tones; this is the last capture (6 maximum).
