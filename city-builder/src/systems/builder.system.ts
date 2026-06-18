import {
  AudioSimulationSpace,
  LocalTransform,
  createSystem,
  quatFromEulerYXZ,
  type Entity,
  type InputButtonAction,
  type Vec3Tuple as Vec3,
} from "@aperture-engine/app/systems";
import type { EcsEntityRef } from "@aperture-engine/app/config";
import {
  CITY_BUILD_CHANNEL,
  SELECTOR_LERP,
  STARTING_CASH,
  STRUCTURES,
  cellKey,
  lerp,
  snapToGrid,
  type CityBuildCommand,
} from "../lib/city-data.js";

interface PlacedCell {
  readonly ref: EcsEntityRef;
  readonly index: number;
  readonly orientation: number;
}

const PREVIEW_HOVER_Y = 0.35; // floats clearly above the surface (a held ghost)
const PREVIEW_BOB_AMPLITUDE = 0.08;
const PREVIEW_BOB_RATE = 3.5;
const SELECTOR_TILE_Y = 0.03;
const ONE_SHOT_VOICES = 12;
const PLACEMENT_CLIPS = [
  "placement-a",
  "placement-b",
  "placement-c",
  "placement-d",
];
const REMOVAL_CLIPS = ["removal-a", "removal-b", "removal-c", "removal-d"];

// The "Builder": owns the grid of placed structures, the cursor (selector tile +
// floating preview), and the place/demolish/rotate/toggle interactions. Mirrors
// scripts/builder.gd, with the GridMap replaced by spawned glTF entities keyed
// per cell and torn down via hierarchy.despawnRecursive on demolish.
export default class BuilderSystem extends createSystem({ priority: 20 }) {
  #cells = new Map<string, PlacedCell>();
  #index = 0;
  #orientation = 0; // 0..3 quarter-turns about Y
  #cash = STARTING_CASH;

  #pointer: [number, number] = [0.5, 0.5];
  #selectorPos: Vec3 = [0, 0, 0];
  #cellX = 0;
  #cellZ = 0;

  #selectorTile: Entity | null = null;
  #preview: Entity | null = null;
  #voice = 0;
  #time = 0;

  #nextWasPressed = false;
  #prevWasPressed = false;
  #demolishWasPressed = false;
  #resetWasPressed = false;

  override init(): void {
    this.#selectorTile = this.spawn.mesh({
      key: "selector.tile",
      name: "Selector",
      tags: ["selector"],
      mesh: { kind: "box", options: { size: [1, 0.06, 1] } },
      material: {
        kind: "standard",
        options: {
          baseColor: [0.05, 0.1, 0.12, 1],
          emissiveFactor: [0.15, 0.85, 1],
          roughness: 0.4,
        },
      },
      transform: { translation: [0, SELECTOR_TILE_Y, 0] },
    });
    this.#spawnPreview();
    this.#publish();
  }

  override update(delta: number): void {
    const dt = Math.min(Math.max(delta, 0), 1 / 30);
    this.#time += dt;

    let buildRequested = false;
    for (const command of this.commands.drain<CityBuildCommand>(
      CITY_BUILD_CHANNEL,
    )) {
      if (command.kind === "pointer") {
        this.#pointer = [command.x, command.y];
      } else if (command.kind === "build") {
        buildRequested = true;
      } else if (command.kind === "rotate") {
        this.#rotateSelector();
      }
    }

    // --- keyboard edges: cycle structure, demolish, reset ------------------
    if (
      this.#edge(
        "toggleNext",
        () => this.#nextWasPressed,
        (v) => (this.#nextWasPressed = v),
      )
    ) {
      this.#cycle(1);
    }
    if (
      this.#edge(
        "togglePrev",
        () => this.#prevWasPressed,
        (v) => (this.#prevWasPressed = v),
      )
    ) {
      this.#cycle(-1);
    }
    if (
      this.#edge(
        "demolish",
        () => this.#demolishWasPressed,
        (v) => (this.#demolishWasPressed = v),
      )
    ) {
      this.#removeAt(this.#cellX, this.#cellZ);
    }
    if (
      this.#edge(
        "reset",
        () => this.#resetWasPressed,
        (v) => (this.#resetWasPressed = v),
      )
    ) {
      this.#clearAll();
    }

    // --- raycast the pointer onto the ground plane (y = 0) ------------------
    const camera = this.cameras.byKey("camera.main");
    if (camera !== null) {
      const ray = camera.rayFromPointer(this.#pointer);
      const dirY = ray.direction[1];
      if (dirY < -1e-6) {
        const t = -ray.origin[1] / dirY;
        if (t > 0) {
          this.#cellX = snapToGrid(ray.origin[0] + ray.direction[0] * t);
          this.#cellZ = snapToGrid(ray.origin[2] + ray.direction[2] * t);
        }
      }
    }

    // --- glide the cursor toward the hovered cell --------------------------
    const alpha = Math.min(dt * SELECTOR_LERP, 1);
    this.#selectorPos = [
      lerp(this.#selectorPos[0], this.#cellX, alpha),
      0,
      lerp(this.#selectorPos[2], this.#cellZ, alpha),
    ];
    if (this.#selectorTile?.active === true) {
      this.#selectorTile
        .getVectorView(LocalTransform, "translation")
        .set([this.#selectorPos[0], SELECTOR_TILE_Y, this.#selectorPos[2]]);
    }
    if (this.#preview?.active === true) {
      const bob =
        PREVIEW_HOVER_Y +
        Math.sin(this.#time * PREVIEW_BOB_RATE) * PREVIEW_BOB_AMPLITUDE;
      this.#preview
        .getVectorView(LocalTransform, "translation")
        .set([this.#selectorPos[0], bob, this.#selectorPos[2]]);
    }

    if (buildRequested) {
      this.#placeAt(this.#cellX, this.#cellZ);
    }

    if (this.signals.hoverX !== undefined)
      this.signals.hoverX.value = this.#cellX;
    if (this.signals.hoverZ !== undefined)
      this.signals.hoverZ.value = this.#cellZ;
  }

  // --- placement -------------------------------------------------------------

  #placeAt(x: number, z: number): void {
    const spec = STRUCTURES[this.#index];
    if (spec === undefined) return;

    const key = cellKey(x, z);
    const existing = this.#cells.get(key);
    if (
      existing !== undefined &&
      existing.index === this.#index &&
      existing.orientation === this.#orientation
    ) {
      return; // identical structure + orientation already here (builder.gd no-op)
    }

    if (existing !== undefined) {
      this.hierarchy.despawnRecursive(existing.ref);
    }

    const entity = this.spawn.gltf(this.assets.gltf(spec.id), {
      key: `cell.${key}`,
      name: spec.name,
      tags: ["structure"],
      transform: {
        translation: [x, 0, z],
        rotation: quatFromEulerYXZ(0, (this.#orientation * Math.PI) / 2, 0),
      },
    });
    this.#cells.set(key, {
      ref: { index: entity.index, generation: entity.generation },
      index: this.#index,
      orientation: this.#orientation,
    });

    // builder.gd charges only when the cell's structure id actually changes.
    if (existing === undefined || existing.index !== this.#index) {
      this.#cash -= spec.price;
    }
    this.#playClip(PLACEMENT_CLIPS);
    this.diagnostics.info("city.structure.placed", {
      structure: spec.id,
      x,
      z,
      cash: this.#cash,
    });
    this.#publish();
  }

  #removeAt(x: number, z: number): void {
    const key = cellKey(x, z);
    const existing = this.#cells.get(key);
    if (existing === undefined) return;
    this.hierarchy.despawnRecursive(existing.ref);
    this.#cells.delete(key);
    this.#playClip(REMOVAL_CLIPS);
    this.#publish();
  }

  #clearAll(): void {
    for (const cell of this.#cells.values()) {
      this.hierarchy.despawnRecursive(cell.ref);
    }
    this.#cells.clear();
    this.#cash = STARTING_CASH;
    this.#playClip(REMOVAL_CLIPS);
    this.#publish();
  }

  // --- selection -------------------------------------------------------------

  #cycle(direction: number): void {
    const count = STRUCTURES.length;
    this.#index = (this.#index + direction + count) % count;
    this.#spawnPreview();
    this.audio.playOneShot(`city.toggle.${this.#voice % ONE_SHOT_VOICES}`, {
      clip: this.audio.clip("toggle"),
      busId: "sfx",
      gain: 0.5,
      simulationSpace: AudioSimulationSpace.Local,
    });
    this.#voice += 1;
    this.#publish();
  }

  #rotateSelector(): void {
    this.#orientation = (this.#orientation + 1) % 4;
    if (this.#preview?.active === true) {
      this.#preview
        .getVectorView(LocalTransform, "rotation")
        .set(quatFromEulerYXZ(0, (this.#orientation * Math.PI) / 2, 0));
    }
    this.audio.playOneShot(`city.rotate.${this.#voice % ONE_SHOT_VOICES}`, {
      clip: this.audio.clip("rotate"),
      busId: "sfx",
      gain: 0.4,
      simulationSpace: AudioSimulationSpace.Local,
    });
    this.#voice += 1;
  }

  #spawnPreview(): void {
    if (this.#preview?.active === true) {
      this.hierarchy.despawnRecursive({
        index: this.#preview.index,
        generation: this.#preview.generation,
      });
    }
    const spec = STRUCTURES[this.#index];
    if (spec === undefined) {
      this.#preview = null;
      return;
    }
    this.#preview = this.spawn.gltf(this.assets.gltf(spec.id), {
      key: "selector.preview",
      name: "Preview",
      tags: ["selector"],
      transform: {
        translation: [
          this.#selectorPos[0],
          PREVIEW_HOVER_Y,
          this.#selectorPos[2],
        ],
        rotation: quatFromEulerYXZ(0, (this.#orientation * Math.PI) / 2, 0),
      },
    });
  }

  // --- helpers ---------------------------------------------------------------

  #playClip(clips: readonly string[]): void {
    const clip = clips[Math.floor(Math.random() * clips.length)] ?? clips[0];
    if (clip === undefined) return;
    this.audio.playOneShot(`city.sfx.${this.#voice % ONE_SHOT_VOICES}`, {
      clip: this.audio.clip(clip),
      busId: "sfx",
      gain: 0.7,
      timeScale: 0.9 + Math.random() * 0.2,
      simulationSpace: AudioSimulationSpace.Local,
    });
    this.#voice += 1;
  }

  #publish(): void {
    const spec = STRUCTURES[this.#index];
    if (this.signals.cash !== undefined) this.signals.cash.value = this.#cash;
    if (this.signals.structureIndex !== undefined)
      this.signals.structureIndex.value = this.#index;
    if (this.signals.cellCount !== undefined)
      this.signals.cellCount.value = this.#cells.size;
    if (spec !== undefined) {
      if (this.signals.structureName !== undefined)
        this.signals.structureName.value = spec.name;
      if (this.signals.structurePrice !== undefined)
        this.signals.structurePrice.value = spec.price;
    }
  }

  #edge(
    name: string,
    get: () => boolean,
    set: (value: boolean) => void,
  ): boolean {
    const action = this.actions[name];
    const button =
      action?.kind === "button" ? (action as InputButtonAction) : null;
    const down = button?.down() === true;
    const pressed = button?.pressed() === true;
    const edge = down || (pressed && !get());
    set(pressed);
    return edge;
  }
}
