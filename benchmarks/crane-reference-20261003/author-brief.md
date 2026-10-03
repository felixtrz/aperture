# Articulated crane courtyard: shared author brief

## Task and equal-input boundary

Independently author a modest low-poly industrial courtyard matching the three frozen reference images and the numerical constraints below. Produce procedural editable geometry, the three camera views, and each of the seven independent edits. Reset to baseline before each edit. Use the same frozen brief, scene-manifest.json and three reference PNGs for both authors. Do not supply either author the reference builder, Blender file, GLB, or another author's solution. The retained Blender/GLB files are reference evidence, not starting assets.

This is a qualitative authoring/engine probe, not a formal scored benchmark or a structural, rigging, collision, lifting-safety, or physical-simulation test. Mechanical relationships are kinematic geometric constraints. No downloaded assets, texture maps, ornate detail or physics solver is needed. Preserve silhouette, holes, connected parts, soft shadows, warm/cool lighting and the restrained palette. Equivalent clean topology is welcome; exact triangulation and renderer pixels are not targets. Do not recreate reference sampling grain: it is a render limitation, not a surface material or geometric feature. Genuine hollow pipe walls with two open bores, a genuine through-wall arch, coincident articulated joints, and connected hydraulic/cable/hook/sling/load attachments are mandatory geometric requirements even where one camera partly occludes them.

## Coordinates, baseline and geometry

All coordinates are in metres in a right-handed coordinate system with +Y up, +X right and +Z toward the front. Blender uses the rotation (x,y,z) → (x,−z,y). Angles below are degrees. The manifest supplies measured bounds for every semantic part.

- Ground: slate courtyard slab 7.9 × 6.0 m, top at Y=0 and underside Y=−0.22.
- Platform: ground-centred at (−2.15,0,0.15). Three centred rectangular tiers: lower 3.05 × 2.35 m, height 0.16; middle 2.72 × 2.02 m, height 0.16; upper 2.36 × 1.65 m, height 0.18. Their top heights are 0.16, 0.32 and 0.50. Crane foot contacts the upper tier.
- Shoulder P=(−2.15,1.25,0.15). Lower boom length L1=2.6, elevation θ=50°. Upper boom length L2=1.7, relative elbow angle φ=−35°. Both booms lie in a vertical plane. E=P+L1(cosθ,sinθ,0); T=E+L2(cos(θ+φ),sin(θ+φ),0). Lower boom cross-section 0.30 × 0.36; upper 0.24 × 0.29. Exposed cylindrical pins connect shoulder, elbow and tip. Include the visible pedestal, turntable and counterweight.
- Hydraulic fixed eye A=P+(0.50,−0.35,0.30). Moving eye B=P+0.90(cosθ,sinθ,0)+(0,0,0.30). Body and rod share the A→B axis. Body length 0.64, radius 0.09; rod radius 0.043. The rod starts 0.12 m inside the body and ends at B. The cylinder must remain attached as the lower boom moves.
- Hoist: straight cable from T to H=T−(0,1.50,0), radius 0.025. Keep this cable vertical in world space, independently of boom direction.
- Hook: open 270° C-shaped arc in the boom plane, centre H−(0,0.17,0), centreline radius 0.17, tube radius 0.045. Arc runs from the top through left and bottom to the right, so its top meets H and the upper-right gap remains visible. A low-poly tube suffices.
- Suspended load: wooden crate body 1.00 × 0.50 × 0.72, centred H−(0,0.83,0). Four straps start at H−(0,0.30,0) and end at H+(±0.39,−0.562,±0.27), with the four sign combinations. Include simple pale wooden reinforcement strips. Hook, straps and crate remain connected and follow the hoist.
- Wall: body X=[−0.60,3.00], Y=[0,2.60], Z=[−2.20,−1.90]. A cap extends to Y=2.72, width 3.78 and depth 0.42, centred at X=1.20, Z=−2.05. The true through-opening is centred X=1.20 with width 1.60, spring height 1.10 and a semicircular head, radius 0.80 and apex Y=1.90. Twelve low-poly arch wedges of radial thickness 0.20 are enough. Piers/spandrels fill the rectangular wall outside the opening. A warm lamp sits on the front-right wall at (2.61,1.76,−1.795).
- Hollow pipe: 90° circular centreline in a vertical XY plane, O=(0.85,0.24,1.72), C(t)=O+(R sin t,R(1−cos t),0), t=0…90°, R=0.80. Outer tube radius 0.24, inner radius 0.175, wall thickness 0.065. Both ends are open, with annular rims and a real inner surface. Use about 12 bend segments and 12 radial sides. Start centre/tangent are O/+X; end centre/tangent are O+(R,R,0)/+Y.
- Props: one smaller wooden crate at (2.92,0.32,0.58), size 0.66 × 0.64 × 0.64; teal drum at (−3.16,0,2.05), radius 0.29 and height 0.69 with two bands; ochre bollard at (3.24,0,−1.12), radius 0.105 and height 0.65. These stay separate from the crane/platform assembly.

## Fixed cameras and appearance

Render 1024 × 1024 square images with orthographic cameras. Every camera targets (0,1.4,0), vertical span 10.5 m, up as close to world +Y as a look-at permits. Keep these cameras fixed for all edits.

1. Front-quarter: position (8,6.5,10).
2. Rear-quarter: position (−8,5,−9).
3. High-oblique: position (6,11,5).

The palette is in scene-manifest.json as sRGB hex colours with roughness/metallic values. Main colours: warm ochre crane, charcoal pivots, pale metal rod/hook, blue-slate tiers, muted brick wall, teal hollow pipe and warm wooden crates. No texture maps. The reference uses flat/faceted geometry and physically based simple materials.

Lighting: a warm directional key from (−4,7,5) toward the origin, about 0.09 rad angular diameter; broad cool area fill from (3,6,−4) toward (0,1,0), size 7 m; low cool world fill; small warm point lamp near (2.61,1.76,−1.69). Preserve the direction, broad softness and relative warmth rather than copying incompatible light-energy units blindly. Use your engine's supported filmic tone map. The reference is Blender Cycles CPU, 256 samples, no denoising, AgX Medium High Contrast. Core glTF cannot preserve its world/area light/AgX look exactly.

## Seven independent edits and expected relationships

1. Shoulder θ: 50° → 65°. P and boom lengths remain fixed. Recompute E, T and B; A remains fixed. Hydraulic parts stay coaxial with the same overlap. Cable remains world-vertical; hook and load follow its new top.
2. Relative elbow φ: −35° → −60°. P, E, first boom and complete hydraulic assembly remain fixed. Upper boom rotates around E, preserving 1.7 m length. Cable, hook, straps and load follow T.
3. Hoist length: 1.50 → 1.90 m. T and both booms remain fixed. H, hook, all straps and the load translate down exactly 0.40 m. Keep cable straight and vertical.
4. Opening width: 1.60 → 2.10 m. Keep centre X=1.20, spring Y=1.10, wall thickness and outer wall/cap bounds fixed. Radius becomes 1.05; apex becomes Y=2.15. Jambs move outward 0.25 m each. Preserve the through-opening and 0.20 m arch-ring thickness.
5. Pipe bend radius R: 0.80 → 1.10 m. Keep O, start tangent, 90° sweep, outer radius, wall thickness and both open ends. End centre moves exactly (+0.30,+0.30,0); end tangent remains +Y. Do not scale the tube's cross-section.
6. Upper-tier thickness: 0.18 → 0.38 m. Its bottom remains Y=0.32 and top becomes 0.70. Translate the entire crane, cable, hook, straps and suspended load upward 0.20 m. Lower/middle tiers and all nonassembly geometry stay unchanged.
7. Whole assembly movement: rigidly yaw platform and all crane parts +20° about ground pivot (−2.15,0,0.15), then translate (+0.55,0,+0.40). For pivot-relative q, yaw is (cos a·qx+sin a·qz, qy, −sin a·qx+cos a·qz). Preserve all internal distances and attachments. World-vertical cable stays vertical. Ground, wall/lamp, pipe and props stay fixed.

For each edit, also verify that geometry outside its scope is unchanged. Assess the actual generated geometry or transforms, not only stored parameter values. Reference tolerances for numeric attachment checks are 2×10⁻⁵ m; engines may state a justified implementation tolerance. Preserve a resettable parameter source and report any unsupported capability honestly.

## Required author evidence

Provide the authored scene source, baseline three views, the seven parameter values and actual-geometry checks, and a front-quarter image for each edited case. Retain all attempts and errors. Identify whether an image was rendered by the intended native engine and the real runtime/backend used. Do not replace missing native engine evidence with a Blender/reference screenshot. The next comparison will use identical frozen inputs and review baseline views, edit correctness, source ergonomics and demonstrated engine gaps qualitatively.
