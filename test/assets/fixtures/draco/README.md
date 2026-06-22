# Draco Decoder Fixtures

These fixtures support the public Draco decoder tests.

- `bunny.drc` is copied from the three.js project
  (https://github.com/mrdoob/three.js, `examples/models/draco/bunny.drc`).
- `draco_wasm_wrapper.js` and `draco_decoder.wasm` are copied from the three.js
  project (https://github.com/mrdoob/three.js, `examples/jsm/libs/draco/gltf/`),
  which vendors them from the Draco project (https://github.com/google/draco).
- `heart_draco.glb` is a Draco-compressed glTF test fixture vendored into this
  repository as a binary test asset.

Keep the wrapper and WASM files updated together.
