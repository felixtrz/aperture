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

const BUCKET_ASSET: Record<string, string> = {
  empty: "decoration-empty",
  forest: "decoration-forest",
  tents: "decoration-tents",
};
const GLTF_FRONT_SIDE_MATERIALS = {
  renderState: { cullMode: "back" as const },
};

// Port of Decoration.js: instanced forest / tents / empty-ground tiles placed on a
// padded ring around the track (placement algorithm lives in computeDecorationBuckets).
// Replaces the temp green ground plane — the reference draws no ground mesh; the green
// comes entirely from these decoration-empty tiles, and the rest fades to fog.
export default class DecorationsSystem extends createSystem({ priority: 10 }) {
  override init(): void {
    const { cells, customMap } = resolveTrackCells(this.startOptions);
    const buckets = computeDecorationBuckets(cells, customMap);
    this.#spawnBucket("empty", buckets.empty);
    this.#spawnBucket("forest", buckets.forest);
    this.#spawnBucket("tents", buckets.tents);
  }

  #spawnBucket(bucket: string, instances: readonly DecorationInstance[]): void {
    const assetId = BUCKET_ASSET[bucket];
    if (assetId === undefined) return;
    instances.forEach((deco, i) => {
      this.spawn.gltf(this.assets.gltf(assetId), {
        key: `deco.${bucket}.${i}`,
        name: `deco.${bucket}.${i}`,
        tags: ["decoration", `deco-${bucket}`],
        materials: GLTF_FRONT_SIDE_MATERIALS,
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
