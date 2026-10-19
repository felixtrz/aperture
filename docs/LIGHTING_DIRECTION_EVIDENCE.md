# Resolved directional-light evidence

Render reports include `lightingHealth.lighting.directionalGeometry`, a CPU
description of the extracted directional lights and active camera views. The same
lighting-health data is available through `render_diagnose`. It helps explain
where the key points and where an ideal ground shadow goes before another render.
It does not measure image quality, material brightness, visibility or occlusion.

The evidence comes from resolved ECS matrices, including parent transforms and
camera roll. No GPU readback or image analysis is needed. Ordinary lighting-health
warnings are unchanged; a valid direction can be intentional for any visual style.

| Field                                            | Meaning                                                                                                                        |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `towardLightWorld`                               | Normalized light-local +Z in world coordinates. Photons travel in the opposite direction.                                      |
| `worldElevationDegrees`                          | Angle above the horizontal world XZ plane. This is not generally an authored Euler X angle.                                    |
| `intensity`, `color`                             | Authored unitless intensity and linear RGBA. These are not comparable brightness units across renderers.                       |
| `cameras[].towardLightCamera`                    | Components along resolved camera right, up and backward (toward the camera).                                                   |
| `cameras[].angleFromCameraAxisDegrees`           | Zero means the key points toward the camera; 180 means it points along camera forward. Neither is inherently correct or wrong. |
| `groundShadow.displacementWorldPerUnitHeight`    | Ideal displacement on a horizontal receiver, per unit object height above it.                                                  |
| `cameras[].groundShadowCameraPlanePerUnitHeight` | That displacement along camera right and down, in world units per unit height. These are not pixels.                           |

For a world direction `L = [Lx, Ly, Lz]` with `Ly > 0`, the ground displacement is
`[-Lx / Ly, 0, -Lz / Ly]`. For example, a directional light aimed from `[-4, 8, 4]`
at the origin gives `[0.5, 0, -0.5]`: a two-unit-tall object casts its ideal tip
one unit along +X and one unit along -Z from its base. This calculation assumes a
horizontal plane and an unobstructed directional ray. It does not include the
shadow-map bias, penumbra, other surfaces or the object's silhouette.

Camera-plane components use an orthonormal basis, with X right and Y down. For
perspective cameras an exact pixel displacement also depends on receiver position
and projection; do not multiply these components by viewport dimensions. To
inspect a specific shadow landmark, calculate the world tip from its height and
use [camera project](CAMERA_LANDMARKS.md) with the actual camera and viewport.

## Use a controlled direction pass

After the first useful image, identify the reference's bright/shaded planes and
cast-shadow direction. Read the light and camera evidence in the capture report.
Near-camera lighting often places shadows behind objects, but it can still light
different surface normals differently. The direction report does not prove that
fill is excessive or that contact shadows are missing.

Keep geometry, camera, materials, exposure, fill and key intensity fixed. Change
only the key's direction, using an authored position and look-at target:

```ts
this.spawn.light({
  key: "sun",
  kind: "directional",
  intensity: 3.3,
  transform: { translation: [-4, 8, 4], lookAt: [0, 0, 0] },
  shadow: { mapSize: 2048, cascadeCount: 1, shadowType: 2 },
});
```

The coordinates are an example, not a recommended direction for every scene.
Retain the scene's existing shadow configuration when making this comparison.
For a directional light, translation controls this look-at aim and does not cause
distance attenuation. Check the resulting cast shadows and visible wall planes
before adjusting fill, color, shadow strength or softness separately. A successful
capture still needs visual inspection.

## Status and scope

Each light and camera record carries a status. Invalid extracted transforms produce
`null` evidence rather than a guessed direction. This report cannot recover an
invalid authored transform that an upstream extractor has already replaced with
a valid fallback matrix. Lights at or below the horizontal plane
have no finite forward ground-shadow intersection for an object above it; that
shadow evidence is `null`. Missing cameras are explicit. Nonorthogonal camera
bases are reported rather than silently repaired. Orthogonal scaled bases are
normalized, so camera-plane quantities retain their declared world-unit meaning.
Nonfinite authored intensity or color is also reported as `null`.

The report does not evaluate layer masks, shadow enablement, receiver availability
or occlusion. A finite ideal displacement does not prove that a shadow is rendered.

Directional geometry is informational and does not modify ECS, light settings,
renderer output or the existing warning list. Its cache must follow the consumed
light/camera transforms while ordinary material compatibility analysis remains
reusable. Multiple views and lights retain their IDs so the author can identify
which combination produced each measurement. There is no automatic "good light"
threshold or inferred target direction.
