import { Camera, Mesh, type MeshAsset } from "@aperture-engine/render";
import {
  LocalTransform,
  Parent,
  WorldTransform,
  createMeshHandle,
  composeTrsMatrix,
  identityMat4,
  invertMat4,
  makeOrthographic,
  makePerspective,
  multiplyMat4,
  quatFromEulerYXZ,
  resolveWorldTransforms,
  transformAabb,
  type Aabb,
  type Entity,
} from "@aperture-engine/simulation";
import type { ApertureApp } from "../advanced.js";
import type { EcsEntityRef } from "../config.js";
import { AppEntityKey } from "../systems/components.js";
import { collectActiveEntities } from "../entities/lookup/summary.js";
import { resolveActiveEntity } from "../entities/lookup/resolve.js";
import { isRecord } from "./payload.js";
import type { GeneratedDevtoolsToolResult } from "./types.js";

type Vec3 = readonly [number, number, number];

/** Machine-readable evidence for a one-shot fit of static mesh source bounds. */
export interface CameraFramingReport {
  readonly source: "mesh-local-aabb";
  readonly subjects: readonly EcsEntityRef[];
  readonly meshes: readonly EcsEntityRef[];
  readonly includeDescendants: boolean;
  readonly bounds: { readonly min: Vec3; readonly max: Vec3 };
  readonly center: Vec3;
  readonly translation: Vec3;
  readonly projection: "perspective" | "orthographic";
  readonly aspect: number;
  readonly padding: number;
  readonly distance: number;
  readonly near: number;
  readonly far: number;
  readonly orthographicHeight?: number;
  readonly approximation: "static-mesh-bounds";
  readonly projectionCheck: {
    readonly maxAbsNdcX: number;
    readonly maxAbsNdcY: number;
    readonly minNdcDepth: number;
    readonly maxNdcDepth: number;
    readonly tolerance: number;
  };
}

/**
 * Dev-only authoring operation. Source mesh AABBs and ECS world transforms are
 * authoritative inputs; no camera visibility, GPU readback, or scene graph is
 * consulted. All validation finishes before authored camera fields are written.
 */
export function frameCameraEntities(
  app: ApertureApp,
  camera: Entity,
  payload: Record<string, unknown>,
  viewportAspect?: number,
): GeneratedDevtoolsToolResult {
  const selectors = payload["subjects"];
  if (
    !Array.isArray(selectors) ||
    selectors.length === 0 ||
    selectors.length > 256
  ) {
    return failure({
      code: "aperture.camera.framing.invalidSubjects",
      message: "Framing requires 1–256 subject selectors.",
      suggestedFix:
        "Pass subjects: [{ key: 'model' }] or generation-checked { index, generation } references.",
    });
  }
  const includeDescendants =
    payload["includeDescendants"] === undefined
      ? true
      : payload["includeDescendants"];
  const padding = payload["padding"] === undefined ? 1.1 : payload["padding"];
  const yawDegrees =
    payload["yawDegrees"] === undefined ? 35 : payload["yawDegrees"];
  const pitchDegrees =
    payload["pitchDegrees"] === undefined ? 20 : payload["pitchDegrees"];
  if (
    typeof includeDescendants !== "boolean" ||
    !finite(padding) ||
    padding < 1 ||
    padding > 100 ||
    !finite(yawDegrees) ||
    !finite(pitchDegrees) ||
    Math.abs(pitchDegrees) >= 90
  ) {
    return failure({
      code: "aperture.camera.framing.invalidOptions",
      message: "Framing options are invalid.",
      suggestedFix:
        "Use boolean includeDescendants, padding between 1 and 100, finite yawDegrees, and pitchDegrees strictly between -90 and 90.",
    });
  }
  if (
    camera.hasComponent(Parent) &&
    camera.getValue(Parent, "entity") !== null
  ) {
    return failure({
      code: "aperture.camera.framing.parentedCamera",
      message: "Framing requires an unparented camera.",
      suggestedFix:
        "Create an independent inspection camera with camera_create_agent and pass its key.",
    });
  }
  const projection = camera.getValue(Camera, "projection");
  const viewport = camera.getVectorView(Camera, "viewport");
  const autoAspect =
    camera.getValue(Camera, "autoAspect") !== false &&
    (camera.getValue(Camera, "renderTargetId") ?? "").length === 0 &&
    viewportAspect !== undefined;
  const aspect = autoAspect
    ? Math.fround(viewportAspect * ((viewport[2] ?? 1) / (viewport[3] ?? 1)))
    : camera.getValue(Camera, "aspect");
  const fovY = camera.getValue(Camera, "fovYRadians");
  if (
    !camera.hasComponent(WorldTransform) ||
    (projection !== "perspective" && projection !== "orthographic") ||
    camera.getValue(Camera, "temporalJitterX") !== 0 ||
    camera.getValue(Camera, "temporalJitterY") !== 0 ||
    !finite(aspect) ||
    aspect <= 0 ||
    (projection === "perspective" &&
      (!finite(fovY) || fovY <= 0 || fovY >= Math.PI))
  ) {
    return failure({
      code: "aperture.camera.framing.invalidCamera",
      message: "The camera projection cannot be used for framing.",
      suggestedFix:
        "Use an unjittered inspection camera with positive aspect and a perspective FOV between 0 and PI, or an orthographic projection.",
    });
  }

  const world = app.lowLevel.world;
  const all = collectActiveEntities(world);
  const subjects = new Set<Entity>();
  for (const selector of selectors) {
    if (!isRecord(selector))
      return failure({
        code: "aperture.camera.framing.invalidSubjects",
        message: "A subject selector is not an object.",
        suggestedFix: "Use { key } or { index, generation }.",
      });
    if (
      Object.hasOwn(selector, "key") &&
      (Object.hasOwn(selector, "index") ||
        Object.hasOwn(selector, "generation"))
    ) {
      return failure({
        code: "aperture.camera.framing.invalidSubjects",
        message: "A subject selector mixes a key with an entity reference.",
        suggestedFix:
          "Use either { key } or { index, generation } for each subject, not both.",
      });
    }
    if (typeof selector["key"] === "string" && selector["key"].length > 0) {
      const matches = all.filter(
        (entity) =>
          entity.hasComponent(AppEntityKey) &&
          entity.getValue(AppEntityKey, "value") === selector["key"],
      );
      if (matches.length !== 1)
        return failure(
          {
            code: "aperture.camera.framing.subjectNotFound",
            message:
              "A subject key did not resolve to exactly one active entity.",
            suggestedFix:
              "Call ecs_find_entities and use an unambiguous key or a current entity reference.",
          },
          { key: selector["key"], matches: matches.length },
        );
      subjects.add(matches[0]!);
    } else {
      const index = selector["index"];
      const generation = selector["generation"];
      if (!finite(index) || !finite(generation))
        return failure({
          code: "aperture.camera.framing.invalidSubjects",
          message: "A subject reference is invalid.",
          suggestedFix:
            "Use the full integer { index, generation } returned by ecs_find_entities.",
        });
      const resolved = resolveActiveEntity(world, { index, generation });
      if (!resolved.ok)
        return { ok: false, diagnostics: [resolved.diagnostic] };
      subjects.add(resolved.entity);
    }
  }

  // A reverse adjacency map traverses selected subtrees once, including
  // overlapping roots. The visited set also bounds malformed parent cycles.
  const selected = new Set(subjects);
  if (includeDescendants) {
    const children = new Map<Entity, Entity[]>();
    for (const entity of all) {
      if (!entity.hasComponent(Parent)) continue;
      const parent = entity.getValue(Parent, "entity");
      if (parent === null) continue;
      const entries = children.get(parent) ?? [];
      entries.push(entity);
      children.set(parent, entries);
    }
    const pending = [...subjects];
    for (let index = 0; index < pending.length; index += 1) {
      for (const child of children.get(pending[index]!) ?? []) {
        if (selected.has(child)) continue;
        selected.add(child);
        pending.push(child);
      }
    }
  }
  const meshes = [...selected]
    .filter((entity) => entity.hasComponent(Mesh))
    .sort((a, b) => a.index - b.index || a.generation - b.generation);
  if (meshes.length === 0)
    return failure({
      code: "aperture.camera.framing.emptyBounds",
      message: "The selected subjects contain no mesh bounds.",
      suggestedFix:
        "Select a mesh or imported model root; keep includeDescendants enabled for groups and GLBs.",
    });

  // Refresh derived transforms without advancing simulation or invoking user
  // systems. This makes a transform edit followed immediately by framing safe.
  const resolved = resolveWorldTransforms(world);
  const affected = new Set<number>();
  for (const mesh of meshes) {
    let ancestor: Entity | null = mesh;
    while (ancestor !== null && !affected.has(ancestor.index)) {
      affected.add(ancestor.index);
      ancestor = ancestor.hasComponent(Parent)
        ? ancestor.getValue(Parent, "entity")
        : null;
    }
  }
  if (affected.has(camera.index)) {
    return failure({
      code: "aperture.camera.framing.cameraDependentSubject",
      message: "A selected mesh is attached to the camera being framed.",
      suggestedFix:
        "Use an independent inspection camera or detach the subject; moving its ancestor camera would move the bounds being fitted.",
    });
  }
  if (
    resolved.diagnostics.some((diagnostic) => affected.has(diagnostic.entity))
  ) {
    return failure({
      code: "aperture.camera.framing.invalidTransform",
      message: "A selected mesh has an invalid transform hierarchy.",
      suggestedFix: "Resolve transform diagnostics before framing the subject.",
    });
  }
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const entity of meshes) {
    if (!entity.hasComponent(WorldTransform))
      return failure(
        {
          code: "aperture.camera.framing.invalidTransform",
          message: "A selected mesh has no world transform.",
          suggestedFix:
            "Author the mesh through spawn.mesh or add valid transform components.",
        },
        { entity: ref(entity) },
      );
    const meshId = entity.getValue(Mesh, "meshId") ?? "";
    const entry =
      meshId.startsWith("mesh:") && meshId.length > 5
        ? app.lowLevel.assets.get<"mesh", MeshAsset>(
            createMeshHandle(meshId.slice(5)),
          )
        : null;
    if (entry?.status !== "ready" || entry.asset === null)
      return failure(
        {
          code: "aperture.camera.framing.meshNotReady",
          message: "A selected mesh asset is not ready.",
          suggestedFix:
            "Wait for asset readiness before framing; inspect asset_list for loading failures.",
        },
        { entity: ref(entity), meshId },
      );
    const source = entry.asset.localAabb;
    if (source === undefined || !validBounds(source))
      return failure(
        {
          code: "aperture.camera.framing.invalidBounds",
          message: "A selected mesh has missing or invalid local bounds.",
          suggestedFix:
            "Provide finite ordered localAabb bounds on the mesh asset.",
        },
        { entity: ref(entity), meshId },
      );
    const matrix = identityMat4();
    matrix.set(entity.getVectorView(WorldTransform, "col0"), 0);
    matrix.set(entity.getVectorView(WorldTransform, "col1"), 4);
    matrix.set(entity.getVectorView(WorldTransform, "col2"), 8);
    matrix.set(entity.getVectorView(WorldTransform, "col3"), 12);
    const bounds = transformAabb(source, matrix);
    if (!validBounds(bounds))
      return failure(
        {
          code: "aperture.camera.framing.invalidBounds",
          message: "A selected mesh has non-finite transformed bounds.",
          suggestedFix: "Use finite mesh bounds and transforms.",
        },
        { entity: ref(entity) },
      );
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis]!, bounds.min[axis]!);
      max[axis] = Math.max(max[axis]!, bounds.max[axis]!);
    }
  }
  if (min.every((value, axis) => value === max[axis]))
    return failure({
      code: "aperture.camera.framing.emptyBounds",
      message: "The selected mesh bounds collapse to a point.",
      suggestedFix: "Use a nonzero mesh extent or scale before framing.",
    });
  const center: Vec3 = [
    (min[0]! + max[0]!) / 2,
    (min[1]! + max[1]!) / 2,
    (min[2]! + max[2]!) / 2,
  ];
  const yaw = (yawDegrees * Math.PI) / 180;
  const pitch = (pitchDegrees * Math.PI) / 180;
  const back: Vec3 = [
    Math.cos(pitch) * Math.sin(yaw),
    Math.sin(pitch),
    Math.cos(pitch) * Math.cos(yaw),
  ];
  const right: Vec3 = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const up: Vec3 = [
    -Math.sin(pitch) * Math.sin(yaw),
    Math.cos(pitch),
    -Math.sin(pitch) * Math.cos(yaw),
  ];
  const tanY = Math.tan(fovY! / 2);
  // Margins are relative to the subject's units: a millimeter-scale import
  // should occupy the same screen space as an otherwise identical large prop.
  const extent = Math.max(
    max[0]! - min[0]!,
    max[1]! - min[1]!,
    max[2]! - min[2]!,
  );
  let distance = 0;
  let halfHeight = 0;
  let maxDepth = -Infinity;
  let minDepth = Infinity;
  for (let bits = 0; bits < 8; bits += 1) {
    const corner: Vec3 = [
      ((bits & 1) === 0 ? min[0]! : max[0]!) - center[0],
      ((bits & 2) === 0 ? min[1]! : max[1]!) - center[1],
      ((bits & 4) === 0 ? min[2]! : max[2]!) - center[2],
    ];
    const x = dot(corner, right);
    const y = dot(corner, up);
    const z = dot(corner, back);
    maxDepth = Math.max(maxDepth, z);
    minDepth = Math.min(minDepth, z);
    halfHeight = Math.max(
      halfHeight,
      padding * Math.abs(y),
      (padding * Math.abs(x)) / aspect,
    );
    if (projection === "perspective")
      distance = Math.max(
        distance,
        z + (padding * Math.abs(x)) / (tanY * aspect),
        z + (padding * Math.abs(y)) / tanY,
      );
  }
  distance = Math.max(
    distance,
    maxDepth + Math.max(extent * 0.0001, (maxDepth - minDepth) * 0.05),
  );
  const near = Math.fround(
    Math.max(extent * 0.000001, (distance - maxDepth) * 0.5),
  );
  const far = Math.fround(Math.max(near * 1.01, (distance - minDepth) * 1.5));
  const orthographicHeight = Math.fround(halfHeight * 2);
  const translation: Vec3 = [
    Math.fround(center[0] + back[0] * distance),
    Math.fround(center[1] + back[1] * distance),
    Math.fround(center[2] + back[2] * distance),
  ];
  if (
    ![...translation, distance, near, far, halfHeight].every(
      (value) => Number.isFinite(value) && Math.abs(value) < 1e30,
    )
  )
    return failure({
      code: "aperture.camera.framing.invalidBounds",
      message: "The framing solution exceeds supported numeric range.",
      suggestedFix:
        "Rescale the scene to finite, practical world units before framing.",
    });

  // Use the intended yaw/pitch basis even arbitrarily close to the poles;
  // a world-up look-at fallback can choose a different right vector there.
  const rotation = quatFromEulerYXZ(-pitch, yaw, 0);
  const cameraWorld = composeTrsMatrix(translation, rotation, [1, 1, 1]);
  const view = invertMat4(cameraWorld);
  if (view === null || near <= 0 || near >= far || orthographicHeight <= 0) {
    return precisionFailure();
  }
  const projectionMatrix =
    projection === "perspective"
      ? makePerspective(fovY!, aspect, near, far)
      : makeOrthographic(
          (-aspect * orthographicHeight) / 2,
          (aspect * orthographicHeight) / 2,
          -orthographicHeight / 2,
          orthographicHeight / 2,
          near,
          far,
        );
  const viewProjection = multiplyMat4(projectionMatrix, view);
  const projectionCheck = {
    maxAbsNdcX: 0,
    maxAbsNdcY: 0,
    minNdcDepth: Infinity,
    maxNdcDepth: -Infinity,
    tolerance: 0.00001,
  };
  for (let bits = 0; bits < 8; bits += 1) {
    const corner = [0, 1, 2].map((axis) =>
      (bits & (1 << axis)) === 0 ? min[axis]! : max[axis]!,
    );
    const clip = [0, 1, 2, 3].map(
      (row) =>
        viewProjection[row]! * corner[0]! +
        viewProjection[row + 4]! * corner[1]! +
        viewProjection[row + 8]! * corner[2]! +
        viewProjection[row + 12]!,
    );
    if (!clip.every(Number.isFinite) || clip[3]! <= 0)
      return precisionFailure();
    projectionCheck.maxAbsNdcX = Math.max(
      projectionCheck.maxAbsNdcX,
      Math.abs(clip[0]! / clip[3]!),
    );
    projectionCheck.maxAbsNdcY = Math.max(
      projectionCheck.maxAbsNdcY,
      Math.abs(clip[1]! / clip[3]!),
    );
    projectionCheck.minNdcDepth = Math.min(
      projectionCheck.minNdcDepth,
      clip[2]! / clip[3]!,
    );
    projectionCheck.maxNdcDepth = Math.max(
      projectionCheck.maxNdcDepth,
      clip[2]! / clip[3]!,
    );
  }
  if (
    projectionCheck.maxAbsNdcX > 1 / padding + projectionCheck.tolerance ||
    projectionCheck.maxAbsNdcY > 1 / padding + projectionCheck.tolerance ||
    projectionCheck.minNdcDepth < 0 ||
    projectionCheck.maxNdcDepth > 1
  ) {
    return precisionFailure();
  }

  if (!camera.hasComponent(LocalTransform)) camera.addComponent(LocalTransform);
  camera.getVectorView(LocalTransform, "translation").set(translation);
  camera.getVectorView(LocalTransform, "rotation").set(rotation);
  camera.getVectorView(LocalTransform, "scale").set([1, 1, 1]);
  camera.setValue(Camera, "near", near);
  camera.setValue(Camera, "far", far);
  if (autoAspect) camera.setValue(Camera, "aspect", aspect);
  if (projection === "orthographic")
    camera.setValue(Camera, "orthographicHeight", orthographicHeight);
  // Extraction and render_bundle can follow immediately, without running user
  // systems or advancing the simulation just to refresh this derived pose.
  resolveWorldTransforms(world);
  const report: CameraFramingReport = {
    source: "mesh-local-aabb",
    subjects: [...subjects].map(ref),
    meshes: meshes.map(ref),
    includeDescendants,
    bounds: {
      min: [min[0]!, min[1]!, min[2]!],
      max: [max[0]!, max[1]!, max[2]!],
    },
    center,
    translation,
    projection,
    aspect,
    padding,
    distance,
    near,
    far,
    ...(projection === "orthographic" ? { orthographicHeight } : {}),
    approximation: "static-mesh-bounds",
    projectionCheck,
  };
  return { ok: true, result: report };
}

function precisionFailure(): GeneratedDevtoolsToolResult {
  return failure({
    code: "aperture.camera.framing.precisionLoss",
    message:
      "The Float32 camera projection cannot preserve the requested framing.",
    suggestedFix:
      "Move subjects closer to the world origin or rescale them; use less extreme camera FOV/aspect values.",
  });
}

function ref(entity: Entity): EcsEntityRef {
  return { index: entity.index, generation: entity.generation };
}
function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
function validBounds(bounds: Aabb): boolean {
  return [0, 1, 2].every(
    (axis) =>
      finite(bounds.min[axis]) &&
      finite(bounds.max[axis]) &&
      bounds.min[axis]! <= bounds.max[axis]!,
  );
}
function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function failure(
  diagnostic: {
    readonly code: string;
    readonly message: string;
    readonly suggestedFix: string;
  },
  data?: Record<string, unknown>,
): GeneratedDevtoolsToolResult {
  return {
    ok: false,
    diagnostics: [
      {
        ...diagnostic,
        severity: "error",
        ...(data === undefined ? {} : { data }),
      },
    ],
  };
}
