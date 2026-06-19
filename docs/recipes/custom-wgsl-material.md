# Recipe: Custom WGSL Material

**Status:** reference

## Goal

Author a custom WGSL material from a worker system using the data-only spawn
descriptors (`material.customWgsl`, `shader.asset` / `shader.inlineWgsl`).
Systems never touch WebGPU objects: they declare shader source, entry points,
render state, and JSON-safe uniform bindings; the generated main-thread app
compiles the WGSL and owns the pipeline. Verify the draw flows through the
custom pipeline family.

## Code

### 1. Declare the shader asset in config

```ts
generatedWater: asset.shader("/shaders/generated-water.wgsl", {
  preload: "blocking",
}),
```

Source: `examples/developer-api/aperture.config.ts` (`assets` block excerpt).

### 2. The WGSL contract

The committed example shader shows the binding contract the renderer provides:
group 0 holds the view-projection uniform, group 1 the per-instance world
transforms, and group 2 your declared material bindings.

```wgsl
struct ViewProjectionUniform {
  viewProjection: mat4x4f,
  cameraPosition: vec4f,
};

struct GeneratedWaterUniform {
  color: vec4f,
};

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,
  @builtin(instance_index) instanceIndex: u32,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@group(0) @binding(0) var<uniform> view: ViewProjectionUniform;
@group(1) @binding(0) var<storage, read> worldTransforms: array<mat4x4f>;
@group(2) @binding(0) var<uniform> water: GeneratedWaterUniform;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let world = worldTransforms[input.instanceIndex];
  output.position = view.viewProjection * world * vec4f(input.position, 1.0);
  output.uv = input.uv;
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let band = 0.35 + 0.65 * input.uv.y;
  return vec4f(water.color.rgb * band, water.color.a);
}
```

Source: `examples/developer-api/public/shaders/generated-water.wgsl`.

### 3. Spawn a mesh with the custom material

```ts
const generatedWaterShader = this.assets.shader("generatedWater");

if (generatedWaterShader.ready.value) {
  this.spawn.mesh({
    key: "level.custom.water",
    name: "generated custom water",
    tags: ["custom-wgsl", "shader-asset"],
    mesh: mesh.plane({ size: [1.3, 0.7] }),
    material: material.customWgsl({
      familyKey: "example/generated-water",
      label: "Generated Water",
      shader: shader.asset(generatedWaterShader),
      entryPoints: { vertex: "vs_main", fragment: "fs_main" },
      renderState: { cullMode: "none" },
      bindings: [
        material.uniform("water", {
          binding: 0,
          visibility: ["fragment"],
          fields: {
            color: { type: EcsType.Vec4, default: [0.02, 0.58, 0.95, 1] },
          },
        }),
      ],
    }),
    transform: { translation: [0, 0.65, -0.9] },
  });
}
```

Source: `examples/developer-api/src/systems/setup.system.ts` (`init`).

### 4. Inline-WGSL variant (no config asset)

For generated or test-time shaders, `shader.inlineWgsl` replaces the config
asset:

```ts
const inlineShader = shader.inlineWgsl(
  "@vertex fn vs_main() -> @builtin(position) vec4f { return vec4f(); }\n@fragment fn fs_main() -> @location(0) vec4f { return vec4f(1.0); }",
  { virtualPath: "inline-water.wgsl" },
);
```

Source: `test/app/developer-api.test.ts` ("exposes worker-safe custom WGSL
material and shader builders").

## Verify

1. Headless (vitest) proof that the draw uses the custom pipeline family and
   the material asset stays worker-safe (no GPU objects):

```ts
const report = runner.step(1 / 60, 0);
const draw = report.snapshot.meshDraws[0];

expect(report.snapshot.views).toHaveLength(1);
expect(report.snapshot.meshDraws).toHaveLength(1);
expect(draw?.batchKey.pipelineKey.startsWith("app/water|")).toBe(true);

const materialEntry =
  draw === undefined
    ? undefined
    : runner.app.lowLevel.assets.get(draw.material);

expect(materialEntry?.status).toBe("ready");
expect(materialEntry?.asset).toMatchObject({
  sourceDiscriminator: "custom-material-source",
  shaderLanguage: "wgsl",
  familyKey: "app/water",
  shader: { kind: "shader-asset", handle: waterShader },
});
expect(JSON.stringify(materialEntry?.asset)).not.toContain("GPU");
```

Source: `test/app/developer-api.test.ts` ("loads shader config assets for
system-authored custom WGSL materials"). The `pipelineKey` is prefixed by your
`familyKey`.

2. Browser e2e proof that the spawned entity exists with its tags:

```ts
const entitySnapshot =
  status?.lastWorkerSummary?.entityTools?.lastSnapshot ??
  status?.lastWorkerSummary?.entities;

expect(entitySnapshot?.summaries ?? []).toEqual(
  expect.arrayContaining([
    expect.objectContaining({
      key: "level.custom.water",
      tags: expect.arrayContaining(["custom-wgsl", "shader-asset"]),
    }),
  ]),
);
```

Source: `test/e2e/developer-api.spec.ts` (excerpt; the source assertion also
matches the crate and robot entries in the same array).

3. Pixel-level proof that a custom WGSL draw reaches the GPU (full draw-path
   report fields for the explicit render route):

```ts
expect(status, JSON.stringify(status, null, 2)).toMatchObject({
  example: "custom-wgsl-material",
  scenario: "custom-wgsl",
  ok: true,
  phase: "submit",
  renderingBackend: "webgpu-explicit",
  customMaterial: {
    family: "example/triangle-water",
    sourceMaterialKey: "material:triangle",
    materialResourceKey: "material:triangle",
    diagnostics: 0,
  },
  extraction: { views: 1, meshDraws: 1, diagnostics: 0 },
  binding: { planned: 1, applied: 1, diagnostics: 0 },
  renderWorld: { active: 1, ready: 1, blocked: 0 },
  draw: { packages: 1, descriptors: 1, drawList: 1, resolved: 1 },
  command: { drawCount: 1, indexedDrawCount: 1 },
  submission: { commandBuffers: 1, drawCalls: 1, indexedDrawCalls: 1 },
});
```

Source: `test/e2e/custom-wgsl-material.spec.ts` ("custom WGSL material route
renders through the full WebGPU draw path").

4. With a managed dev session, the generic tools apply: `pnpm exec aperture
tool ecs_find_entities --json '{"tags":["custom-wgsl"]}'` finds the entity, and
   `pnpm exec aperture tool render_explain_entity --json '{"key":"level.custom.water"}'`
   should report `rendered: true` (call shape lifted in
   [spawn-gltf-scene.md](./spawn-gltf-scene.md) from
   `test/e2e/cli-ai-tools.spec.ts`).

## Revert / cleanup

The material is authoring-time data: remove the `spawn.mesh` block or the
`asset.shader` config entry and reload. Custom-material uniform values are
declared in the descriptor (`bindings[].fields.*.default`); material
parameters are not part of the `ecs_set_component_field` registry, so runtime
material edits are out of scope for this recipe.

See `docs/AUTHORING.md` ("Custom WGSL Materials") for the concept-level
walkthrough, and `playground/GAME_PLAN.md` for the worked app flow.
