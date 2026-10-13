/* global document */
import * as THREE from "three/webgpu";
import workload from "./workload.json";
import { groupedInstances } from "./scene.mjs";
import { createThreeGeometry } from "./three-geometry.mjs";

// Check before constructing a renderer: a missing adapter cannot enter fallback.
if (!navigator.gpu || !(await navigator.gpu.requestAdapter()))
  throw new Error("Native WebGPU adapter required");
const settings = workload.settings;
const renderer = new THREE.WebGPURenderer({
  antialias: true,
  samples: settings.sampleCount,
});
renderer.setPixelRatio(settings.pixelRatio);
renderer.setSize(settings.viewport.width, settings.viewport.height);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = settings.exposure;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = settings.shadow.enabled;
renderer.shadowMap.type = THREE.PCFShadowMap;
// The workload is static, as are its light and fixed shadow camera. Aperture's
// automatic static shadow reuse and Three's public static reuse are both enabled.
document.body.append(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(...settings.clearColor.slice(0, 3));
const sourceCamera = settings.camera;
const camera = new THREE.PerspectiveCamera(
  sourceCamera.fovYDegrees,
  settings.viewport.width / settings.viewport.height,
  sourceCamera.near,
  sourceCamera.far,
);
camera.position.fromArray(sourceCamera.position);
camera.lookAt(new THREE.Vector3().fromArray(sourceCamera.target));

scene.add(
  new THREE.AmbientLight(
    new THREE.Color(...settings.ambient.color),
    settings.ambient.intensity,
  ),
);
const sun = new THREE.DirectionalLight(
  new THREE.Color(...settings.sun.color),
  settings.sun.intensity,
);
sun.position.fromArray(
  settings.sun.directionToLight.map(
    (value, axis) =>
      settings.shadow.center[axis] + value * settings.shadow.lightDistance,
  ),
);
sun.target.position.fromArray(settings.shadow.center);
sun.castShadow = settings.shadow.enabled;
sun.shadow.autoUpdate = false;
sun.shadow.needsUpdate = settings.shadow.enabled;
sun.shadow.mapSize.set(settings.shadow.mapSize, settings.shadow.mapSize);
const half = settings.shadow.orthographicSize / 2;
Object.assign(sun.shadow.camera, {
  left: -half,
  right: half,
  top: half,
  bottom: -half,
  near: settings.shadow.near,
  far: settings.shadow.far,
});
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -settings.shadow.bias;
sun.shadow.normalBias = settings.shadow.normalBias;
sun.shadow.radius = settings.shadow.filterRadius;
sun.shadow.intensity = settings.shadow.strength;
scene.add(sun, sun.target);

const textures = new Map(
  workload.textures.map((source) => {
    const texture = new THREE.DataTexture(
      Uint8Array.from(source.bytes),
      source.width,
      source.height,
      THREE.RGBAFormat,
      THREE.UnsignedByteType,
    );
    texture.name = source.id;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.flipY = false;
    texture.needsUpdate = true;
    return [source.id, texture];
  }),
);
const materials = new Map(
  workload.materials.map((source) => [
    source.id,
    new THREE.MeshStandardMaterial({
      name: source.id,
      color: new THREE.Color(...source.color.slice(0, 3)),
      metalness: source.metallic,
      roughness: source.roughness,
      map: source.texture ? textures.get(source.texture) : null,
    }),
  ]),
);
const geometries = new Map(
  workload.geometries.map((source) => [
    source.id,
    createThreeGeometry(THREE, source),
  ]),
);
for (const group of groupedInstances(workload)) {
  const source = group.instances[0];
  const mesh = new THREE.InstancedMesh(
    geometries.get(source.geometry),
    materials.get(source.material),
    group.instances.length,
  );
  mesh.name = group.id;
  // Three does not cull individual instances in InstancedMesh. Disable view
  // culling in both adapters so one engine cannot omit more source instances.
  mesh.frustumCulled = settings.camera.frustumCulling;
  mesh.castShadow = settings.shadow.enabled && source.castShadow;
  mesh.receiveShadow = settings.shadow.enabled && source.receiveShadow;
  group.instances.forEach((instance, i) =>
    mesh.setMatrixAt(
      i,
      new THREE.Matrix4().compose(
        new THREE.Vector3().fromArray(instance.translation),
        new THREE.Quaternion().fromArray(instance.rotation),
        new THREE.Vector3().fromArray(instance.scale),
      ),
    ),
  );
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  scene.add(mesh);
}
const ready = (async () => {
  await renderer.init();
  if (!renderer.backend.isWebGPUBackend)
    throw new Error("WebGPU backend required; WebGL fallback forbidden");
  await renderer.compileAsync(scene, camera);
})();
globalThis.__AGENT_BENCHMARK__ = {
  engine: "three",
  canvas: renderer.domElement,
  ready,
  async setCamera(source) {
    camera.position.fromArray(source.position);
    camera.fov = source.fovYDegrees;
    camera.near = source.near;
    camera.far = source.far;
    camera.lookAt(new THREE.Vector3().fromArray(source.target));
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  },
  async renderFrame() {
    await ready;
    renderer.render(scene, camera);
  },
  async inspectGeometry() {
    scene.updateMatrixWorld(true);
    const meshes = [];
    scene.traverse((object) => {
      if (!object.isMesh || !object.visible) return;
      const geometry = object.geometry,
        matrix = new THREE.Matrix4(),
        instances = [];
      for (let i = 0; i < object.count; i++) {
        object.getMatrixAt(i, matrix);
        instances.push(
          new Float32Array(
            new THREE.Matrix4().multiplyMatrices(object.matrixWorld, matrix)
              .elements,
          ),
        );
      }
      meshes.push({
        id: object.name,
        positions: geometry.getAttribute("position").array.slice(),
        normals: geometry.getAttribute("normal").array.slice(),
        indices: geometry.index.array.slice(),
        worldMatrix: object.matrixWorld.toArray(),
        instances,
      });
    });
    return { meshes };
  },
  async dispose() {
    renderer.dispose();
    for (const collection of [geometries, materials, textures])
      for (const asset of collection.values()) asset.dispose();
  },
};
