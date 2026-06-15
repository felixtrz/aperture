import { createSystem } from "@aperture-engine/app/systems";
import {
  CELL_RAW,
  GRID_SCALE,
  computeDecorationBuckets,
  resolveTrackCells,
  type DecorationInstance,
} from "../lib/track.js";

// trackGroup.position.y(-0.5) + scale*0.5 — same plane the track pieces sit on.
const GROUP_Y = GRID_SCALE * 0.5 - 0.5;

// Shadow-test trim: racing surrounds the track with a ~300-tile forest border
// (normally hidden by fog). With fog stripped for shadow work that field reads
// as "trees forever", so keep only decorations within this world-space radius of
// the track area — a clean clump of ground + a few trees, no sprawling forest.
const KEEP_RADIUS = 30;

const BUCKET_ASSET: Record<string, string> = {
  empty: "decoration-empty",
  forest: "decoration-forest",
  tents: "decoration-tents",
};

// Port of Decoration.js: instanced forest / tents / empty-ground tiles placed on a
// padded ring around the track (placement algorithm lives in computeDecorationBuckets).
// Replaces the temp green ground plane — the reference draws no ground mesh; the green
// comes entirely from these decoration-empty tiles, and the rest fades to fog.
export default class DecorationsSystem extends createSystem({ priority: 10 }) {
  override init(): void {
    // DISABLED for the minimal single-tree shadow-verification scene. Restore
    // the three #spawnBucket calls (and setup.system.ts) via git to bring back
    // the full racing static scene.
    return;
    // eslint-disable-next-line no-unreachable
    const { cells, customMap } = resolveTrackCells(this.world);
    const buckets = computeDecorationBuckets(cells, customMap);
    this.#spawnBucket("empty", buckets.empty);
    this.#spawnBucket("forest", buckets.forest);
    this.#spawnBucket("tents", buckets.tents);
  }

  #spawnBucket(bucket: string, instances: readonly DecorationInstance[]): void {
    const assetId = BUCKET_ASSET[bucket];
    if (assetId === undefined) return;
    instances.forEach((deco, i) => {
      const wx = GRID_SCALE * deco.x;
      const wz = GRID_SCALE * deco.z;
      if (Math.hypot(wx, wz) > KEEP_RADIUS) return;
      this.spawn.gltf(this.assets.gltf(assetId), {
        key: `deco.${bucket}.${i}`,
        name: `deco.${bucket}.${i}`,
        tags: ["decoration", `deco-${bucket}`],
        castShadow: true,
        receiveShadow: true,
        transform: {
          translation: [GRID_SCALE * deco.x, GROUP_Y, GRID_SCALE * deco.z],
          scale: [GRID_SCALE, GRID_SCALE, GRID_SCALE],
          rotationEulerDegrees: [0, deco.rotQuarters * 90, 0],
        },
      });
    });
  }
}

void CELL_RAW;
