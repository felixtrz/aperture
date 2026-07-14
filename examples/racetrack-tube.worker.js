import { startGeneratedSimulationWorker } from "@aperture-engine/app/worker";
import { createSystem, material } from "@aperture-engine/app/systems";
import { catmullRomCurve } from "@aperture-engine/math";
import { createTubeMeshAsset } from "@aperture-engine/render";
import {
  racetrackTubeConfig,
  racetrackTubeOrthographicHeight,
} from "./racetrack-tube.main.js";

// Parity plan G2: a procedural racetrack. A closed Catmull-Rom loop (an oval
// with a little vertical banking) is swept into a single tube MeshAsset via
// `createTubeMeshAsset`, which walks the curve with a rotation-minimizing
// (parallel-transport) frame. The tube is registered as a mesh handle
// (`this.meshes.publish`) and spawned once through the app facade with a
// built-in standard material. Tiny segment counts keep the scene cheap on
// SwiftShader while the frame's twist correction closes the seam cleanly.

const RACETRACK_CONTROL_POINTS = [
  [2.6, 0, 0],
  [1.8, 0.35, 2.5],
  [0, 0, 3.3],
  [-1.8, 0.35, 2.5],
  [-2.6, 0, 0],
  [-1.8, -0.35, -2.5],
  [0, 0, -3.3],
  [1.8, -0.35, -2.5],
];

class RacetrackTubeSystem extends createSystem({ priority: 0 }) {
  init() {
    const curve = catmullRomCurve(RACETRACK_CONTROL_POINTS, { closed: true });
    const tube = createTubeMeshAsset({
      label: "RacetrackTube",
      curve,
      radius: 0.34,
      tubularSegments: 48,
      radialSegments: 6,
      closed: true,
    });
    const { handle } = this.meshes.publish("racetrack.tube", tube);

    this.spawn.camera({
      key: "camera.main",
      name: "racetrack-tube camera",
      transform: { translation: [0, 7, 7], lookAt: [0, 0, 0] },
      camera: {
        projection: "orthographic",
        orthographicHeight: racetrackTubeOrthographicHeight,
        near: 0.1,
        far: 60,
        frustumCulling: false,
      },
    });
    this.spawn.light({
      key: "light.key",
      name: "racetrack-tube key light",
      kind: "directional",
      illuminance: 4.5,
      transform: { rotationEulerDegrees: [-52, 24, 0] },
    });
    this.spawn.light({
      key: "light.ambient",
      name: "racetrack-tube ambient light",
      kind: "ambient",
      color: [1, 1, 1, 1],
      intensity: 0.4,
    });

    this.spawn.mesh({
      key: "racetrack.tube",
      name: "racetrack tube",
      mesh: handle,
      material: material.standard({
        label: "RacetrackTube",
        baseColor: [0.9, 0.36, 0.32, 1],
        metallic: 0.1,
        roughness: 0.5,
      }),
    });
  }
}

startGeneratedSimulationWorker({
  config: racetrackTubeConfig,
  systems: [{ default: RacetrackTubeSystem }],
});
