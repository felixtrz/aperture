import {
  clamp01,
  createSystem,
  type GroundRibbonTrail,
  type Vec3Tuple as Vec3,
} from "@aperture-engine/app/systems";
import { VehicleResource } from "../lib/vehicle-resource.js";

// Port of DriftMarks.js (REFERENCE_SPEC §7). Aperture owns the dynamic
// ground-ribbon mesh layout, material registration, bounds, and version bumps;
// racing only decides when each rear wheel should append a faded segment.

const MAX_SEGMENTS = 4096;
const WIDTH = 0.08;
const Y_OFFSET = 0.05;
const MIN_SEGMENT_LENGTH = 0.02;
const INTENSITY_MIN = 0.5;
const INTENSITY_MAX = 2.0;
const INV_INTENSITY_RANGE = 1 / (INTENSITY_MAX - INTENSITY_MIN);
const DEPTH_BIAS = -2;

// MeshBasicMaterial color 0x111111 -> 0.0667 baseColorFactor RGB; the
// per-vertex alpha carries the fade and the material opacity 0.5 multiplies in.
const MARK_RGB = 0x11 / 0xff;
const MATERIAL_OPACITY = 0.5;

export default class DriftMarksSystem extends createSystem({ priority: 135 }) {
  #trails: GroundRibbonTrail[] = [];

  override init(): void {
    this.#trails = [this.#createTrail("bl"), this.#createTrail("br")];
  }

  override update(): void {
    const vehicle = this.resources.read(VehicleResource);

    if (!vehicle.ready || this.#trails.length === 0) return;

    const emit =
      vehicle.driftIntensity > INTENSITY_MIN &&
      Math.abs(vehicle.linearSpeed) > 0.15;
    const alpha = clamp01(
      (vehicle.driftIntensity - INTENSITY_MIN) * INV_INTENSITY_RANGE,
    );
    const groundY = vehicle.container[1] + Y_OFFSET;

    this.#track(this.#trails[0], vehicle.wheelBL, groundY, emit, alpha);
    this.#track(this.#trails[1], vehicle.wheelBR, groundY, emit, alpha);

    this.#trails[0]?.flush();
    this.#trails[1]?.flush();
  }

  #createTrail(id: "bl" | "br"): GroundRibbonTrail {
    return this.trails.groundRibbon(`racing.driftMarks.${id}`, {
      label: `Drift trail ${id}`,
      material: "racing.driftMarks.material",
      materialLabel: "Drift marks",
      width: WIDTH,
      maxSegments: MAX_SEGMENTS,
      minSegmentLength: MIN_SEGMENT_LENGTH,
      color: [MARK_RGB, MARK_RGB, MARK_RGB],
      opacity: MATERIAL_OPACITY,
      depthBias: DEPTH_BIAS,
      tags: ["drift-marks"],
      castShadow: false,
      receiveShadow: false,
    });
  }

  #track(
    trail: GroundRibbonTrail | undefined,
    wheel: Vec3 | null,
    groundY: number,
    emit: boolean,
    alpha: number,
  ): void {
    if (trail === undefined) {
      return;
    }

    trail.track(wheel === null ? null : [wheel[0], groundY, wheel[2]], {
      emit,
      alpha,
    });
  }
}
