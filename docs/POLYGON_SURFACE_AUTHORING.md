# Fitted surfaces for procedural props

For curved faceted shells, `mesh.loft()` connects corresponding 3D sections. See
[the section modeling workflow](AGENT_VISUAL_WORKFLOW.md) and the runnable
[skiff and canopy example](../examples/planar-reflections/README.md).

Use `mesh.polygons()` when a part needs shaped faces instead of an assembly of
boxes: tapered car cabins, sloping windows, roof panels, facade openings or
low-poly housings. It accepts planar 3D boundaries and generates triangles, flat
normals and UVs. It works in worker systems and portable Dawn render bundles.

The street benchmark's Three.js car used a tapered cabin and fitted trapezoidal
glass meshes. Its glass was still separate geometry. The original Aperture car
used a constant-width extrusion and thick rectangular glass/pillar pieces. That
construction choice produced the attached-piece appearance; it was not a shader
or renderer limitation. `mesh.triangleList()` could already express the fitted
geometry, but required the author to manage triangle indices and winding.

## Describe the surface, including its openings

```ts
import { mesh, material } from "@aperture-engine/app/systems";

// Every point lies on x = 0.6 - 0.2 * (y - 0.7).
// Counterclockwise from outside the car's right side (+X).
const side = [
  [0.48, 1.3, -0.4],
  [0.48, 1.3, 0.3],
  [0.6, 0.7, 0.7],
  [0.6, 0.7, -0.8],
] as const;
const window = [
  [0.5, 1.2, -0.3],
  [0.5, 1.2, 0.2],
  [0.58, 0.8, 0.5],
  [0.58, 0.8, -0.6],
] as const;

this.spawn.mesh({
  key: "car.side",
  mesh: mesh.polygons({ faces: [{ outline: side, holes: [window] }] }),
  material: material.standard({ baseColor: [0.1, 0.25, 0.4, 1] }),
  castShadow: true,
  receiveShadow: true,
});
this.spawn.mesh({
  key: "car.window",
  mesh: mesh.polygons({ faces: [{ outline: window }] }),
  material: material.standard({
    baseColor: [0.025, 0.045, 0.055, 1],
    roughness: 0.65,
  }),
  castShadow: true,
  receiveShadow: true,
});
```

The window fills an actual opening, so there is no body face behind it and no
coplanar overlap. Its border is part of the painted side surface. For two windows,
use two holes; the body between them becomes the middle pillar. Reuse the same
corner arrays for holes and glass to avoid independently measured gaps.

Several faces can form one mesh with one material. Adjacent material regions may
remain separate meshes with exactly matching boundaries. A single merged draw
does not make a model look integrated; fitted surfaces and consistent normals do.
For an inset pane, author its recessed face and connecting reveal faces explicitly.
Do not offset a pane and leave an unmodeled gap around it.

## Geometry contract

- Each face has a simple planar `outline` of `[x, y, z]` corners. Concave outlines
  are supported. Omit a repeated closing corner and redundant collinear corners.
- Outer winding controls visibility: counterclockwise viewed from the outside.
  Hole winding is normalized. Holes must be coplanar, disjoint and strictly inside
  their face; touching, nested or overlapping holes are rejected.
- Bent quads are rejected. Split a bent surface into planar triangles/faces rather
  than relying on an arbitrary diagonal. The planarity tolerance after float32
  conversion is `1e-5` of the face's maximum distance from its first corner.
- Output retains authored float32 positions. Shared indexed vertices are used
  within each face; corners are split between faces for flat shading. UVs normalize
  each face's dominant-axis projected bounds to `[0,1]²`.
- One asset supports at most 4,096 faces, 2,048 boundary vertices per face and
  65,536 total boundary vertices. Invalid inputs report an authored field path
  before mesh/material assets are published.
- This is surface authoring, not automatic boolean union, beveling, a manifold
  repair tool or a smooth subdivision modeler. It does not require a closed shell.
  `mesh.triangleList()` remains the lower-level option for explicit normals/UVs.

## Car recipe

The runnable [procedural car example](../examples/procedural-car/README.md) uses:

1. A shaped lower body and a cabin that tapers in both width and length.
2. Four cabin faces with six window openings and a roof sharing their top edges.
3. One glazing mesh using the exact opening boundaries. The body's remaining
   surfaces form the pillars, roof rails and sills.
4. Separate wheels, mirrors, handles and lamps, which are distinct physical parts.
5. An ECS `spawn.group()` parent for the whole vehicle. Child parts stay in local
   coordinates, so rotating the vehicle does not require rebuilding every part's
   world transform.

`fittedCarSurfaces()` returns reusable body/glazing descriptors;
`spawnFittedCar()` assembles the example through public app APIs. These are an
example recipe, not a car-specific engine primitive. Adapt the same approach to
windows and doors in buildings or panel seams on other props. The recipe's hex
palette is explicitly converted from display sRGB to linear material values.

Check the result from front, side and rear. Inspect the actual model at a close
camera, not only a small street render. The geometry tests verify the combined
body and glass shell has exactly two opposite uses per geometric edge; browser
and Dawn capture checks verify the real rendering path.

For a complete example combining fitted panels with corresponding profile
sections, see the [fitted-profile recipe](FITTED_PROP_PROFILES.md). It includes
a utility body with genuine wheel recesses and an instrument housing, using the
public facade and caller-owned geometry.
