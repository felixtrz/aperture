import { Camera } from "@aperture-engine/render";
import {
  EcsType,
  LocalTransform,
  WorldTransform,
  defineComponent,
  expSmoothingAlpha,
  identityMat4,
  transformPoint,
  type ComponentInitialData,
  type EcsWorld,
  type Entity,
  type Mat4,
  type Vec3Like,
  type Vec3Tuple,
} from "@aperture-engine/simulation";
import type { EcsEntityRef } from "../config.js";
import type { ApertureSystemContext } from "./context.js";
import { quatLookAt } from "./spawn/transforms.js";

export const ScreenSpaceFramingFit = {
  Contain: "contain",
} as const;

export type ScreenSpaceFramingFit =
  (typeof ScreenSpaceFramingFit)[keyof typeof ScreenSpaceFramingFit];

export interface ScreenSpaceFramingInput {
  readonly subject: Entity | EcsEntityRef;
  readonly slot: string;
  readonly fit?: ScreenSpaceFramingFit;
  readonly paddingPx?: number;
  readonly alignX?: number;
  readonly alignY?: number;
  readonly yawRadians?: number;
  readonly pitchRadians?: number;
  readonly boundsMin?: Vec3Like;
  readonly boundsMax?: Vec3Like;
  /**
   * Symmetric inset applied to both min and max bounds faces before fitting.
   * Use this to frame a cropped region of a larger subject while the rest of
   * the object remains visible outside the framed AABB.
   */
  readonly boundsInset?: number | Vec3Like;
  /** Per-axis inset added to the min-side faces before fitting. */
  readonly boundsInsetMin?: Vec3Like;
  /** Per-axis inset subtracted from the max-side faces before fitting. */
  readonly boundsInsetMax?: Vec3Like;
  readonly focusOffset?: Vec3Like;
  readonly minDistance?: number;
  readonly maxDistance?: number;
  readonly smoothingRate?: number;
}

export interface ScreenSpaceFramingFrameReport {
  readonly cameras: number;
  readonly updated: number;
}

export const ScreenSpaceFraming = defineComponent(
  "aperture.camera.screenSpaceFraming",
  {
    enabled: { type: EcsType.Boolean, default: true },
    subjectIndex: { type: EcsType.Int32, default: -1 },
    subjectGeneration: { type: EcsType.Int32, default: -1 },
    slot: { type: EcsType.String, default: "" },
    fit: {
      type: EcsType.Enum,
      enum: ScreenSpaceFramingFit,
      default: ScreenSpaceFramingFit.Contain,
    },
    paddingPx: { type: EcsType.Float32, default: 0 },
    alignX: { type: EcsType.Float32, default: 0.5 },
    alignY: { type: EcsType.Float32, default: 0.5 },
    yawRadians: { type: EcsType.Float32, default: Math.PI / 4 },
    pitchRadians: { type: EcsType.Float32, default: Math.atan(1 / Math.SQRT2) },
    boundsMin: { type: EcsType.Vec3, default: [-0.5, -0.5, -0.5] },
    boundsMax: { type: EcsType.Vec3, default: [0.5, 0.5, 0.5] },
    boundsInsetMin: { type: EcsType.Vec3, default: [0, 0, 0] },
    boundsInsetMax: { type: EcsType.Vec3, default: [0, 0, 0] },
    focusOffset: { type: EcsType.Vec3, default: [0, 0, 0] },
    minDistance: { type: EcsType.Float32, default: 0.1 },
    maxDistance: { type: EcsType.Float32, default: 1000 },
    smoothingRate: { type: EcsType.Float32, default: 0 },
    initialized: { type: EcsType.Boolean, default: false },
    smoothedTranslation: { type: EcsType.Vec3, default: [0, 0, 0] },
  },
  "Attachable camera constraint that frames a subject AABB inside a browser-observed screen-space slot.",
);

export function createScreenSpaceFraming(
  input: ScreenSpaceFramingInput,
): ComponentInitialData<typeof ScreenSpaceFraming> {
  const subject = entityRef(input.subject);
  const symmetricInset = insetVec3(input.boundsInset, [0, 0, 0]);
  const boundsInsetMin = add3(
    symmetricInset,
    insetVec3(input.boundsInsetMin, [0, 0, 0]),
  );
  const boundsInsetMax = add3(
    symmetricInset,
    insetVec3(input.boundsInsetMax, [0, 0, 0]),
  );

  return {
    enabled: true,
    subjectIndex: subject.index,
    subjectGeneration: subject.generation,
    slot: input.slot,
    fit: input.fit ?? ScreenSpaceFramingFit.Contain,
    paddingPx: finiteNumber(input.paddingPx, 0),
    alignX: clamp01(finiteNumber(input.alignX, 0.5)),
    alignY: clamp01(finiteNumber(input.alignY, 0.5)),
    yawRadians: finiteNumber(input.yawRadians, Math.PI / 4),
    pitchRadians: clamp(
      finiteNumber(input.pitchRadians, Math.atan(1 / Math.SQRT2)),
      -Math.PI / 2 + 0.001,
      Math.PI / 2 - 0.001,
    ),
    boundsMin: vec3(input.boundsMin, [-0.5, -0.5, -0.5]),
    boundsMax: vec3(input.boundsMax, [0.5, 0.5, 0.5]),
    boundsInsetMin,
    boundsInsetMax,
    focusOffset: vec3(input.focusOffset, [0, 0, 0]),
    minDistance: Math.max(0.001, finiteNumber(input.minDistance, 0.1)),
    maxDistance: Math.max(0.001, finiteNumber(input.maxDistance, 1000)),
    smoothingRate: Math.max(0, finiteNumber(input.smoothingRate, 0)),
    initialized: false,
  };
}

export function runScreenSpaceFramingFrame(
  context: ApertureSystemContext,
  delta: number,
): ScreenSpaceFramingFrameReport {
  const world = context.world as EcsWorld;
  const query = screenSpaceFramingQuery(world);
  let cameras = 0;
  let updated = 0;

  for (const camera of query.entities) {
    cameras += 1;
    if (solveCamera(context, world, camera, delta)) {
      updated += 1;
    }
  }

  return { cameras, updated };
}

const queryByWorld = new WeakMap<
  EcsWorld,
  ReturnType<EcsWorld["queryManager"]["registerQuery"]>
>();
const allQueryByWorld = new WeakMap<
  EcsWorld,
  ReturnType<EcsWorld["queryManager"]["registerQuery"]>
>();

function screenSpaceFramingQuery(world: EcsWorld) {
  let query = queryByWorld.get(world);
  if (query === undefined) {
    query = world.queryManager.registerQuery({
      required: [Camera, LocalTransform, ScreenSpaceFraming],
    });
    queryByWorld.set(world, query);
  }
  return query;
}

function allEntitiesQuery(world: EcsWorld) {
  let query = allQueryByWorld.get(world);
  if (query === undefined) {
    query = world.queryManager.registerQuery({ required: [] });
    allQueryByWorld.set(world, query);
  }
  return query;
}

function solveCamera(
  context: ApertureSystemContext,
  world: EcsWorld,
  camera: Entity,
  delta: number,
): boolean {
  if (camera.getValue(ScreenSpaceFraming, "enabled") !== true) {
    return false;
  }
  if (
    camera.getValue(ScreenSpaceFraming, "fit") !== ScreenSpaceFramingFit.Contain
  ) {
    return false;
  }

  const slotName = camera.getValue(ScreenSpaceFraming, "slot") ?? "";
  const slot = context.html.slot(slotName);
  if (slot === null || !slot.visible) {
    return false;
  }

  const subject = resolveSubject(world, camera);
  if (subject === null || !subject.hasComponent(WorldTransform)) {
    return false;
  }

  const viewportWidth = Math.max(1, slot.viewport.width);
  const viewportHeight = Math.max(1, slot.viewport.height);
  const paddingPx = Math.max(0, readNumber(camera, "paddingPx"));
  const innerWidth = slot.rect.width - paddingPx * 2;
  const innerHeight = slot.rect.height - paddingPx * 2;
  if (innerWidth <= 1 || innerHeight <= 1) {
    return false;
  }

  const subjectMatrix = readWorldMatrix(subject);
  const bounds = readWorldBounds(camera, subjectMatrix);
  const yaw = readNumber(camera, "yawRadians");
  const pitch = clamp(
    readNumber(camera, "pitchRadians"),
    -Math.PI / 2 + 0.001,
    Math.PI / 2 - 0.001,
  );
  const basis = cameraBasis(yaw, pitch);
  const fovY = readCameraFov(camera);
  const aspect = viewportWidth / viewportHeight;
  const tanY = Math.tan(fovY / 2);
  const alignX = clamp01(readNumber(camera, "alignX"));
  const alignY = clamp01(readNumber(camera, "alignY"));
  const slotBounds = slotNdcBounds({
    left: slot.rect.left + paddingPx,
    top: slot.rect.top + paddingPx,
    width: innerWidth,
    height: innerHeight,
    viewportWidth,
    viewportHeight,
  });
  const minDistance = Math.max(0.001, readNumber(camera, "minDistance"));
  const maxDistance = Math.max(minDistance, readNumber(camera, "maxDistance"));
  const distance = solveDistance({
    bounds,
    basis,
    aspect,
    tanY,
    slotBounds,
    minDistance,
    maxDistance,
  });
  const focusOffset = focusOffsetForDistance(
    bounds,
    basis,
    distance,
    aspect,
    tanY,
    slotBounds,
    alignX,
    alignY,
  );
  const focus: Vec3Tuple = [
    bounds.center[0] +
      basis.right[0] * focusOffset.x +
      basis.up[0] * focusOffset.y,
    bounds.center[1] +
      basis.right[1] * focusOffset.x +
      basis.up[1] * focusOffset.y,
    bounds.center[2] +
      basis.right[2] * focusOffset.x +
      basis.up[2] * focusOffset.y,
  ];
  const targetTranslation: Vec3Tuple = [
    focus[0] + basis.back[0] * distance,
    focus[1] + basis.back[1] * distance,
    focus[2] + basis.back[2] * distance,
  ];
  const rotation = quatLookAt(targetTranslation, focus);
  const translation = smoothTranslation(camera, targetTranslation, delta);

  camera.getVectorView(LocalTransform, "translation").set(translation);
  camera.getVectorView(LocalTransform, "rotation").set(rotation);
  camera
    .getVectorView(ScreenSpaceFraming, "smoothedTranslation")
    .set(translation);
  camera.setValue(ScreenSpaceFraming, "initialized", true);
  return true;
}

interface CameraBasis {
  readonly right: Vec3Tuple;
  readonly up: Vec3Tuple;
  readonly forward: Vec3Tuple;
  readonly back: Vec3Tuple;
}

interface WorldBounds {
  readonly center: Vec3Tuple;
  readonly corners: readonly Vec3Tuple[];
}

interface NdcSlotBounds {
  readonly left: number;
  readonly right: number;
  readonly bottom: number;
  readonly top: number;
}

interface FocusOffsetInterval {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

function cameraBasis(yaw: number, pitch: number): CameraBasis {
  const horizontal = Math.cos(pitch);
  const back: Vec3Tuple = [
    horizontal * Math.sin(yaw),
    Math.sin(pitch),
    horizontal * Math.cos(yaw),
  ];
  const forward: Vec3Tuple = [-back[0], -back[1], -back[2]];
  const right = normalize3([Math.cos(yaw), 0, -Math.sin(yaw)]);
  const up = normalize3(cross3(right, forward));
  return { right, up, forward, back };
}

function solveDistance(input: {
  readonly bounds: WorldBounds;
  readonly basis: CameraBasis;
  readonly aspect: number;
  readonly tanY: number;
  readonly slotBounds: NdcSlotBounds;
  readonly minDistance: number;
  readonly maxDistance: number;
}): number {
  let low = input.minDistance;
  let high = input.maxDistance;

  for (let i = 0; i < 24; i += 1) {
    const mid = (low + high) / 2;
    const fit = focusOffsetIntervalAtDistance({ ...input, distance: mid });
    if (fit !== null && fit.minX <= fit.maxX && fit.minY <= fit.maxY) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return high;
}

function focusOffsetForDistance(
  bounds: WorldBounds,
  basis: CameraBasis,
  distance: number,
  aspect: number,
  tanY: number,
  slotBounds: NdcSlotBounds,
  alignX: number,
  alignY: number,
): { readonly x: number; readonly y: number } {
  const interval = focusOffsetIntervalAtDistance({
    bounds,
    basis,
    distance,
    aspect,
    tanY,
    slotBounds,
  });

  if (interval === null) {
    return { x: 0, y: 0 };
  }

  return {
    x: solveAlignedFocusOffset({
      bounds,
      basis,
      distance,
      aspect,
      tanY,
      axis: "x",
      minOffset: interval.minX,
      maxOffset: interval.maxX,
      align: alignX,
      target: lerp(slotBounds.left, slotBounds.right, alignX),
    }),
    y: solveAlignedFocusOffset({
      bounds,
      basis,
      distance,
      aspect,
      tanY,
      axis: "y",
      minOffset: interval.minY,
      maxOffset: interval.maxY,
      align: alignY,
      target: lerp(slotBounds.top, slotBounds.bottom, alignY),
    }),
  };
}

function solveAlignedFocusOffset(input: {
  readonly bounds: WorldBounds;
  readonly basis: CameraBasis;
  readonly distance: number;
  readonly aspect: number;
  readonly tanY: number;
  readonly axis: "x" | "y";
  readonly minOffset: number;
  readonly maxOffset: number;
  readonly align: number;
  readonly target: number;
}): number {
  let low = input.minOffset;
  let high = input.maxOffset;

  for (let i = 0; i < 24; i += 1) {
    const mid = (low + high) / 2;
    const rect = projectedNdcAxisAtOffset({ ...input, offset: mid });
    const anchor =
      input.axis === "x"
        ? lerp(rect.min, rect.max, input.align)
        : lerp(rect.max, rect.min, input.align);

    if (anchor > input.target) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return (low + high) / 2;
}

function projectedNdcAxisAtOffset(input: {
  readonly bounds: WorldBounds;
  readonly basis: CameraBasis;
  readonly distance: number;
  readonly aspect: number;
  readonly tanY: number;
  readonly axis: "x" | "y";
  readonly offset: number;
}): { readonly min: number; readonly max: number } {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (const corner of input.bounds.corners) {
    const relative = subtract3(corner, input.bounds.center);
    const depth = input.distance + dot3(relative, input.basis.forward);
    const cameraAxis =
      input.axis === "x"
        ? dot3(relative, input.basis.right)
        : dot3(relative, input.basis.up);
    const denominator =
      input.axis === "x"
        ? depth * input.tanY * input.aspect
        : depth * input.tanY;
    const ndc = (cameraAxis - input.offset) / denominator;

    min = Math.min(min, ndc);
    max = Math.max(max, ndc);
  }

  return { min, max };
}

function focusOffsetIntervalAtDistance(input: {
  readonly bounds: WorldBounds;
  readonly basis: CameraBasis;
  readonly distance: number;
  readonly aspect: number;
  readonly tanY: number;
  readonly slotBounds: NdcSlotBounds;
}): FocusOffsetInterval | null {
  let minX = Number.NEGATIVE_INFINITY;
  let maxX = Number.POSITIVE_INFINITY;
  let minY = Number.NEGATIVE_INFINITY;
  let maxY = Number.POSITIVE_INFINITY;

  for (const corner of input.bounds.corners) {
    const relative = subtract3(corner, input.bounds.center);
    const depth = input.distance + dot3(relative, input.basis.forward);
    if (depth <= 0.0001) {
      return null;
    }

    const cameraX = dot3(relative, input.basis.right);
    const cameraY = dot3(relative, input.basis.up);
    const denomX = depth * input.tanY * input.aspect;
    const denomY = depth * input.tanY;

    minX = Math.max(minX, cameraX - input.slotBounds.right * denomX);
    maxX = Math.min(maxX, cameraX - input.slotBounds.left * denomX);
    minY = Math.max(minY, cameraY - input.slotBounds.top * denomY);
    maxY = Math.min(maxY, cameraY - input.slotBounds.bottom * denomY);
  }

  return { minX, maxX, minY, maxY };
}

function slotNdcBounds(input: {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
}): NdcSlotBounds {
  return {
    left: (input.left / input.viewportWidth) * 2 - 1,
    right: ((input.left + input.width) / input.viewportWidth) * 2 - 1,
    top: 1 - (input.top / input.viewportHeight) * 2,
    bottom: 1 - ((input.top + input.height) / input.viewportHeight) * 2,
  };
}

function readWorldBounds(camera: Entity, subjectMatrix: Mat4): WorldBounds {
  const sourceMin = tuple3(
    camera.getVectorView(ScreenSpaceFraming, "boundsMin"),
  );
  const sourceMax = tuple3(
    camera.getVectorView(ScreenSpaceFraming, "boundsMax"),
  );
  const minInset = nonNegativeTuple3(
    camera.getVectorView(ScreenSpaceFraming, "boundsInsetMin"),
  );
  const maxInset = nonNegativeTuple3(
    camera.getVectorView(ScreenSpaceFraming, "boundsInsetMax"),
  );
  const { min, max } = insetBounds(sourceMin, sourceMax, minInset, maxInset);
  const focusOffset = tuple3(
    camera.getVectorView(ScreenSpaceFraming, "focusOffset"),
  );
  const localCorners: Vec3Tuple[] = [
    [min[0], min[1], min[2]],
    [min[0], min[1], max[2]],
    [min[0], max[1], min[2]],
    [min[0], max[1], max[2]],
    [max[0], min[1], min[2]],
    [max[0], min[1], max[2]],
    [max[0], max[1], min[2]],
    [max[0], max[1], max[2]],
  ];
  const corners = localCorners.map((corner) =>
    add3(transformPoint(subjectMatrix, corner) as Vec3Tuple, focusOffset),
  );
  const center = add3(
    transformPoint(subjectMatrix, [
      (min[0] + max[0]) / 2,
      (min[1] + max[1]) / 2,
      (min[2] + max[2]) / 2,
    ]) as Vec3Tuple,
    focusOffset,
  );

  return { center, corners };
}

function smoothTranslation(
  camera: Entity,
  target: Vec3Tuple,
  delta: number,
): Vec3Tuple {
  const initialized =
    camera.getValue(ScreenSpaceFraming, "initialized") === true;
  const smoothingRate = Math.max(0, readNumber(camera, "smoothingRate"));
  if (!initialized || smoothingRate <= 0) {
    return target;
  }

  const current = tuple3(
    camera.getVectorView(ScreenSpaceFraming, "smoothedTranslation"),
  );
  const alpha = expSmoothingAlpha(delta, smoothingRate);
  return [
    current[0] + (target[0] - current[0]) * alpha,
    current[1] + (target[1] - current[1]) * alpha,
    current[2] + (target[2] - current[2]) * alpha,
  ];
}

function resolveSubject(world: EcsWorld, camera: Entity): Entity | null {
  const index = camera.getValue(ScreenSpaceFraming, "subjectIndex");
  const generation = camera.getValue(ScreenSpaceFraming, "subjectGeneration");
  if (
    typeof index !== "number" ||
    typeof generation !== "number" ||
    index < 0 ||
    generation < 0
  ) {
    return null;
  }

  for (const entity of allEntitiesQuery(world).entities) {
    if (entity.index === index && entity.generation === generation) {
      return entity;
    }
  }

  return null;
}

function readWorldMatrix(entity: Entity): Mat4 {
  const matrix = identityMat4();
  matrix.set(entity.getVectorView(WorldTransform, "col0"), 0);
  matrix.set(entity.getVectorView(WorldTransform, "col1"), 4);
  matrix.set(entity.getVectorView(WorldTransform, "col2"), 8);
  matrix.set(entity.getVectorView(WorldTransform, "col3"), 12);
  return matrix;
}

function readCameraFov(camera: Entity): number {
  const value = camera.getValue(Camera, "fovYRadians");
  return clamp(
    typeof value === "number" && Number.isFinite(value) ? value : Math.PI / 3,
    0.001,
    Math.PI - 0.001,
  );
}

function readNumber(
  entity: Entity,
  field: keyof typeof ScreenSpaceFraming.schema,
): number {
  const value = entity.getValue(ScreenSpaceFraming, field);
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function entityRef(value: Entity | EcsEntityRef): EcsEntityRef {
  return "active" in value
    ? { index: value.index, generation: value.generation }
    : value;
}

function vec3(value: Vec3Like | undefined, fallback: Vec3Tuple): Vec3Tuple {
  if (value === undefined) {
    return fallback;
  }
  return [
    finiteNumber(value[0], fallback[0]),
    finiteNumber(value[1], fallback[1]),
    finiteNumber(value[2], fallback[2]),
  ];
}

function insetVec3(
  value: number | Vec3Like | undefined,
  fallback: Vec3Tuple,
): Vec3Tuple {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value === "number") {
    const inset = nonNegativeFiniteNumber(value, fallback[0]);
    return [inset, inset, inset];
  }
  return [
    nonNegativeFiniteNumber(value[0], fallback[0]),
    nonNegativeFiniteNumber(value[1], fallback[1]),
    nonNegativeFiniteNumber(value[2], fallback[2]),
  ];
}

function tuple3(value: ArrayLike<number>): Vec3Tuple {
  return [
    finiteNumber(value[0], 0),
    finiteNumber(value[1], 0),
    finiteNumber(value[2], 0),
  ];
}

function nonNegativeTuple3(value: ArrayLike<number>): Vec3Tuple {
  return [
    nonNegativeFiniteNumber(value[0], 0),
    nonNegativeFiniteNumber(value[1], 0),
    nonNegativeFiniteNumber(value[2], 0),
  ];
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function nonNegativeFiniteNumber(value: unknown, fallback: number): number {
  return Math.max(0, finiteNumber(value, fallback));
}

function insetBounds(
  sourceMin: Vec3Tuple,
  sourceMax: Vec3Tuple,
  minInset: Vec3Tuple,
  maxInset: Vec3Tuple,
): { readonly min: Vec3Tuple; readonly max: Vec3Tuple } {
  const min: Vec3Tuple = [
    sourceMin[0] + minInset[0],
    sourceMin[1] + minInset[1],
    sourceMin[2] + minInset[2],
  ];
  const max: Vec3Tuple = [
    sourceMax[0] - maxInset[0],
    sourceMax[1] - maxInset[1],
    sourceMax[2] - maxInset[2],
  ];

  for (const index of [0, 1, 2] as const) {
    if (min[index] > max[index]) {
      const center = (sourceMin[index] + sourceMax[index]) / 2;
      min[index] = center;
      max[index] = center;
    }
  }

  return { min, max };
}

function add3(a: Vec3Tuple, b: Vec3Tuple): Vec3Tuple {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function subtract3(a: Vec3Tuple, b: Vec3Tuple): Vec3Tuple {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function dot3(a: Vec3Tuple, b: Vec3Tuple): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross3(a: Vec3Tuple, b: Vec3Tuple): Vec3Tuple {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function normalize3(value: Vec3Like): Vec3Tuple {
  const x = finiteNumber(value[0], 0);
  const y = finiteNumber(value[1], 0);
  const z = finiteNumber(value[2], 0);
  const length = Math.hypot(x, y, z);
  return length <= Number.EPSILON
    ? [0, 0, 0]
    : [x / length, y / length, z / length];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function lerp(a: number, b: number, amount: number): number {
  return a + (b - a) * amount;
}
