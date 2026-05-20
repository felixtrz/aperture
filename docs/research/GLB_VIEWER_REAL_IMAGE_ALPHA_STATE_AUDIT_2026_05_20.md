# GLB Viewer Real-Image and Alpha-State Audit — 2026-05-20

## Scope

Audited the GLB viewer slices for same-origin PNG URI decode, textured
alpha-blend rendering, and rotated metallic-roughness texture-transform status.

Reference anchors inspected:

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `references/bevy/crates/bevy_gltf/src/loader/mod.rs`
- `references/bevy/crates/bevy_gltf/src/loader/gltf_ext/material.rs`
- `references/three.js/examples/jsm/loaders/GLTFLoader.js`
- `examples/glb-viewer.js`
- `test/e2e/glb-viewer.spec.ts`

## Findings

- ECS authority is preserved. GLB fixtures still become source mesh/material/
  texture/sampler assets, resolve primitive material handles, replay ECS
  authoring commands, and render only through extracted snapshots.
- Same-origin PNG decode remains renderer-independent. The viewer fetches and
  decodes PNG URI images before source-asset mapping, then passes RGBA bytes,
  dimensions, row stride, and rows-per-image through the existing
  `resolveImageData` contract. It does not create GPU textures or prepared
  resources in ECS or the GLB loader.
- Status remains JSON-safe. `source.imageDecode` reports image index, URI,
  formatted URL, MIME type, dimensions, and byte length only. It does not expose
  image bitmaps, canvas objects, raw bytes, GLB bytes, GPU handles, bind groups,
  or backend resource objects.
- Existing deterministic synthetic resolver branches remain fallback-only for
  older fixtures. The new URI PNG and alpha-blend fixtures prove the real image
  path because their image URIs are not handled by the fallback resolver.
- Alpha blend stays source-authored and route-derived. glTF `alphaMode: "BLEND"`
  maps to StandardMaterial `alphaMode: "blend"`, `blendPreset: "alpha"`, and
  `depthWrite: false`; WebGPU blending remains in the backend pipeline route.
- The rotated metallic-roughness transform remains slot-scoped source metadata.
  `KHR_texture_transform.rotation` is preserved on
  `pbrMetallicRoughness.metallicRoughnessTexture`, appears in compact viewer
  status, and is consumed through the existing material texture-transform
  uniforms.
- WebGPU ownership is unchanged. The only GPU resource creation in
  `glb-viewer` remains the viewer-owned IBL/shadow helper resources that
  predated this slice. Imported GLB textures still become prepared WebGPU
  resources only through the normal backend app path.

## Corrective Work

No corrective refactor was required.

## Risks And Follow-Ups

- The same-origin decoder is still example-local and synchronous at the
  `resolveImageData` boundary by design: it predecodes before invoking the
  current source-asset mapping contract. A package-level async image dependency
  pipeline should be a separate design slice if broader glTF image loading moves
  out of the example.
- Failed same-origin PNG fetches currently fall back silently when an older
  deterministic fixture has a synthetic resolver branch. This keeps existing
  fixtures stable, but a future general loader should distinguish optional
  fixture fallback from real asset failures in package-level diagnostics.

## Recommendation

Continue with the next visible GLB fidelity slice: broaden texture decode or
material-slot coverage only when it produces browser-visible behavior and
JSON-safe diagnostics through the ECS → extraction → WebGPU route.
