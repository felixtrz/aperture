import {
  identityMat4,
  type Entity,
  type Mat4,
  WorldTransform,
} from "@aperture-engine/simulation";

export function readWorldMatrix(entity: Entity): Mat4 {
  const matrix = identityMat4();

  matrix.set(entity.getVectorView(WorldTransform, "col0"), 0);
  matrix.set(entity.getVectorView(WorldTransform, "col1"), 4);
  matrix.set(entity.getVectorView(WorldTransform, "col2"), 8);
  matrix.set(entity.getVectorView(WorldTransform, "col3"), 12);
  return matrix;
}

export function pushMatrix(values: number[], matrix: Mat4): number {
  const offset = values.length;
  values.push(...matrix);
  return offset;
}
