import { startGeneratedSimulationWorker } from "@aperture-engine/app/worker";
import { createSystem, material, mesh } from "@aperture-engine/app/systems";
import {
  geometryGalleryConfig,
  geometryGalleryOrthographicHeight,
} from "./geometry-gallery.main.js";

// Nine round-out primitives (G1) laid out on a 3x3 grid. Segment counts are
// kept tiny so the scene stays cheap under SwiftShader in CI.
const CELL = 2.2;
const galleryPrimitives = [
  {
    key: "circle",
    color: [0.95, 0.42, 0.4, 1],
    build: () => mesh.circle({ radius: 0.85, segments: 24 }),
  },
  {
    key: "ring",
    color: [0.96, 0.66, 0.3, 1],
    build: () =>
      mesh.ring({ innerRadius: 0.42, outerRadius: 0.85, segments: 24 }),
  },
  {
    key: "torus",
    color: [0.9, 0.85, 0.34, 1],
    build: () =>
      mesh.torus({
        radius: 0.55,
        tube: 0.2,
        radialSegments: 8,
        tubularSegments: 16,
      }),
  },
  {
    key: "torus-knot",
    color: [0.5, 0.86, 0.42, 1],
    build: () =>
      mesh.torusKnot({
        radius: 0.5,
        tube: 0.16,
        tubularSegments: 24,
        radialSegments: 6,
      }),
  },
  {
    key: "tetrahedron",
    color: [0.36, 0.82, 0.72, 1],
    build: () => mesh.tetrahedron({ radius: 0.85 }),
  },
  {
    key: "octahedron",
    color: [0.36, 0.7, 0.95, 1],
    build: () => mesh.octahedron({ radius: 0.85 }),
  },
  {
    key: "icosahedron",
    color: [0.5, 0.55, 0.96, 1],
    build: () => mesh.icosahedron({ radius: 0.85 }),
  },
  {
    key: "dodecahedron",
    color: [0.72, 0.48, 0.95, 1],
    build: () => mesh.dodecahedron({ radius: 0.85 }),
  },
  {
    key: "rounded-box",
    color: [0.95, 0.5, 0.78, 1],
    build: () => mesh.roundedBox({ size: 1.35, segments: 3, radius: 0.28 }),
  },
];

function gridTransform(index) {
  const column = index % 3;
  const row = Math.floor(index / 3);

  return {
    translation: [(column - 1) * CELL, (1 - row) * CELL, 0],
    rotationEulerDegrees: [22, 32, 0],
  };
}

class GeometryGallerySetupSystem extends createSystem({ priority: 0 }) {
  init() {
    this.spawn.camera({
      key: "camera.main",
      name: "geometry-gallery camera",
      transform: { translation: [0, 0, 8] },
      camera: {
        projection: "orthographic",
        orthographicHeight: geometryGalleryOrthographicHeight,
        near: 0.1,
        far: 40,
        frustumCulling: false,
      },
    });
    this.spawn.light({
      key: "light.key",
      name: "geometry-gallery key light",
      kind: "directional",
      illuminance: 4.5,
      transform: { rotationEulerDegrees: [-32, 26, 0] },
    });
    this.spawn.light({
      key: "light.ambient",
      name: "geometry-gallery ambient light",
      kind: "ambient",
      color: [1, 1, 1, 1],
      intensity: 0.4,
    });

    galleryPrimitives.forEach((primitive, index) => {
      this.spawn.mesh({
        key: `geometry-gallery.${primitive.key}`,
        name: `geometry-gallery ${primitive.key}`,
        mesh: primitive.build(),
        material: material.standard({
          label: `GeometryGallery-${primitive.key}`,
          baseColor: primitive.color,
          metallic: 0.05,
          roughness: 0.55,
        }),
        transform: gridTransform(index),
      });
    });
  }
}

startGeneratedSimulationWorker({
  config: geometryGalleryConfig,
  systems: [{ default: GeometryGallerySetupSystem }],
});
