import {
  createDefaultRenderState,
  createUnlitMaterialAsset,
  materialAssetDependencies,
  type MeshAsset,
} from "@aperture-engine/render";
import {
  createMaterialHandle,
  type AssetRegistry,
  type Entity,
  type MaterialHandle,
  type Vec3Like,
} from "@aperture-engine/simulation";
import type { DynamicMesh, MeshAccess, MeshPublishResult } from "./meshes.js";
import type { SpawnCommands } from "./spawn/types.js";

export interface GroundRibbonTrailOptions {
  readonly label?: string;
  readonly width?: number;
  readonly maxSegments?: number;
  readonly minSegmentLength?: number;
  readonly color?: Vec3Like;
  readonly opacity?: number;
  readonly material?: string | MaterialHandle;
  readonly materialLabel?: string;
  readonly entityKey?: string;
  readonly name?: string;
  readonly tags?: readonly string[];
  readonly castShadow?: boolean;
  readonly receiveShadow?: boolean;
}

export interface GroundRibbonTrailTrackOptions {
  readonly emit?: boolean;
  readonly alpha?: number;
  readonly color?: Vec3Like;
  readonly width?: number;
}

export interface GroundRibbonTrail {
  readonly mesh: DynamicMesh;
  readonly material: MaterialHandle;
  readonly entity: Entity;
  addSegment(
    start: Vec3Like,
    end: Vec3Like,
    options?: GroundRibbonTrailTrackOptions,
  ): boolean;
  track(
    point: Vec3Like | null,
    options?: GroundRibbonTrailTrackOptions,
  ): boolean;
  flush(): MeshPublishResult | null;
  getMeshAsset(): MeshAsset;
}

export interface TrailAccess {
  groundRibbon(
    id: string,
    options?: GroundRibbonTrailOptions,
  ): GroundRibbonTrail;
}

export function createTrailAccess(options: {
  readonly registry: AssetRegistry;
  readonly meshes: MeshAccess;
  readonly spawn: SpawnCommands;
}): TrailAccess {
  return {
    groundRibbon(id, trailOptions = {}) {
      return new GroundRibbonTrailImpl(options, id, trailOptions);
    },
  };
}

const DEFAULT_MAX_SEGMENTS = 4096;
const VERTS_PER_SEGMENT = 6;
const FLOATS_PER_VERTEX = 12;
const FLOATS_PER_SEGMENT = VERTS_PER_SEGMENT * FLOATS_PER_VERTEX;
const VERTEX_STRIDE_BYTES = FLOATS_PER_VERTEX * 4;

class GroundRibbonTrailImpl implements GroundRibbonTrail {
  readonly mesh: DynamicMesh;
  readonly material: MaterialHandle;
  readonly entity: Entity;

  readonly #width: number;
  readonly #minSegmentLength: number;
  readonly #color: readonly [number, number, number];
  readonly #maxSegments: number;
  readonly #label: string;
  readonly #vertices: Float32Array;
  readonly #indices: Uint16Array | Uint32Array;
  #segmentIndex = 0;
  #drawSegments = 0;
  #prev: readonly [number, number, number] = [0, 0, 0];
  #active = false;
  #dirty = false;
  #min: readonly [number, number, number] = [0, 0, 0];
  #max: readonly [number, number, number] = [0, 0, 0];
  #boundsInit = false;

  constructor(
    access: {
      readonly registry: AssetRegistry;
      readonly meshes: MeshAccess;
      readonly spawn: SpawnCommands;
    },
    id: string,
    options: GroundRibbonTrailOptions,
  ) {
    const label = options.label ?? `Ground ribbon ${id}`;
    this.#label = label;
    this.#maxSegments = Math.max(
      1,
      Math.trunc(options.maxSegments ?? DEFAULT_MAX_SEGMENTS),
    );
    this.#width = finitePositive(options.width, 0.08);
    this.#minSegmentLength = finitePositive(options.minSegmentLength, 0.001);
    this.#color = tuple3(options.color ?? [1, 1, 1]);
    this.#vertices = new Float32Array(this.#maxSegments * FLOATS_PER_SEGMENT);
    this.#indices = createSequentialIndexBuffer(
      this.#maxSegments * VERTS_PER_SEGMENT,
    );
    this.material = materialHandleFrom(options.material ?? `${id}.material`);
    ensureTrailMaterial(access.registry, this.material, {
      label: options.materialLabel ?? `${label} material`,
      opacity: finiteUnit(options.opacity, 1),
    });
    this.mesh = access.meshes.dynamic(id, {
      label,
      initial: this.getMeshAsset(),
    });
    this.entity = access.spawn.mesh({
      key: options.entityKey ?? `${this.mesh.key}.entity`,
      name: options.name ?? label,
      ...(options.tags === undefined ? {} : { tags: options.tags }),
      mesh: this.mesh.handle,
      material: this.material,
      castShadow: options.castShadow ?? false,
      ...(options.receiveShadow === undefined
        ? {}
        : { receiveShadow: options.receiveShadow }),
    });
  }

  addSegment(
    start: Vec3Like,
    end: Vec3Like,
    options: GroundRibbonTrailTrackOptions = {},
  ): boolean {
    const prev = tuple3(start);
    const curr = tuple3(end);
    let dx = curr[0] - prev[0];
    const dz = curr[2] - prev[2];
    const len = Math.hypot(dx, dz);

    if (len < this.#minSegmentLength) {
      return false;
    }

    dx /= len;
    const ndz = dz / len;
    const width = finitePositive(options.width, this.#width);
    const sx = ndz * width;
    const sz = -dx * width;
    const alpha = finiteUnit(options.alpha, 1);
    const color = tuple3(options.color ?? this.#color);

    const pL = [prev[0] + sx, prev[1], prev[2] + sz] as const;
    const pR = [prev[0] - sx, prev[1], prev[2] - sz] as const;
    const cL = [curr[0] + sx, curr[1], curr[2] + sz] as const;
    const cR = [curr[0] - sx, curr[1], curr[2] - sz] as const;
    const quad = [pL, pR, cL, pR, cR, cL] as const;

    let offset = this.#segmentIndex * FLOATS_PER_SEGMENT;
    for (const point of quad) {
      this.#vertices[offset] = point[0];
      this.#vertices[offset + 1] = point[1];
      this.#vertices[offset + 2] = point[2];
      this.#vertices[offset + 3] = 0;
      this.#vertices[offset + 4] = 1;
      this.#vertices[offset + 5] = 0;
      this.#vertices[offset + 6] = 0;
      this.#vertices[offset + 7] = 0;
      this.#vertices[offset + 8] = color[0];
      this.#vertices[offset + 9] = color[1];
      this.#vertices[offset + 10] = color[2];
      this.#vertices[offset + 11] = alpha;
      this.#expandBounds(point);
      offset += FLOATS_PER_VERTEX;
    }

    this.#segmentIndex = (this.#segmentIndex + 1) % this.#maxSegments;
    if (this.#drawSegments < this.#maxSegments) {
      this.#drawSegments += 1;
    }
    this.#dirty = true;
    return true;
  }

  track(
    point: Vec3Like | null,
    options: GroundRibbonTrailTrackOptions = {},
  ): boolean {
    if (point === null) {
      return false;
    }

    const curr = tuple3(point);
    const emit = options.emit ?? true;
    const wrote =
      emit && this.#active ? this.addSegment(this.#prev, curr, options) : false;

    this.#prev = curr;
    this.#active = emit;
    return wrote;
  }

  flush(): MeshPublishResult | null {
    if (!this.#dirty) {
      return null;
    }

    this.#dirty = false;
    return this.mesh.publish(this.getMeshAsset());
  }

  getMeshAsset(): MeshAsset {
    const vertexCount = this.#maxSegments * VERTS_PER_SEGMENT;
    const indexCount = this.#drawSegments * VERTS_PER_SEGMENT;
    const center = [
      (this.#min[0] + this.#max[0]) * 0.5,
      (this.#min[1] + this.#max[1]) * 0.5,
      (this.#min[2] + this.#max[2]) * 0.5,
    ] as const;
    const radius =
      Math.hypot(
        this.#max[0] - center[0],
        this.#max[1] - center[1],
        this.#max[2] - center[2],
      ) || 0.001;

    return {
      kind: "mesh",
      label: this.#label,
      vertexStreams: [
        {
          id: "ground-ribbon-interleaved",
          arrayStride: VERTEX_STRIDE_BYTES,
          vertexCount,
          attributes: [
            { semantic: "POSITION", format: "float32x3", offset: 0 },
            { semantic: "NORMAL", format: "float32x3", offset: 12 },
            { semantic: "TEXCOORD_0", format: "float32x2", offset: 24 },
            { semantic: "COLOR_0", format: "float32x4", offset: 32 },
          ],
          data: this.#vertices,
        },
      ],
      indexBuffer: {
        format: this.#indices instanceof Uint16Array ? "uint16" : "uint32",
        data: this.#indices,
        indexCount,
      },
      submeshes: [
        {
          label: "default",
          topology: "triangle-list",
          materialSlot: 0,
          vertexStart: 0,
          vertexCount,
          indexStart: 0,
          indexCount,
        },
      ],
      materialSlots: [{ index: 0, label: "default" }],
      localAabb: { min: [...this.#min], max: [...this.#max] },
      localSphere: { center, radius },
    };
  }

  #expandBounds(point: readonly [number, number, number]): void {
    if (!this.#boundsInit) {
      this.#min = point;
      this.#max = point;
      this.#boundsInit = true;
      return;
    }

    this.#min = [
      Math.min(this.#min[0], point[0]),
      Math.min(this.#min[1], point[1]),
      Math.min(this.#min[2], point[2]),
    ];
    this.#max = [
      Math.max(this.#max[0], point[0]),
      Math.max(this.#max[1], point[1]),
      Math.max(this.#max[2], point[2]),
    ];
  }
}

function ensureTrailMaterial(
  registry: AssetRegistry,
  handle: MaterialHandle,
  options: { readonly label: string; readonly opacity: number },
): void {
  const entry = registry.get<"material">(handle);
  if (entry?.status === "ready" && entry.asset !== null) {
    return;
  }

  const asset = createUnlitMaterialAsset({
    label: options.label,
    baseColorFactor: new Float32Array([1, 1, 1, options.opacity]),
    renderState: createDefaultRenderState({
      alphaMode: "blend",
      cullMode: "none",
      depth: { test: true, write: false, compare: "less" },
      blend: { preset: "alpha" },
    }),
  });

  if (!registry.has(handle)) {
    registry.register(handle, {
      label: options.label,
      dependencies: materialAssetDependencies(asset),
    });
  }
  registry.markReady(handle, asset);
}

function materialHandleFrom(input: string | MaterialHandle): MaterialHandle {
  return typeof input === "string" ? createMaterialHandle(input) : input;
}

function createSequentialIndexBuffer(count: number): Uint16Array | Uint32Array {
  const indices =
    count <= 0xffff ? new Uint16Array(count) : new Uint32Array(count);
  for (let index = 0; index < count; index += 1) {
    indices[index] = index;
  }
  return indices;
}

function tuple3(input: Vec3Like): readonly [number, number, number] {
  return [
    finiteNumber(input[0], 0),
    finiteNumber(input[1], 0),
    finiteNumber(input[2], 0),
  ];
}

function finitePositive(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

function finiteUnit(value: number | undefined, fallback: number): number {
  return clamp01(finiteNumber(value, fallback));
}

function finiteNumber(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}
