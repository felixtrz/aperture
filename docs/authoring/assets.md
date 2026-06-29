# Asset Authoring For Headless Runs

Headless Node runs use an explicit asset loading mode:

- `placeholder`: fastest structural loop. Unsupported or external assets become
  visible placeholders.
- `hybrid`: load supported local assets with real bytes and record explicit
  placeholders for unsupported assets.
- `strict`: require supported local assets to load with real bytes. Missing,
  unresolved, unsupported, unready, and placeholder assets fail the run or
  render preflight.

```sh
pnpm exec aperture headless aperture.headless.config.ts --out snapshot.json --asset-mode placeholder
pnpm exec aperture headless aperture.headless.config.ts --out snapshot.json --asset-mode hybrid
pnpm exec aperture headless aperture.headless.config.ts --out snapshot.json --asset-mode strict
```

Current Node support includes local GLB/glTF paths, WGSL shader files, audio
bytes, particle assets, PNG/JPEG textures, RGBE `.hdr` environment maps, and
decoder-backed GLB/glTF assets when `--decoder-assets-dir` is provided. The
decoder directory uses the same subpaths as the browser provider:

- `draco/draco_wasm_wrapper.js`
- `draco/draco_decoder.wasm`
- `meshopt/meshopt_decoder.module.js`
- `basis/basis_transcoder.js`
- `basis/basis_transcoder.wasm`

With those files present, strict mode can load Draco-compressed meshes,
EXT_meshopt-compressed buffers, and Basis/KTX2 texture payloads. HDR support is
v1 equirectangular RGBE input: the Node loader embeds an RGBA8 equirect payload
that the render harness can project into renderer-owned IBL resources. Broader
environment formats and prefiltered cube-map payloads remain future expansion.

Resolution rules:

- Root-relative paths such as `/assets/foo.png` resolve under `--public-dir`.
- Config-relative paths resolve under the configured app root.
- GLTF-relative external references resolve relative to the containing GLTF.
- `file:` URLs read through the Node file adapter.
- `data:` URLs decode in-process where the asset kind is supported.
- HTTP(S) assets are disabled for reproducible strict runs unless
  `--allow-http-assets` is passed.

Strict render bundles must be asset-closed. `aperture render` preflights the
bundle and fails before launching the browser if a referenced asset is missing,
unready, placeholder-backed, or still requires filesystem/network access. That
includes environment maps: a referenced environment-map entry must contain an
embedded equirect, diffuse cube, or specular PMREM payload rather than only a
URL or an externally prepared renderer resource.
