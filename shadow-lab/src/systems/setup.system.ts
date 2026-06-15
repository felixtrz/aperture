import { createSystem, material, mesh } from "@aperture-engine/app/systems";
import { hexColor } from "../lib/math.js";
import { DIR_LIGHT, HEMI_LIGHT } from "../lib/tuning.js";

// MINIMAL shadow-verification scene (per Felix): a flat ground + ONE glTF tree,
// nothing else. A single small caster gives a tiny shadow ortho, so the shadow
// is crisp even at the default map size — this verifies the shadow ALGORITHM is
// correct (the blobby full-scene shadows are a resolution/coverage problem, not
// a correctness bug). Racing's sun + ambient lighting are kept. The full racing
// static scene (track/decorations/trucks) is recoverable via git on this file +
// decorations.system.ts.
export default class SetupSystem extends createSystem({ priority: 0 }) {
  override init(): void {
    // Camera handled by orbit-controls (targets the tree).
    this.spawn.camera({
      key: "camera.main",
      name: "main-camera",
      transform: { translation: [8, 6, 8], lookAt: [0, 1.5, 0] },
      fovYDegrees: 40,
      camera: { near: 0.1, far: 200, clearColor: hexColor(0xadb2ba) },
    });

    // Sun: racing's directional light + shadow.
    this.spawn.light({
      key: "light.sun",
      name: "sun",
      kind: "directional",
      color: hexColor(DIR_LIGHT.colorHex),
      illuminance: DIR_LIGHT.intensity,
      transform: { translation: DIR_LIGHT.position, lookAt: [0, 0, 0] },
      shadow: {
        mapSize: 4096,
        cascadeCount: 1,
        shadowType: 1,
        filterRadius: DIR_LIGHT.shadowRadius,
        // DIAGNOSTIC: normalBias 0 to test if the receiver-side normal offset is
        // eating the small protrusion shadow (raw world-units now).
        normalBias: 0,
      },
    });

    // Racing's sky-biased ambient fill.
    const sky = hexColor(HEMI_LIGHT.skyHex);
    const ground = hexColor(HEMI_LIGHT.groundHex);
    const skyBias = 0.85;
    this.spawn.light({
      key: "light.ambient",
      name: "ambient",
      kind: "ambient",
      color: [
        sky[0] * skyBias + ground[0] * (1 - skyBias),
        sky[1] * skyBias + ground[1] * (1 - skyBias),
        sky[2] * skyBias + ground[2] * (1 - skyBias),
        1,
      ],
      // DIAGNOSTIC: ambient dropped from HEMI_LIGHT.intensity (2) so shadows go
      // dark and their SHAPE is unambiguous to judge. Restore to 2 for racing
      // look once shadows are verified.
      intensity: 0.25,
    });

    // Flat ground (top surface at y=0), receives shadow, does not cast.
    this.spawn.mesh({
      key: "ground",
      name: "ground",
      mesh: mesh.box({ size: 1 }),
      material: material.standard({
        baseColor: [0.45, 0.7, 0.45, 1],
        roughness: 1,
        metallic: 0,
      }),
      transform: { translation: [0, -0.5, 0], scale: [40, 1, 40] },
      receiveShadow: true,
      castShadow: false,
    });

    // A tree built from PRIMITIVES: a cylinder trunk + 3 gradually smaller cones
    // stacked. A known, recognizable silhouette so the ground cast-shadow shape
    // is unambiguous to judge. castShadow on, receiveShadow off (isolate the
    // GROUND shadow shape). Cones/cylinder are centered at origin (depth=height).
    const trunkMat = material.standard({
      baseColor: [0.4, 0.26, 0.13, 1],
      roughness: 1,
      metallic: 0,
    });
    const foliageMat = material.standard({
      baseColor: [0.18, 0.5, 0.28, 1],
      roughness: 1,
      metallic: 0,
    });

    // glTF-style node hierarchy: a "tree" ROOT (the trunk) with the 3 foliage
    // cones as CHILD nodes carrying LOCAL transforms. Each child's WORLD
    // transform — the one the shadow caster bakes — is composed through the
    // parent every frame, exactly like a glTF model's nodes. Select "tree" in
    // the panel and move it: the whole tree (and its shadow) moves as one.
    const root = this.spawn.mesh({
      key: "tree",
      name: "tree",
      mesh: mesh.cylinder({ radius: 0.25, depth: 1.4 }),
      material: trunkMat,
      transform: { translation: [0, 0.7, 0] },
      castShadow: true,
      receiveShadow: true,
    });
    const cone = (
      key: string,
      radius: number,
      depth: number,
      localY: number,
    ): void => {
      this.spawn.mesh({
        key,
        name: key,
        mesh: mesh.cone({ radius, depth }),
        material: foliageMat,
        // Local to the root trunk (root sits at world y=0.7).
        transform: { translation: [0, localY, 0], parent: root },
        castShadow: true,
        receiveShadow: true,
      });
    };
    cone("tree.cone0", 1.4, 1.6, 1.0); // world y 1.7
    cone("tree.cone1", 1.05, 1.5, 1.85); // world y 2.55
    cone("tree.cone2", 0.7, 1.4, 2.65); // world y 3.35
  }
}
