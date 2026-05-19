# Shadow Matrix Buffer Upload Resource Plan — 2026-05-19

## Task

Completed `task-1852` as a focused plan for the next shadow resource slice.

## Reference Anchors

- `packages/webgpu/src/webgpu/directional-shadow-matrix-computation.ts`
- `packages/webgpu/src/webgpu/shadow-matrix-buffer-descriptor.ts`
- `packages/webgpu/src/webgpu/shadow-depth-texture-resource.ts`
- `packages/webgpu/src/webgpu/standard-material-shadow-bind-group-layout.ts`
- `packages/webgpu/src/webgpu/buffer.ts`

## Comparison

### Matrix Buffer Allocation And Upload

This is the best next slice. Aperture already has:

- directional shadow view/projection planning;
- computed JSON-safe view/projection matrix arrays;
- a `ShadowMatrixBufferDescriptorReport` with stable offsets and byte sizes;
- a general `createWebGpuBuffer()` helper that can allocate and write initial
  data; and
- GLTF scene status fields for matrix computation and matrix buffer
  descriptors.

The missing piece is a renderer-owned buffer resource report that packs the
computed `viewProjectionMatrix` arrays into a contiguous `Float32Array`,
allocates a read-only storage buffer with copy-dst/storage usage, uploads the
data, and reports created/reused buffer resources without exposing raw GPU
handles.

### Shadow Bind-Group Descriptor Planning

This is the right follow-up after matrix upload. Group 5 layout metadata exists
for matrix buffer, depth texture, and sampler bindings, but descriptor planning
should not proceed until the matrix buffer resource has a stable live resource
key and JSON-safe report. Otherwise the descriptor report would need another
placeholder for the most important binding.

### Shadow Pass Command Encoding

This remains too early. The pass will need depth texture resources, shadow
caster draw lists, matrix buffer bindings, pipeline selection for a depth-only
or shadow caster path, and a command encoding policy. Starting command encoding
before matrix upload would produce another deferred report layer rather than a
useful WebGPU resource milestone.

## Selected Follow-Up

Implement a renderer-owned shadow matrix buffer resource report.

Suggested task:

```md
### task-1853 — Allocate shadow matrix buffer resources

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, targeted tests, GLTF scene status path.
Reference anchor:
local `directional-shadow-matrix-computation`,
`shadow-matrix-buffer-descriptor`, `buffer`, and
`standard-material-shadow-bind-group-layout` helpers.

Acceptance criteria:

- Add a `ShadowMatrixBufferResourceReport` with JSON helpers.
- Pack computed directional shadow view-projection matrices into a contiguous
  `Float32Array` using descriptor offsets.
- Allocate/upload a renderer-owned storage buffer from the packed data and
  report created/reused counts without exposing raw GPU handles.
- Update GLTF scene status/readiness with `shadow.matrixBufferResource`.
- Keep shadow bind-group creation, shadow pass submission, and shader sampling
  deferred.
```

## Notes

Use the existing `createWebGpuBuffer()` helper rather than adding a new buffer
abstraction. The report should remain renderer-owned and derived from extracted
shadow/matrix data; it must not write GPU handles into ECS components or render
snapshot data.
