import type {
  PhysicsPointProjection,
  PhysicsQueryOptions,
  PhysicsRay,
  PhysicsRaycastHit,
  PhysicsShapeCast,
  PhysicsShapeCastHit,
} from "../backend.js";
import type { PhysicsVec3 } from "../components.js";
import { bodyRadius, colliderCenter, cloneTransform } from "./bodies.js";
import { add, addScaled, dot, normalize, scale, subtract } from "./math.js";
import type { TestBody, TestCollider } from "./types.js";

export function raycastSphere(
  ray: PhysicsRay,
  body: TestBody,
  collider: TestCollider,
  maxDistance: number,
): PhysicsRaycastHit | null {
  const center = colliderCenter(body, collider);
  const originToCenter = subtract(center, ray.origin);
  const tca = dot(originToCenter, ray.direction);
  if (tca < 0) {
    return null;
  }
  const closestDistanceSq = dot(originToCenter, originToCenter) - tca * tca;
  const radiusSq = collider.radius * collider.radius;
  if (closestDistanceSq > radiusSq) {
    return null;
  }
  const thc = Math.sqrt(radiusSq - closestDistanceSq);
  const distanceValue = tca - thc;
  if (distanceValue < 0 || distanceValue > maxDistance) {
    return null;
  }
  const point = addScaled(ray.origin, ray.direction, distanceValue);
  const normal = normalize(subtract(point, center));
  return {
    entity: body.entity,
    collider: collider.entity,
    point,
    normal,
    distance: distanceValue,
  };
}

export function castSphereBounds(
  queryRadius: number,
  cast: PhysicsShapeCast,
  body: TestBody,
  collider: TestCollider,
): PhysicsShapeCastHit | null {
  const start = cast.from.translation;
  const end = cast.to.translation;
  const delta = subtract(end, start);
  const center = colliderCenter(body, collider);
  const startToCenter = subtract(start, center);
  const combinedRadius = collider.radius + queryRadius;
  const c = dot(startToCenter, startToCenter) - combinedRadius * combinedRadius;

  if (c <= 0) {
    const normal = normalize(startToCenter);

    return {
      entity: body.entity,
      collider: collider.entity,
      timeOfImpact: 0,
      point: addScaled(center, normal, collider.radius),
      normal,
    };
  }

  const a = dot(delta, delta);

  if (a <= Number.EPSILON) {
    return null;
  }

  const b = dot(startToCenter, delta);
  const discriminant = b * b - a * c;

  if (discriminant < 0) {
    return null;
  }

  const timeOfImpact = (-b - Math.sqrt(discriminant)) / a;

  if (timeOfImpact < 0 || timeOfImpact > 1) {
    return null;
  }

  const queryCenterAtImpact = addScaled(start, delta, timeOfImpact);
  const normal = normalize(subtract(queryCenterAtImpact, center));

  return {
    entity: body.entity,
    collider: collider.entity,
    timeOfImpact,
    point: addScaled(center, normal, collider.radius),
    normal,
  };
}

export function projectPointToBody(
  point: PhysicsVec3,
  body: TestBody,
  collider: TestCollider,
): PhysicsPointProjection {
  const center = colliderCenter(body, collider);
  const centerToPoint = subtract(point, center);
  const distanceToCenter = Math.hypot(
    centerToPoint[0],
    centerToPoint[1],
    centerToPoint[2],
  );
  const radius = collider.radius;
  const normal = normalize(centerToPoint);
  const projectedPoint = addScaled(center, normal, radius);

  return {
    entity: body.entity,
    collider: collider.entity,
    point: projectedPoint,
    normal,
    distance: Math.abs(distanceToCenter - radius),
    inside: distanceToCenter <= radius,
  };
}

export function nearestCharacterHit(
  bodies: ReadonlyMap<string, TestBody>,
  character: TestBody,
  cast: PhysicsShapeCast,
  options: PhysicsQueryOptions,
): PhysicsShapeCastHit | null {
  const hits: PhysicsShapeCastHit[] = [];
  const delta = subtract(cast.to.translation, cast.from.translation);

  for (const body of bodies.values()) {
    if (body.entity === character.entity) {
      continue;
    }

    for (const collider of body.colliders) {
      if (!queryAllowsCollider(body, collider, options)) {
        continue;
      }

      const hit = castSphereBounds(bodyRadius(character), cast, body, collider);

      if (hit !== null && dot(hit.normal, delta) < -0.000001) {
        hits.push(hit);
      }
    }
  }

  return (
    hits.sort(
      (left, right) =>
        left.timeOfImpact - right.timeOfImpact ||
        left.entity.localeCompare(right.entity) ||
        (left.collider ?? "").localeCompare(right.collider ?? ""),
    )[0] ?? null
  );
}

export function characterMovementAfterHit(
  desiredTranslation: PhysicsVec3,
  hit: PhysicsShapeCastHit,
  slide: boolean,
): PhysicsVec3 {
  const applied = scale(desiredTranslation, hit.timeOfImpact);
  const remaining = scale(desiredTranslation, 1 - hit.timeOfImpact);

  if (!slide) {
    return applied;
  }

  const intoNormal = dot(remaining, hit.normal);
  const slideRemaining =
    intoNormal < 0
      ? subtract(remaining, scale(hit.normal, intoNormal))
      : remaining;

  return add(applied, slideRemaining);
}

export function isCharacterGrounded(
  bodies: ReadonlyMap<string, TestBody>,
  character: TestBody,
  up: PhysicsVec3,
  options: PhysicsQueryOptions,
  snapDistance: number,
): boolean {
  const probeDistance = Math.max(0.001, snapDistance + 0.001);
  const down = scale(up, -probeDistance);
  const cast: PhysicsShapeCast = {
    from: cloneTransform(character.transform),
    to: {
      translation: add(character.transform.translation, down),
      rotation: character.transform.rotation,
    },
  };
  const hit = nearestCharacterHit(bodies, character, cast, options);

  return hit !== null && dot(hit.normal, up) > 0.5;
}

export function queryAllowsCollider(
  body: TestBody,
  collider: TestCollider,
  options: PhysicsQueryOptions,
): boolean {
  if (
    body.entity === options.excludeEntity ||
    collider.entity === options.excludeEntity
  ) {
    return false;
  }
  if (collider.sensor && options.includeSensors !== true) {
    return false;
  }
  if (
    options.collisionGroups !== undefined &&
    !interactionGroupsCompatible(
      options.collisionGroups,
      collider.collisionGroups,
    )
  ) {
    return false;
  }

  return true;
}

export function interactionGroupsCompatible(
  query: number,
  collider: number,
): boolean {
  return ((query >>> 16) & collider) !== 0 && ((collider >>> 16) & query) !== 0;
}
