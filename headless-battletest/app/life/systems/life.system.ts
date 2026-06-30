import { createSystem, material, mesh } from "@aperture-engine/app/systems";

// Deterministic Conway's Game of Life. Grid state lives in the system; one
// generation advances per fixed step. Live cells are spawned/despawned as cubes
// so the same app also renders. Initial pattern = a blinker (oscillator,
// period 2) + a block (still life) — both have well-known invariants used by
// the headless tests.
const W = 16;
const H = 16;
const CELL = 0.6;

export default class LifeSystem extends createSystem({ priority: 0 }) {
  #grid = new Uint8Array(W * H);
  #cells: { index: number; generation: number }[] = [];

  override init(): void {
    this.spawn.camera({
      key: "cam",
      transform: { translation: [0, 0, 18], lookAt: [0, 0, 0] },
      fovYDegrees: 55,
    });
    this.spawn.light({ key: "sun", kind: "directional", illuminance: 4 });

    // Blinker (horizontal, 3 cells) around (4,4)
    this.#set(3, 4, 1);
    this.#set(4, 4, 1);
    this.#set(5, 4, 1);
    // Block (still life, 2x2) around (10,10)
    this.#set(10, 10, 1);
    this.#set(11, 10, 1);
    this.#set(10, 11, 1);
    this.#set(11, 11, 1);

    this.#render();
    this.#publish();
  }

  override update(): void {
    const next = new Uint8Array(W * H);
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        const n = this.#neighbors(x, y);
        const alive = this.#grid[y * W + x] === 1;
        next[y * W + x] = (alive ? n === 2 || n === 3 : n === 3) ? 1 : 0;
      }
    }
    this.#grid = next;
    this.#render();
    this.#publish();
  }

  #publish(): void {
    const gen = this.signals.generation;
    const live = this.signals.liveCount;
    const horiz = this.signals.blinkerHorizontal;
    if (gen) gen.value = Number(gen.value) + (this.time.frame > 0 ? 1 : 0);
    if (live) {
      let count = 0;
      for (let i = 0; i < this.#grid.length; i += 1) count += this.#grid[i]!;
      live.value = count;
    }
    // Blinker orientation probe: cell to the right of center (5,4) is live only
    // when the blinker is horizontal.
    if (horiz) horiz.value = this.#grid[4 * W + 5] === 1;
  }

  #neighbors(x: number, y: number): number {
    let n = 0;
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        n += this.#grid[ny * W + nx]!;
      }
    }
    return n;
  }

  #set(x: number, y: number, v: number): void {
    this.#grid[y * W + x] = v as 0 | 1;
  }

  #render(): void {
    for (const ref of this.#cells) {
      this.hierarchy.despawnRecursive(ref);
    }
    this.#cells = [];
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        if (this.#grid[y * W + x] !== 1) continue;
        const e = this.spawn.mesh({
          key: `cell.${x}.${y}`,
          tags: ["cell"],
          mesh: mesh.box({ size: [CELL, CELL, CELL] }),
          material: material.standard({ baseColor: [0.3, 0.9, 0.5, 1] }),
          transform: { translation: [(x - W / 2) * CELL, (H / 2 - y) * CELL, 0] },
        });
        this.#cells.push({ index: e.index, generation: e.generation });
      }
    }
  }
}
