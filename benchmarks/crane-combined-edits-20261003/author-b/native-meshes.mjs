import * as THREE from '/three.core.js';

export const equalValues = (a, b) => a.length === b.length && Array.from(a).every((value, i) => Object.is(value, b[i]));
const sameGroups = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function createMeshStore(scene, materials) {
  const meshes = [];
  const counters = { geometriesCreated: 0, geometryReplacements: 0, geometryDisposeCalls: 0, attributesCreated: 0, attributeReplacements: 0, inPlaceAttributeWrites: 0, matrixUpdates: 0, meshesCreated: 0 };
  function geometryFor(source) {
    const geometry = new THREE.BufferGeometry();
    counters.geometriesCreated++;
    for (const [name, array, size] of [['position', source.positions, 3], ['normal', source.normals, 3], ['index', source.indices, 1]]) {
      const attribute = new THREE.BufferAttribute(array.slice(), size).setUsage(THREE.DynamicDrawUsage);
      attribute.name = `${source.name}:${name}`;
      counters.attributesCreated++;
      if (name === 'index') geometry.setIndex(attribute); else geometry.setAttribute(name, attribute);
    }
    for (const group of source.groups) geometry.addGroup(group.start, group.count, group.materialIndex);
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return geometry;
  }
  function create(source, revision) {
    const mesh = new THREE.Mesh(geometryFor(source), source.materials.map(name => materials.get(name)));
    mesh.name = source.name; mesh.matrixAutoUpdate = false; mesh.matrix.fromArray(source.matrix);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.userData = { group: source.group, markers: source.markers, installedWorkerRevision: revision };
    scene.add(mesh); meshes.push(mesh); counters.meshesCreated++;
  }
  function install(data, revision) {
    if (!meshes.length) { for (const source of data.meshes) create(source, revision); }
    else {
      if (data.meshes.length !== meshes.length) throw Error('Live edit changed mesh inventory');
      for (let i = 0; i < meshes.length; i++) {
        const mesh = meshes[i], source = data.meshes[i], old = mesh.geometry;
        if (mesh.name !== source.name || mesh.material.map(material => material.name).join('|') !== source.materials.join('|')) throw Error('Live edit changed semantic mesh/material identity');
        const pairs = [[old.getAttribute('position'), source.positions], [old.getAttribute('normal'), source.normals], [old.index, source.indices]];
        const shapeChanged = pairs.some(([attribute, array]) => attribute.array.constructor !== array.constructor || attribute.array.length !== array.length);
        if (shapeChanged) {
          mesh.geometry = geometryFor(source);
          counters.geometryReplacements++;
          counters.attributeReplacements += pairs.length;
          old.dispose(); counters.geometryDisposeCalls++;
        } else {
          for (const [attribute, array] of pairs) if (!equalValues(attribute.array, array)) {
            attribute.array.set(array); attribute.needsUpdate = true; counters.inPlaceAttributeWrites++;
          }
          if (!sameGroups(old.groups, source.groups)) {
            old.clearGroups();
            for (const group of source.groups) old.addGroup(group.start, group.count, group.materialIndex);
          }
          old.computeBoundingBox(); old.computeBoundingSphere();
        }
        if (!equalValues(mesh.matrix.elements, source.matrix)) { mesh.matrix.fromArray(source.matrix); counters.matrixUpdates++; }
        mesh.userData.markers = source.markers;
        mesh.userData.installedWorkerRevision = revision;
      }
    }
    scene.updateMatrixWorld(true);
  }
  function cpuSnapshot(data) {
    scene.updateMatrixWorld(true);
    return { schema: data.schema, edit: data.edit, parameters: { ...data.parameters }, cameras: data.cameras, palette: data.palette,
      meshes: meshes.map(mesh => ({ name: mesh.name, group: mesh.userData.group,
        positions: Array.from(mesh.geometry.getAttribute('position').array), normals: Array.from(mesh.geometry.getAttribute('normal').array), indices: Array.from(mesh.geometry.index.array),
        cpuStreams: [['position', mesh.geometry.getAttribute('position')], ['normal', mesh.geometry.getAttribute('normal')], ['index', mesh.geometry.index]].map(([semantic, attribute]) => ({ semantic, arrayType: attribute.array.constructor.name, itemSize: attribute.itemSize, byteOffset: attribute.array.byteOffset, byteLength: attribute.array.byteLength, byteStride: attribute.itemSize * attribute.array.BYTES_PER_ELEMENT, rawBytes: Array.from(new Uint8Array(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength)) })),
        materials: mesh.material.map(material => material.name), groups: mesh.geometry.groups.map(group => ({ ...group })), matrix: Array.from(mesh.matrixWorld.elements), markers: mesh.userData.markers })) };
  }
  return { meshes, counters, install, cpuSnapshot };
}
