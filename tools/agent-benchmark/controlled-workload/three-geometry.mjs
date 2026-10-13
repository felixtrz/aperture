import { typedGeometry } from "./scene.mjs";

// Shared by the live adapter and offline validation, so validation checks the
// same actual BufferGeometry construction used to produce the submitted scene.
export function createThreeGeometry(THREE, source) {
  const data = typedGeometry(source),
    geometry = new THREE.BufferGeometry();
  geometry.name = source.id;
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(data.positions, 3),
  );
  geometry.setAttribute("normal", new THREE.BufferAttribute(data.normals, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(data.uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
  return geometry;
}
