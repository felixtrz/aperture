# Aperture author journal

- 2026-10-17T06:37:57Z: Author timer started. Read protocol, repository guidance, visual-quality and procedural-still docs; inspected reference. Authoring through generated browser app, public ECS system facade, demand cadence.
- 2026-10-17T06:42:00Z: Created first scene with raised street block, cream cafe, adjoining green bookshop, wrapped striped awnings, flat roofs, windows, book displays, cars, trees, street lights, seating. Procedural block lettering keeps shop signs independent of external fonts/textures. No browser launches outside common capture harness.

- 2026-10-17T06:42:10Z: First static build command used an unsupported Vite --root flag; reran from author working directory. Checked custom crown winding and corrected outward triangle normals before capture.

- 2026-10-17T06:44:50Z: Capture `first` failed after 120-second exact-frame wait. Report immediately identified zero-area custom foliage triangles at spherical poles. Skipped the degenerate half of each polar quad; no engine changes. Capture count: 1.

- 2026-10-17T06:45:43Z: Capture `poles-fixed` passed in 8.45 s total; exact-frame GPU phase 4.7 s. Inspected image. Composition and all requested landmarks present, but normalized sRGB hex values were incorrectly authored as linear PBR colors, producing pastel washout. Added explicit sRGB-to-linear conversion, enlarged framing from 18.7 to 16 orthographic units, reversed side-sign local lettering order, lowered awnings below cafe sign and corrected wheel/windshield transforms.
