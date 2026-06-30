import {
  AppEntityKey,
  LocalTransform,
  createSystem,
  material,
  mesh,
  vec3Add,
  vec3AddScaled,
  vec3Distance,
  vec3Length,
  vec3Normalize,
  vec3Scale,
  vec3Subtract,
} from "@aperture-engine/app/systems";

// Deterministic boids: positions live in LocalTransform; velocities in a
// private array keyed by stable entity refs (iteration order is stable, so
// replay is bit-identical for a given seed + step schedule). All randomness is
// confined to init via context.random; integration uses context.time.delta.
const BOID_COUNT = 36;
const BOUND = 8;
const NEIGHBOR_RADIUS = 3;
const SEPARATION_RADIUS = 1.2;
const MAX_SPEED = 4;
const MIN_SPEED = 1.5;
const SEP_WEIGHT = 1.6;
const ALIGN_WEIGHT = 1.0;
const COH_WEIGHT = 0.9;

type Vec3 = [number, number, number];

interface Boid {
  readonly index: number;
  readonly generation: number;
  vel: Vec3;
}

export default class FlockSystem extends createSystem({
  priority: 10,
  queries: { boids: { required: [AppEntityKey, LocalTransform] } },
}) {
  #boids: Boid[] = [];

  override init(): void {
    this.spawn.camera({
      key: "boids.camera",
      transform: { translation: [0, 18, 22], lookAt: [0, 0, 0] },
      fovYDegrees: 55,
    });
    this.spawn.light({
      key: "boids.sun",
      kind: "directional",
      illuminance: 4,
      transform: { rotationEulerDegrees: [-50, 30, 0] },
    });
    this.spawn.light({ key: "boids.fill", kind: "ambient", intensity: 0.4 });

    for (let i = 0; i < BOID_COUNT; i += 1) {
      const pos: Vec3 = [
        this.random.range(-BOUND, BOUND),
        this.random.range(-2, 2),
        this.random.range(-BOUND, BOUND),
      ];
      const vel: Vec3 = [
        this.random.range(-1, 1),
        this.random.range(-0.3, 0.3),
        this.random.range(-1, 1),
      ];
      const entity = this.spawn.mesh({
        key: `boid.${i}`,
        tags: ["boid"],
        mesh: mesh.box({ size: [0.4, 0.4, 0.7] }),
        material: material.standard({
          baseColor: [0.3 + (i % 5) * 0.12, 0.7, 1, 1],
          roughness: 0.5,
        }),
        transform: { translation: pos },
      });
      this.#boids.push({ index: entity.index, generation: entity.generation, vel });
    }

    const count = this.signals.boidCount;
    if (count) count.value = BOID_COUNT;
  }

  override update(delta: number): void {
    if (delta <= 0) return;
    const positions = this.#readPositions();
    if (positions.length === 0) return;

    const nextVel: Vec3[] = [];
    let speedSum = 0;
    const center: Vec3 = [0, 0, 0];

    for (let i = 0; i < this.#boids.length; i += 1) {
      const p = positions[i];
      if (p === undefined) {
        nextVel.push(this.#boids[i]!.vel);
        continue;
      }
      let sep: Vec3 = [0, 0, 0];
      let alignSum: Vec3 = [0, 0, 0];
      let cohSum: Vec3 = [0, 0, 0];
      let neighbors = 0;

      for (let j = 0; j < this.#boids.length; j += 1) {
        if (i === j) continue;
        const q = positions[j];
        if (q === undefined) continue;
        const d = vec3Distance(p, q);
        if (d > NEIGHBOR_RADIUS || d === 0) continue;
        neighbors += 1;
        alignSum = vec3Add(alignSum, this.#boids[j]!.vel);
        cohSum = vec3Add(cohSum, q);
        if (d < SEPARATION_RADIUS) {
          sep = vec3AddScaled(sep, vec3Subtract(p, q), 1 / d);
        }
      }

      let v = this.#boids[i]!.vel;
      if (neighbors > 0) {
        const align = vec3Subtract(vec3Scale(alignSum, 1 / neighbors), v);
        const cohesion = vec3Subtract(vec3Scale(cohSum, 1 / neighbors), p);
        v = vec3AddScaled(v, align, ALIGN_WEIGHT * delta);
        v = vec3AddScaled(v, cohesion, COH_WEIGHT * delta);
      }
      v = vec3AddScaled(v, sep, SEP_WEIGHT * delta);
      v = this.#clampSpeed(v);
      nextVel.push(v);
      speedSum += vec3Length(v);
    }

    // Integrate + wrap, then commit velocities.
    for (let i = 0; i < this.#boids.length; i += 1) {
      const p = positions[i];
      const v = nextVel[i];
      if (p === undefined || v === undefined) continue;
      const np = this.#wrap(vec3AddScaled(p, v, delta));
      this.#writePosition(i, np);
      this.#boids[i]!.vel = v;
      center[0] += np[0];
      center[1] += np[1];
      center[2] += np[2];
    }

    const n = this.#boids.length;
    const avg = this.signals.avgSpeed;
    const cx = this.signals.centerX;
    const cz = this.signals.centerZ;
    if (avg) avg.value = speedSum / n;
    if (cx) cx.value = center[0] / n;
    if (cz) cz.value = center[2] / n;
  }

  #clampSpeed(v: Vec3): Vec3 {
    const speed = vec3Length(v);
    if (speed === 0) return [MIN_SPEED, 0, 0];
    if (speed > MAX_SPEED) return vec3Scale(vec3Normalize(v), MAX_SPEED);
    if (speed < MIN_SPEED) return vec3Scale(vec3Normalize(v), MIN_SPEED);
    return v;
  }

  #wrap(p: Vec3): Vec3 {
    const w = (x: number, limit: number): number =>
      x > limit ? x - 2 * limit : x < -limit ? x + 2 * limit : x;
    return [w(p[0], BOUND), Math.max(-3, Math.min(3, p[1])), w(p[2], BOUND)];
  }

  #readPositions(): Vec3[] {
    const byRef = new Map<string, Vec3>();
    for (const entity of this.queries.boids.entities) {
      const key = entity.getValue(AppEntityKey, "value");
      if (typeof key !== "string" || !key.startsWith("boid.")) continue;
      const t = entity.getVectorView(LocalTransform, "translation");
      byRef.set(key, [t[0] ?? 0, t[1] ?? 0, t[2] ?? 0]);
    }
    return this.#boids.map((_, i) => byRef.get(`boid.${i}`) ?? [0, 0, 0]);
  }

  #writePosition(i: number, p: Vec3): void {
    for (const entity of this.queries.boids.entities) {
      if (entity.getValue(AppEntityKey, "value") === `boid.${i}`) {
        const t = entity.getVectorView(LocalTransform, "translation");
        t[0] = p[0];
        t[1] = p[1];
        t[2] = p[2];
        return;
      }
    }
  }
}
