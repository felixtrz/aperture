import {
  createSystem,
  type Vec3Tuple as Vec3,
} from "@aperture-engine/app/systems";
import {
  CELL_RAW,
  GRID_SCALE,
  computeSpawnPosition,
  resolveTrackCells,
} from "../lib/track.js";
import { VehicleResource } from "../lib/vehicle-resource.js";

const CELL_SIZE = CELL_RAW * GRID_SCALE;

// Port of LapTimer.js: detect finish-line crossings (after all required track
// cells are visited) and drive the lap/currentLapTime/lastLapTime/bestLapTime
// signals read by the HUD (src/hud.ts). Timing starts on first input.
export default class LapTimerSystem extends createSystem({ priority: 130 }) {
  #lineCenter: Vec3 = [0, 0, 0];
  #lineForward: Vec3 = [0, 0, 1];
  #lineRight: Vec3 = [1, 0, 0];
  readonly #required = new Set<string>();
  readonly #visited = new Set<string>();
  #prevFwd = 0;
  #current = 0;
  #best = -1;
  #started = false;

  override init(): void {
    const cells = resolveTrackCells(this.world).cells;
    const spawn = computeSpawnPosition(cells);
    this.#lineCenter = [...spawn.position];
    const a = spawn.angle;
    // Car forward at yaw a is [sin a, 0, cos a] (matches Vehicle.js); right is ⟂.
    this.#lineForward = [Math.sin(a), 0, Math.cos(a)];
    this.#lineRight = [Math.cos(a), 0, -Math.sin(a)];
    for (const [gx, gz, key] of cells) {
      if (key === "track-finish") continue;
      this.#required.add(`${gx},${gz}`);
    }
    this.#prevFwd = this.#projFwd(this.#lineCenter);
  }

  override update(delta: number): void {
    const vehicle = this.resources.read(VehicleResource);

    if (!vehicle.ready) return;
    const dt = Math.min(Math.max(delta, 0), 1 / 30);
    const pos = vehicle.sphere;

    if (!this.#started) {
      if (vehicle.hadInput) {
        this.#started = true;
        this.#setSignal("started", true);
      } else {
        this.#prevFwd = this.#projFwd(pos);
        return;
      }
    }

    this.#current += dt;
    this.#setSignal("currentLapTime", round2(this.#current));

    // Track which required cells the car has visited this lap.
    const gx = Math.floor(pos[0] / CELL_SIZE);
    const gz = Math.floor(pos[2] / CELL_SIZE);
    const cellKey = `${gx},${gz}`;
    if (this.#required.has(cellKey)) this.#visited.add(cellKey);

    const fwd = this.#projFwd(pos);
    const lat = Math.abs(this.#projRight(pos));
    const crossed =
      lat <= CELL_SIZE * 0.5 &&
      Math.abs(fwd - this.#prevFwd) < 5 && // no teleport / respawn
      this.#prevFwd < 0 &&
      fwd >= 0 &&
      this.#visited.size >= this.#required.size;

    if (crossed) {
      const lap = this.#current;
      this.#setSignal("lastLapTime", round2(lap));
      if (this.#best < 0 || lap < this.#best) {
        this.#best = lap;
        this.#setSignal("bestLapTime", round2(lap));
      }
      const lapSignal = this.signals["lap"];
      const lapNum =
        (typeof lapSignal?.value === "number" ? lapSignal.value : 1) + 1;
      this.#setSignal("lap", lapNum);
      this.#current = 0;
      this.#visited.clear();
    }
    this.#prevFwd = fwd;
  }

  #projFwd(p: Vec3): number {
    return (
      (p[0] - this.#lineCenter[0]) * this.#lineForward[0] +
      (p[2] - this.#lineCenter[2]) * this.#lineForward[2]
    );
  }

  #projRight(p: Vec3): number {
    return (
      (p[0] - this.#lineCenter[0]) * this.#lineRight[0] +
      (p[2] - this.#lineCenter[2]) * this.#lineRight[2]
    );
  }

  #setSignal(name: string, value: number | boolean): void {
    const signal = this.signals[name];
    if (signal !== undefined) signal.value = value;
  }
}

function round2(t: number): number {
  return Number(t.toFixed(2));
}
