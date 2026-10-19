import { Mesh } from "@aperture-engine/render";
import {
  Parent,
  resolveWorldTransforms,
  type AssetRegistry,
  type EcsWorld,
  type Entity,
} from "@aperture-engine/simulation";
import { collectActiveEntities } from "../entities/lookup/summary.js";
import { resolveActiveEntity } from "../entities/lookup/resolve.js";
import { AppEntityKey } from "../systems/components.js";
import { inspectSourceBounds } from "./bounds.js";
import { exportJobSeed } from "./job-seed.js";
import {
  affine,
  cameraProjection,
  cross,
  project,
  subtract,
  unit,
  worldMatrix,
} from "./projection.js";
import type {
  CameraLocalDiagnostic,
  CameraLocalInspectionResult,
  CameraLocalVec3,
} from "./types.js";
import {
  CameraLocalInputError,
  parseRequest,
  requireLocal,
  selector,
} from "./validation.js";

/** One synchronous ECS-authoritative operation shared by systems, worker tools and headless tools. */
export function inspectCameraLocal(
  world: EcsWorld,
  assets: AssetRegistry | undefined,
  cameraSelector: unknown,
  input: unknown,
): CameraLocalInspectionResult {
  try {
    const request = parseRequest(input);
    const all = collectActiveEntities(world);
    const resolve = (value: unknown): Entity => {
      const ref = selector(value);
      if ("key" in ref) {
        const matches = all.filter(
          (e) =>
            e.hasComponent(AppEntityKey) &&
            e.getValue(AppEntityKey, "value") === ref.key,
        );
        requireLocal(
          matches.length === 1,
          `Key '${ref.key}' must resolve to exactly one active entity; found ${matches.length}.`,
        );
        return matches[0]!;
      }
      const resolved = resolveActiveEntity(world, ref);
      requireLocal(resolved.ok, resolved.ok ? "" : resolved.diagnostic.message);
      return resolved.entity;
    };
    const cameraEntity = resolve(cameraSelector);
    const roots = request.subjects.map((subject) => resolve(subject.entity));
    // Parent is authoritative; this ephemeral adjacency index owns no pose/state.
    const children = new Map<Entity, Entity[]>();
    for (const entity of all) {
      const parent = entity.hasComponent(Parent)
        ? entity.getValue(Parent, "entity")
        : null;
      if (parent !== null) {
        const list = children.get(parent) ?? [];
        list.push(entity);
        children.set(parent, list);
      }
    }
    const selected = roots.map((root, index) => {
      const set = new Set([root]);
      if (request.subjects[index]!.bounds?.includeDescendants) {
        const queue = [root];
        for (let i = 0; i < queue.length; i++)
          for (const child of children.get(queue[i]!) ?? [])
            if (!set.has(child)) {
              set.add(child);
              queue.push(child);
            }
      }
      return [...set].sort(
        (a, b) => a.index - b.index || a.generation - b.generation,
      );
    });
    requireLocal(
      selected.reduce(
        (sum, entities) =>
          sum + entities.filter((e) => e.hasComponent(Mesh)).length,
        0,
      ) <= 4096,
      "Inspect at most 4096 selected mesh bounds per call.",
    );
    const relevant = new Set<Entity>();
    const ancestors = (entity: Entity): Set<Entity> => {
      const chain = new Set<Entity>();
      let next: Entity | null = entity;
      while (next !== null && !chain.has(next)) {
        chain.add(next);
        next = next.hasComponent(Parent)
          ? next.getValue(Parent, "entity")
          : null;
      }
      return chain;
    };
    for (const entity of [
      cameraEntity,
      ...roots,
      ...selected.flat().filter((e) => e.hasComponent(Mesh)),
    ])
      for (const ancestor of ancestors(entity)) relevant.add(ancestor);
    // Indexed vector writes do not always bump a world version. Always resolve,
    // and never step simulation, run systems, extract, or consult a cached bundle.
    const resolution = resolveWorldTransforms(world);
    const affected = resolution.diagnostics.filter((d) =>
      [...relevant].some(
        (e) => e.index === d.entity && e.generation === d.generation,
      ),
    );
    requireLocal(
      affected.length === 0,
      `Selected transform hierarchy is unresolved: ${affected.map((d) => d.message).join(" ")}`,
    );
    const camera = cameraProjection(cameraEntity, request.viewport);
    const eye: CameraLocalVec3 = [
      camera.world[12]!,
      camera.world[13]!,
      camera.world[14]!,
    ];
    const backward = unit([
      camera.world[8]!,
      camera.world[9]!,
      camera.world[10]!,
    ])!;
    const projectionDiagnostics: CameraLocalDiagnostic[] = [];
    const subjects = request.subjects.map((subject, index) => {
      const root = roots[index]!;
      const matrix = worldMatrix(root);
      const points = (subject.points ?? []).map((point) => {
        const projection = project(camera, affine(matrix, point.local));
        const residual =
          projection.pixel === null || point.target === undefined
            ? null
            : ([
                projection.pixel[0] - point.target[0],
                projection.pixel[1] - point.target[1],
              ] as const);
        const magnitude = residual === null ? null : Math.hypot(...residual);
        const errorPixels =
          magnitude !== null && Number.isFinite(magnitude) ? magnitude : null;
        if (magnitude !== null && errorPixels === null)
          projectionDiagnostics.push({
            code: "aperture.camera.local.residualOverflow",
            severity: "warning",
            message:
              "The residual components are finite but their Euclidean magnitude exceeds the numeric range; errorPixels is null.",
            data: { subject: subject.name, point: point.name },
          });
        return {
          name: point.name,
          local: [...point.local] as CameraLocalVec3,
          ...(point.target === undefined
            ? {}
            : { target: [...point.target] as [number, number] }),
          ...(point.weight === undefined ? {} : { weight: point.weight }),
          ...projection,
          residual,
          errorPixels,
        };
      });
      const faces = (subject.faces ?? []).map((face) => {
        const vertices = face.localTriangle.map((p) =>
          project(camera, affine(matrix, p)),
        );
        const [a, b, c] = vertices.map((p) => p.world) as [
          CameraLocalVec3,
          CameraLocalVec3,
          CameraLocalVec3,
        ];
        const centroid: CameraLocalVec3 = [
          (a[0] + b[0] + c[0]) / 3,
          (a[1] + b[1] + c[1]) / 3,
          (a[2] + b[2] + c[2]) / 3,
        ];
        const normal = unit(cross(subtract(b, a), subtract(c, a)));
        const towardCamera =
          camera.projection === "perspective"
            ? unit(subtract(eye, centroid))
            : backward;
        const facingCosine =
          normal === null || towardCamera === null
            ? null
            : Math.max(
                -1,
                Math.min(
                  1,
                  normal.reduce(
                    (sum, n, axis) => sum + n * towardCamera[axis]!,
                    0,
                  ),
                ),
              );
        const status =
          normal === null
            ? ("degenerate" as const)
            : towardCamera === null
              ? ("camera-at-centroid" as const)
              : ("ok" as const);
        return {
          name: face.name,
          vertices,
          centroid,
          normal,
          facingCosine,
          status,
        };
      });
      return {
        name: subject.name,
        entity: { index: root.index, generation: root.generation },
        worldMatrix: Array.from(matrix),
        points,
        faces,
        bounds:
          subject.bounds === undefined
            ? null
            : inspectSourceBounds(
                assets,
                selected[index]!,
                subject.bounds.includeDescendants,
                camera,
              ),
      };
    });
    const cameraDependent = roots.some(
      (root, index) =>
        (request.subjects[index]!.points?.length ?? 0) > 0 &&
        ancestors(root).has(cameraEntity),
    );
    return {
      ok: true,
      result: {
        source: "resolved-ecs",
        viewport: { ...request.viewport },
        camera: {
          entity: {
            index: cameraEntity.index,
            generation: cameraEntity.generation,
          },
          projection: camera.projection,
          aspect: camera.aspect,
          aspectSource: camera.autoAspect ? "viewport-auto-aspect" : "camera",
          worldMatrix: Array.from(camera.world),
          viewProjectionMatrix: Array.from(camera.viewProjection),
        },
        subjects,
        diagnostics: [
          ...projectionDiagnostics,
          ...resolution.diagnostics.map((diagnostic) => ({
            code: "aperture.camera.local.unrelatedTransform",
            severity: "warning" as const,
            message: diagnostic.message,
            data: {
              transformCode: diagnostic.code,
              entity: {
                index: diagnostic.entity,
                generation: diagnostic.generation,
              },
            },
          })),
        ],
        ...exportJobSeed(
          cameraEntity,
          camera,
          request,
          subjects,
          cameraDependent,
        ),
        limitations: [
          "Caller-authored points and triangles are transformed geometrically, without skinning, morphs, shader displacement, billboards, or render interpolation.",
          "Bounds cover static Mesh asset localAabb boxes only; non-mesh renderables, occlusion, visibility/layer filtering, and material culling are not evaluated.",
          "Pixel coordinates use engine Float32 matrices with CPU arithmetic; this is projection evidence, not GPU rasterization or an aesthetic verdict.",
        ],
      },
    };
  } catch (error) {
    if (!(error instanceof CameraLocalInputError)) throw error;
    return {
      ok: false,
      diagnostics: [
        {
          code: "aperture.camera.local.invalidInspection",
          severity: "error",
          message: error.message,
        },
      ],
    };
  }
}
