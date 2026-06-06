import type RAPIER from "@dimforge/rapier3d-compat";
import {
  createPhysicsAabbDebugLines,
  type PhysicsAabb,
  type PhysicsDebugGeometry,
  type PhysicsDebugLine,
  type PhysicsDebugOptions,
  type PhysicsQuat,
  type PhysicsShape,
  type PhysicsVec3,
} from "@aperture-engine/physics";
import { colliderEntries } from "./colliders.js";
import { jointAxis } from "./joints.js";
import {
  addScaledVec3,
  addVec3,
  bodyLocalPointToWorld,
  bodyLocalVectorToWorld,
  cloneVec3,
  normalizeQuat,
  normalizeVec3,
  quatFromRapierRotation,
  rotateVec3ByQuat,
  subtractVec3,
  vec3,
} from "./math.js";
import { finitePositive } from "./util.js";
import type {
  RapierBodyEntry,
  RapierColliderEntry,
  RapierContactManifold,
  RapierJointEntry,
} from "./types.js";

export function debugGeometryFromRapierBuffers(buffers: {
  readonly vertices: Float32Array;
  readonly colors: Float32Array;
}): PhysicsDebugGeometry {
  const lines: PhysicsDebugLine[] = [];

  for (let vertex = 0; vertex + 5 < buffers.vertices.length; vertex += 6) {
    const color = colorForDebugVertex(buffers.colors, vertex / 3);

    lines.push({
      from: [
        buffers.vertices[vertex] ?? 0,
        buffers.vertices[vertex + 1] ?? 0,
        buffers.vertices[vertex + 2] ?? 0,
      ],
      to: [
        buffers.vertices[vertex + 3] ?? 0,
        buffers.vertices[vertex + 4] ?? 0,
        buffers.vertices[vertex + 5] ?? 0,
      ],
      color,
    });
  }

  return { lines };
}

export function broadphaseAabbDebugLines(
  bodies: ReadonlyMap<string, RapierBodyEntry>,
  options: PhysicsDebugOptions,
): PhysicsDebugLine[] {
  return createPhysicsAabbDebugLines(
    [...bodies.values()]
      .sort((a, b) => a.entity.localeCompare(b.entity))
      .flatMap((entry) =>
        entry.colliders.map((collider) => ({ entry, collider })),
      )
      .map(({ entry, collider }) => colliderAabb(entry, collider))
      .filter((aabb): aabb is PhysicsAabb => aabb !== null),
    options.broadphaseAabbColor,
  ).filter(isFiniteLine);
}

export function colliderAabb(
  _entry: RapierBodyEntry,
  colliderEntry: RapierColliderEntry,
): PhysicsAabb | null {
  const localHalfExtents = colliderLocalHalfExtents(
    colliderEntry.descriptor.shape,
  );

  if (localHalfExtents === null) {
    return null;
  }

  const center = vec3(colliderEntry.collider.translation());
  const rotation = quatFromRapierRotation(colliderEntry.collider.rotation());
  const halfExtents = rotatedAabbHalfExtents(localHalfExtents, rotation);

  return {
    min: subtractVec3(center, halfExtents),
    max: addVec3(center, halfExtents),
  };
}

export function colliderLocalHalfExtents(
  shape: PhysicsShape,
): PhysicsVec3 | null {
  switch (shape.kind) {
    case "box":
      return cloneVec3(shape.halfExtents);
    case "sphere":
      return [shape.radius, shape.radius, shape.radius];
    case "capsule":
      return [shape.radius, shape.halfHeight + shape.radius, shape.radius];
    case "cylinder":
    case "cone":
      return [shape.radius, shape.halfHeight, shape.radius];
    case "convexHull":
    case "trimesh":
    case "heightfield":
      return null;
  }
}

export function rotatedAabbHalfExtents(
  localHalfExtents: PhysicsVec3,
  rotation: PhysicsQuat,
): PhysicsVec3 {
  const normalized = normalizeQuat(rotation);
  const basisX = rotateVec3ByQuat([1, 0, 0], normalized);
  const basisY = rotateVec3ByQuat([0, 1, 0], normalized);
  const basisZ = rotateVec3ByQuat([0, 0, 1], normalized);

  return [
    Math.abs(basisX[0]) * localHalfExtents[0] +
      Math.abs(basisY[0]) * localHalfExtents[1] +
      Math.abs(basisZ[0]) * localHalfExtents[2],
    Math.abs(basisX[1]) * localHalfExtents[0] +
      Math.abs(basisY[1]) * localHalfExtents[1] +
      Math.abs(basisZ[1]) * localHalfExtents[2],
    Math.abs(basisX[2]) * localHalfExtents[0] +
      Math.abs(basisY[2]) * localHalfExtents[1] +
      Math.abs(basisZ[2]) * localHalfExtents[2],
  ];
}

export function contactNormalDebugLines(
  world: RAPIER.World,
  bodies: ReadonlyMap<string, RapierBodyEntry>,
  options: PhysicsDebugOptions,
): PhysicsDebugLine[] {
  const lines: PhysicsDebugLine[] = [];
  const entries = colliderEntries(bodies);
  const length = finitePositive(options.contactNormalLength, 0.35);
  const color = options.contactNormalColor ?? [1, 0.2, 0.12, 1];

  for (let left = 0; left < entries.length; left += 1) {
    for (let right = left + 1; right < entries.length; right += 1) {
      const leftEntry = entries[left];
      const rightEntry = entries[right];

      if (
        leftEntry === undefined ||
        rightEntry === undefined ||
        leftEntry.body.entity === rightEntry.body.entity
      ) {
        continue;
      }

      world.contactPair(
        leftEntry.collider.collider,
        rightEntry.collider.collider,
        (manifold: RapierContactManifold, flipped: boolean) => {
          const rawNormal = manifold.normal();
          const normal: PhysicsVec3 = flipped
            ? [-rawNormal.x, -rawNormal.y, -rawNormal.z]
            : [rawNormal.x, rawNormal.y, rawNormal.z];

          for (
            let contactIndex = 0;
            contactIndex < manifold.numSolverContacts();
            contactIndex += 1
          ) {
            const rawPoint = manifold.solverContactPoint(contactIndex);
            const point: PhysicsVec3 = [rawPoint.x, rawPoint.y, rawPoint.z];
            const line = {
              from: point,
              to: addScaledVec3(point, normal, length),
              color,
            };

            if (isFiniteLine(line)) {
              lines.push(line);
            }
          }
        },
      );
    }
  }

  return lines;
}

export function bodyStateDebugLines(
  bodies: ReadonlyMap<string, RapierBodyEntry>,
  options: PhysicsDebugOptions,
): PhysicsDebugLine[] {
  const length = finitePositive(options.bodyStateMarkerLength, 0.25);
  const activeColor = options.activeBodyColor ?? [0.2, 1, 0.45, 1];
  const sleepingColor = options.sleepingBodyColor ?? [0.65, 0.7, 0.78, 1];

  return [...bodies.values()]
    .sort((a, b) => a.entity.localeCompare(b.entity))
    .map((entry) => {
      const translation = entry.body.translation();
      const from: PhysicsVec3 = [translation.x, translation.y, translation.z];

      return {
        from,
        to: addScaledVec3(from, [0, 1, 0], length),
        color: entry.body.isSleeping() ? sleepingColor : activeColor,
      };
    })
    .filter(isFiniteLine);
}

export function jointFrameDebugLines(
  bodies: ReadonlyMap<string, RapierBodyEntry>,
  joints: ReadonlyMap<string, RapierJointEntry>,
  options: PhysicsDebugOptions,
): PhysicsDebugLine[] {
  const lines: PhysicsDebugLine[] = [];
  const frameColor = options.jointFrameColor ?? [0.9, 0.45, 1, 1];
  const axisColor = options.jointAxisColor ?? [0.2, 0.95, 1, 1];
  const basisColors = fixedJointFrameBasisColors();
  const axisLength = finitePositive(options.jointFrameLength, 0.4);

  for (const entry of [...joints.values()].sort((a, b) =>
    a.entity.localeCompare(b.entity),
  )) {
    const bodyA = bodies.get(entry.bodyARef);
    const bodyB = bodies.get(entry.bodyBRef);

    if (bodyA === undefined || bodyB === undefined) {
      continue;
    }

    const anchorA = bodyLocalPointToWorld(bodyA.body, entry.descriptor.anchorA);
    const anchorB = bodyLocalPointToWorld(bodyB.body, entry.descriptor.anchorB);
    const axis = normalizeVec3(
      bodyLocalVectorToWorld(bodyA.body, jointAxis(entry.descriptor)),
    );

    lines.push({
      from: anchorA,
      to: anchorB,
      color: frameColor,
    });
    lines.push({
      from: anchorA,
      to: addScaledVec3(anchorA, axis, axisLength),
      color: axisColor,
    });

    if (entry.descriptor.kind === "fixed") {
      lines.push(
        ...fixedJointFrameBasisDebugLines(
          bodyA.body,
          anchorA,
          quatFromRapierRotation(entry.joint.frameX1()),
          axisLength,
          basisColors,
        ),
        ...fixedJointFrameBasisDebugLines(
          bodyB.body,
          anchorB,
          quatFromRapierRotation(entry.joint.frameX2()),
          axisLength,
          basisColors,
        ),
      );
    }
  }

  return lines.filter(isFiniteLine);
}

export function fixedJointFrameBasisDebugLines(
  body: RAPIER.RigidBody,
  anchor: PhysicsVec3,
  frame: PhysicsQuat,
  length: number,
  colors: readonly PhysicsDebugLine["color"][],
): PhysicsDebugLine[] {
  const basis: readonly PhysicsVec3[] = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];

  return basis.map((axis, index) => {
    const localAxis = rotateVec3ByQuat(axis, normalizeQuat(frame));
    const worldAxis = normalizeVec3(bodyLocalVectorToWorld(body, localAxis));

    return {
      from: anchor,
      to: addScaledVec3(anchor, worldAxis, length),
      color: colors[index] ?? [1, 1, 1, 1],
    };
  });
}

export function fixedJointFrameBasisColors(): readonly PhysicsDebugLine["color"][] {
  return [
    [1, 0.25, 0.25, 1],
    [0.35, 1, 0.35, 1],
    [0.25, 0.55, 1, 1],
  ];
}

export function isFiniteLine(line: PhysicsDebugLine): boolean {
  return (
    line.from.every(Number.isFinite) &&
    line.to.every(Number.isFinite) &&
    line.color.every(Number.isFinite)
  );
}

export function colorForDebugVertex(
  colors: Float32Array,
  vertexIndex: number,
): PhysicsDebugLine["color"] {
  const offset = vertexIndex * 4;

  return [
    colors[offset] ?? 1,
    colors[offset + 1] ?? 1,
    colors[offset + 2] ?? 1,
    colors[offset + 3] ?? 1,
  ];
}
