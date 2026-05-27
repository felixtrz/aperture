import {
  type Entity,
  transformAabb,
  transformPoint,
  type Aabb,
  type BoundingSphere,
  type Mat4,
} from "@aperture-engine/simulation";
import type { MeshAsset } from "../mesh/index.js";
import type { BoundsPacket } from "./snapshot.js";
import { entityRef } from "./extraction-diagnostics.js";

export function createBoundsPacket(
  boundsId: number,
  entity: Entity,
  mesh: MeshAsset,
  worldMatrix: Mat4,
): BoundsPacket {
  const localAabb = mesh.localAabb as Aabb;
  const localSphere = mesh.localSphere as BoundingSphere;
  const center = transformPoint(worldMatrix, localSphere.center);

  return {
    boundsId,
    entity: entityRef(entity),
    localAabb,
    worldAabb: transformAabb(localAabb, worldMatrix),
    localSphere,
    worldSphere: { center, radius: localSphere.radius },
  };
}
