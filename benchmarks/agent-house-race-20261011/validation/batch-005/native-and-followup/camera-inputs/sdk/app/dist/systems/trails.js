import { createDefaultRenderState, createUnlitMaterialAsset, materialAssetDependencies, } from "@aperture-engine/render";
import { createMaterialHandle, vec4, } from "@aperture-engine/simulation";
export function createTrailAccess(options) {
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
class GroundRibbonTrailImpl {
    mesh;
    material;
    entity;
    #width;
    #minSegmentLength;
    #color;
    #maxSegments;
    #label;
    #vertices;
    #indices;
    #dirtyVertexRanges = [];
    #segmentIndex = 0;
    #drawSegments = 0;
    #prev = [0, 0, 0];
    #active = false;
    #dirty = false;
    constructor(access, id, options) {
        const label = options.label ?? `Ground ribbon ${id}`;
        this.#label = label;
        this.#maxSegments = Math.max(1, Math.trunc(options.maxSegments ?? DEFAULT_MAX_SEGMENTS));
        this.#width = finitePositive(options.width, 0.08);
        this.#minSegmentLength = finitePositive(options.minSegmentLength, 0.001);
        this.#color = tuple3(options.color ?? [1, 1, 1]);
        this.#vertices = new Float32Array(this.#maxSegments * FLOATS_PER_SEGMENT);
        this.#indices = createSequentialIndexBuffer(this.#maxSegments * VERTS_PER_SEGMENT);
        this.material = materialHandleFrom(options.material ?? `${id}.material`);
        ensureTrailMaterial(access.registry, this.material, {
            label: options.materialLabel ?? `${label} material`,
            opacity: finiteUnit(options.opacity, 1),
            depthBias: finiteNumber(options.depthBias, 0),
            depthBiasSlopeScale: finiteNumber(options.depthBiasSlopeScale, 0),
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
    addSegment(start, end, options = {}) {
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
        const pL = [prev[0] + sx, prev[1], prev[2] + sz];
        const pR = [prev[0] - sx, prev[1], prev[2] - sz];
        const cL = [curr[0] + sx, curr[1], curr[2] + sz];
        const cR = [curr[0] - sx, curr[1], curr[2] - sz];
        const quad = [pL, pR, cL, pR, cR, cL];
        const dirtyFloatOffset = this.#segmentIndex * FLOATS_PER_SEGMENT;
        let offset = dirtyFloatOffset;
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
            offset += FLOATS_PER_VERTEX;
        }
        this.#dirtyVertexRanges.push({
            byteOffset: dirtyFloatOffset * Float32Array.BYTES_PER_ELEMENT,
            byteLength: FLOATS_PER_SEGMENT * Float32Array.BYTES_PER_ELEMENT,
        });
        this.#segmentIndex = (this.#segmentIndex + 1) % this.#maxSegments;
        if (this.#drawSegments < this.#maxSegments) {
            this.#drawSegments += 1;
        }
        this.#dirty = true;
        return true;
    }
    track(point, options = {}) {
        if (point === null) {
            return false;
        }
        const curr = tuple3(point);
        const emit = options.emit ?? true;
        const wrote = emit && this.#active ? this.addSegment(this.#prev, curr, options) : false;
        this.#prev = curr;
        this.#active = emit;
        return wrote;
    }
    flush() {
        if (!this.#dirty) {
            return null;
        }
        this.#dirty = false;
        const result = this.mesh.publish(this.getMeshAsset());
        this.#dirtyVertexRanges.length = 0;
        return result;
    }
    getMeshAsset() {
        const drawVertexCount = this.#drawSegments * VERTS_PER_SEGMENT;
        const vertexCount = this.#maxSegments * VERTS_PER_SEGMENT;
        const indexCount = drawVertexCount;
        const indexFormat = this.#indices instanceof Uint16Array ? "uint16" : "uint32";
        const indexBuffer = {
            format: indexFormat,
            data: this.#indices,
            indexCount: this.#indices.length,
            updateRanges: [],
        };
        const bounds = computeVertexBounds(this.#vertices, drawVertexCount);
        const center = [
            (bounds.min[0] + bounds.max[0]) * 0.5,
            (bounds.min[1] + bounds.max[1]) * 0.5,
            (bounds.min[2] + bounds.max[2]) * 0.5,
        ];
        const radius = Math.hypot(bounds.max[0] - center[0], bounds.max[1] - center[1], bounds.max[2] - center[2]) || 0.001;
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
                    updateRanges: this.#dirtyVertexRanges.map((range) => ({ ...range })),
                },
            ],
            indexBuffer,
            submeshes: [
                {
                    label: "default",
                    topology: "triangle-list",
                    materialSlot: 0,
                    vertexStart: 0,
                    vertexCount: drawVertexCount,
                    indexStart: 0,
                    indexCount,
                },
            ],
            materialSlots: [{ index: 0, label: "default" }],
            localAabb: { min: [...bounds.min], max: [...bounds.max] },
            localSphere: { center, radius },
        };
    }
}
function computeVertexBounds(vertices, vertexCount) {
    if (vertexCount <= 0) {
        return { min: [0, 0, 0], max: [0, 0, 0] };
    }
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;
    for (let vertex = 0, offset = 0; vertex < vertexCount; vertex += 1, offset += FLOATS_PER_VERTEX) {
        const x = vertices[offset] ?? 0;
        const y = vertices[offset + 1] ?? 0;
        const z = vertices[offset + 2] ?? 0;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        minZ = Math.min(minZ, z);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        maxZ = Math.max(maxZ, z);
    }
    return {
        min: [minX, minY, minZ],
        max: [maxX, maxY, maxZ],
    };
}
function ensureTrailMaterial(registry, handle, options) {
    const entry = registry.get(handle);
    if (entry?.status === "ready" && entry.asset !== null) {
        return;
    }
    const asset = createUnlitMaterialAsset({
        label: options.label,
        baseColorFactor: vec4(1, 1, 1, options.opacity),
        renderState: createDefaultRenderState({
            alphaMode: "blend",
            cullMode: "none",
            depth: {
                test: true,
                write: false,
                compare: "less",
                ...(options.depthBias === 0 ? {} : { bias: options.depthBias }),
                ...(options.depthBiasSlopeScale === 0
                    ? {}
                    : { biasSlopeScale: options.depthBiasSlopeScale }),
            },
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
function materialHandleFrom(input) {
    return typeof input === "string" ? createMaterialHandle(input) : input;
}
function createSequentialIndexBuffer(count) {
    const indices = count <= 0xffff ? new Uint16Array(count) : new Uint32Array(count);
    for (let index = 0; index < count; index += 1) {
        indices[index] = index;
    }
    return indices;
}
function tuple3(input) {
    return [
        finiteNumber(input[0], 0),
        finiteNumber(input[1], 0),
        finiteNumber(input[2], 0),
    ];
}
function finitePositive(value, fallback) {
    return typeof value === "number" && Number.isFinite(value) && value > 0
        ? value
        : fallback;
}
function finiteUnit(value, fallback) {
    return clamp01(finiteNumber(value, fallback));
}
function finiteNumber(value, fallback) {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
function clamp01(value) {
    return Math.min(Math.max(value, 0), 1);
}
//# sourceMappingURL=trails.js.map