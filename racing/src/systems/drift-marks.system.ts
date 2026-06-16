import {
  clamp01,
  createSystem,
  type DynamicMesh,
  type MeshAccess,
  type Vec3Tuple as Vec3,
} from "@aperture-engine/app/systems";
import {
  createDefaultRenderState,
  createUnlitMaterialAsset,
  materialAssetDependencies,
  type MeshAsset,
} from "@aperture-engine/render";
import {
  createMaterialHandle,
  type MaterialHandle,
} from "@aperture-engine/simulation";
import { VehicleResource } from "../lib/vehicle-resource.js";

// Port of DriftMarks.js (REFERENCE_SPEC §7). Two dynamic vertex-colored triangle
// meshes (one per rear wheel) laid flat on the ground. Each drift step appends a
// quad (2 triangles, 6 verts) connecting the wheel's previous and current ground
// position. The unlit material is the MeshBasicMaterial analogue: vertex colors,
// transparent at opacity 0.5, explicit depthWrite off, double-sided
// (cullMode "none"). polygonOffset is not yet an engine render-state field, so
// we keep the reference's Y_OFFSET (0.05) to avoid z-fighting with the ground; if
// shimmering appears at grazing angles, that is the only gap — see the
// "needs-engine-patch" note for the exact polygonOffset wiring.

const MAX_SEGMENTS = 4096;
const VERTS_PER_SEGMENT = 6;
const FLOATS_PER_VERTEX = 12; // POSITION(3) + NORMAL(3) + TEXCOORD_0(2) + COLOR_0(4)
const FLOATS_PER_SEGMENT = VERTS_PER_SEGMENT * FLOATS_PER_VERTEX;
const VERTEX_STRIDE_BYTES = FLOATS_PER_VERTEX * 4;

const WIDTH = 0.08;
const Y_OFFSET = 0.05;
const MIN_SEGMENT_LENGTH = 0.02;
const INTENSITY_MIN = 0.5;
const INTENSITY_MAX = 2.0;
const INV_INTENSITY_RANGE = 1 / (INTENSITY_MAX - INTENSITY_MIN);

// MeshBasicMaterial color 0x111111 → 0.0667 baseColorFactor RGB; the per-vertex
// alpha carries the fade and the material opacity 0.5 multiplies in.
const MARK_RGB = 0x11 / 0xff;
const MATERIAL_OPACITY = 0.5;

// One ground-projected wheel trail backed by an interleaved typed-array vertex
// buffer and a matching index buffer. Mutated in place, then published through
// the dynamic mesh helper so the renderer re-uploads the GPU buffers.
class DriftTrail {
  readonly mesh: DynamicMesh;
  readonly #vertices = new Float32Array(MAX_SEGMENTS * FLOATS_PER_SEGMENT);
  readonly #indices: Uint16Array;
  #segmentIndex = 0;
  #drawSegments = 0;
  #prev: Vec3 = [0, 0, 0];
  #active = false;
  #dirty = false;
  #min: Vec3 = [0, 0, 0];
  #max: Vec3 = [0, 0, 0];
  #boundsInit = false;

  constructor(meshes: MeshAccess, id: string) {
    // 6 indices per segment. uint16 caps at 65535 verts = ~10922 segments >
    // 4096*6=24576, so uint16 is safe.
    const indexCount = MAX_SEGMENTS * VERTS_PER_SEGMENT;
    this.#indices = new Uint16Array(indexCount);
    for (let i = 0; i < indexCount; i += 1) this.#indices[i] = i;

    this.mesh = meshes.dynamic(`racing.driftMarks.${id}`, {
      label: `Drift trail ${id}`,
      // Publish an initial empty mesh so the entity has a ready mesh at spawn;
      // indexCount 0 renders nothing until the first segment is written.
      initial: this.#buildAsset(id),
    });
  }

  /** Reference DriftTrail.track: project wheel to groundY, emit a segment. */
  track(
    wheel: Vec3 | null,
    groundY: number,
    intensity: number,
    emit: boolean,
  ): void {
    if (wheel === null) return;
    const curr: Vec3 = [wheel[0], groundY, wheel[2]];
    if (emit && this.#active) {
      const alpha = clamp01((intensity - INTENSITY_MIN) * INV_INTENSITY_RANGE);
      this.#writeSegment(this.#prev, curr, alpha);
    }
    this.#prev = curr;
    this.#active = emit;
  }

  /** Publish the mutated buffers (bumps mesh version for GPU re-upload). */
  flush(id: string): void {
    if (!this.#dirty) return;
    this.mesh.publish(this.#buildAsset(id));
    this.#dirty = false;
  }

  #writeSegment(prev: Vec3, curr: Vec3, alpha: number): void {
    let dx = curr[0] - prev[0];
    const dz = curr[2] - prev[2];
    const len = Math.hypot(dx, dz);
    if (len < MIN_SEGMENT_LENGTH) return;
    dx /= len;
    const ndz = dz / len;
    const sx = ndz * WIDTH;
    const sz = -dx * WIDTH;

    const pL: Vec3 = [prev[0] + sx, prev[1], prev[2] + sz];
    const pR: Vec3 = [prev[0] - sx, prev[1], prev[2] - sz];
    const cL: Vec3 = [curr[0] + sx, curr[1], curr[2] + sz];
    const cR: Vec3 = [curr[0] - sx, curr[1], curr[2] - sz];

    // CCW winding from above (matches the reference); also double-sided.
    const quad: readonly Vec3[] = [pL, pR, cL, pR, cR, cL];
    let o = this.#segmentIndex * FLOATS_PER_SEGMENT;
    for (const v of quad) {
      this.#vertices[o] = v[0];
      this.#vertices[o + 1] = v[1];
      this.#vertices[o + 2] = v[2];
      this.#vertices[o + 3] = 0;
      this.#vertices[o + 4] = 1; // NORMAL up
      this.#vertices[o + 5] = 0;
      this.#vertices[o + 6] = 0;
      this.#vertices[o + 7] = 0;
      this.#vertices[o + 8] = MARK_RGB;
      this.#vertices[o + 9] = MARK_RGB;
      this.#vertices[o + 10] = MARK_RGB;
      this.#vertices[o + 11] = alpha;
      o += FLOATS_PER_VERTEX;
      this.#expandBounds(v);
    }

    this.#segmentIndex = (this.#segmentIndex + 1) % MAX_SEGMENTS;
    if (this.#drawSegments < MAX_SEGMENTS) this.#drawSegments += 1;
    this.#dirty = true;
  }

  #expandBounds(v: Vec3): void {
    if (!this.#boundsInit) {
      this.#min = [v[0], v[1], v[2]];
      this.#max = [v[0], v[1], v[2]];
      this.#boundsInit = true;
      return;
    }
    this.#min = [
      Math.min(this.#min[0], v[0]),
      Math.min(this.#min[1], v[1]),
      Math.min(this.#min[2], v[2]),
    ];
    this.#max = [
      Math.max(this.#max[0], v[0]),
      Math.max(this.#max[1], v[1]),
      Math.max(this.#max[2], v[2]),
    ];
  }

  #buildAsset(id: string): MeshAsset {
    const vertexCount = MAX_SEGMENTS * VERTS_PER_SEGMENT;
    const indexCount = this.#drawSegments * VERTS_PER_SEGMENT;
    const center: Vec3 = [
      (this.#min[0] + this.#max[0]) * 0.5,
      (this.#min[1] + this.#max[1]) * 0.5,
      (this.#min[2] + this.#max[2]) * 0.5,
    ];
    const radius = Math.hypot(
      this.#max[0] - center[0],
      this.#max[1] - center[1],
      this.#max[2] - center[2],
    );

    return {
      kind: "mesh",
      label: `Drift trail ${id}`,
      vertexStreams: [
        {
          id: "drift-interleaved",
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
        format: "uint16",
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
      localSphere: { center, radius: radius || 0.001 },
    };
  }
}

export default class DriftMarksSystem extends createSystem({ priority: 135 }) {
  #trails: DriftTrail[] = [];

  override init(): void {
    const registry = this.assetsRegistry;

    // Shared unlit material: MeshBasicMaterial analogue. Blend materials must
    // author depth writes off explicitly; cullMode "none" is double-sided.
    const materialHandle = createMaterialHandle("racing.driftMarks.material");
    const materialAsset = createUnlitMaterialAsset({
      label: "Drift marks",
      baseColorFactor: new Float32Array([1, 1, 1, MATERIAL_OPACITY]),
      renderState: createDefaultRenderState({
        alphaMode: "blend",
        cullMode: "none",
        depth: { test: true, write: false, compare: "less" },
        blend: { preset: "alpha" },
      }),
    });
    if (!registry.has(materialHandle)) {
      registry.register(materialHandle, {
        label: "Drift marks",
        dependencies: materialAssetDependencies(materialAsset),
      });
    }
    registry.markReady(materialHandle, materialAsset);
    this.#trails = [
      new DriftTrail(this.meshes, "bl"),
      new DriftTrail(this.meshes, "br"),
    ];

    // Spawn one render entity per trail. The pre-registered mesh + material
    // handles pass straight through; spawn.mesh sets Mesh.meshId / Material.materialId
    // to the handle keys, and the renderer resolves the live registry version each
    // frame (so the per-frame markReady re-uploads).
    for (const trail of this.#trails) {
      this.spawn.mesh({
        key: `${trail.mesh.key}.entity`,
        name: trail.mesh.key,
        tags: ["drift-marks"],
        mesh: trail.mesh.handle,
        material: materialHandle,
        castShadow: false,
      });
    }
  }

  override update(): void {
    const vehicle = this.resources.read(VehicleResource);

    if (!vehicle.ready || this.#trails.length === 0) return;

    const emit =
      vehicle.driftIntensity > 0.5 && Math.abs(vehicle.linearSpeed) > 0.15;

    const bl = this.#trails[0];
    const br = this.#trails[1];
    if (bl === undefined || br === undefined) return;

    const groundY = vehicle.container[1] + Y_OFFSET;
    const intensity = vehicle.driftIntensity;

    bl.track(vehicle.wheelBL, groundY, intensity, emit);
    br.track(vehicle.wheelBR, groundY, intensity, emit);

    bl.flush("bl");
    br.flush("br");
  }
}
