# GLTF Scene Source Status

The GLTF scene example publishes `source.glbFixture` as JSON-safe status for the
current inline GLB fixture bridge.

This status proves the example can start from a GLB-shaped source container and
feed the report-driven glTF import contract. It is not a full async file loader,
URL loader, or drag-and-drop viewer.

The browser example routes its inline fixture through the no-fetch source-loader
facade. That means `source.glbFixture` is loader-style status over already
provided bytes, not evidence of URL or file loading.

`source.glbFixture` may include:

- Loader status such as `loaded`, `failed`, or `blocked`.
- Source kind and primary byte length.
- External buffer status summaries.
- GLB validity and byte length.
- JSON and BIN chunk summaries.
- Container diagnostics.
- Import-stage validity summaries.
- External-buffer resolver diagnostics when a fixture needs caller-provided URI
  buffer bytes.

Malformed GLB containers publish compact error status instead of running import
stages:

- `valid` is `false`.
- `byteLength` is `null` when no parsed container is available.
- `chunks` is empty when parsing stops before a valid container exists.
- `diagnostics` contains the structured container error.
- `importStages` is empty because report-driven import stages do not run.

A no-fetch source-loader facade exists for tests and future orchestration work.
It accepts already available GLB bytes plus optional caller-provided external
buffer bytes, then returns loader-style status and the same GLB import report.
It is not used as evidence of browser file loading.

Facade output may include mesh-construction summaries such as mesh count,
submesh count, vertex count, index count, validity, and diagnostic count. These
are compact readiness summaries derived from import reports. They do not expose
raw mesh arrays, ECS world state, source registry internals, or WebGPU resources.

The current browser GLTF scene reports `outputSummary.meshConstruction.status`
as `absent`. That is intentional: the inline GLB fixture proves source status
and root parsing, while the visible primitive meshes still use the established
browser fixture authoring path.

The browser status also includes `source.bufferBackedGlbFixture`, a separate
source/import proof with one indexed triangle backed by GLB BIN bytes. It can
report `outputSummary.meshConstruction.status` as `ready`, but it is not yet the
source of the visible rendered scene.

Deferred output stages:

- Source asset registration execution. Provided source-registration reports can
  be summarized, but the facade does not write to a registry itself.
- ECS authoring command-plan summaries.
- ECS command replay status from facade output.
- Render-world or WebGPU preparation summaries.

`source.glbFixture` must not include:

- Raw GLB container bytes.
- Raw decoded image bytes.
- WebGPU handles.
- ECS world state.

Deferred source-loading work:

- External URI fetching and scheduling. The fixture bridge can consume
  caller-provided URI buffer bytes for tests, but it does not fetch them.
- Image decoding from GLB bufferView bytes.
- Draco, meshopt, KTX2/Basis, WebP, AVIF, and other compression paths.
- Full glTF validator integration.
- Loader cache, retry, reload, unload, and dependency lifecycle behavior.
- Broad file loading and viewer UI behavior.
