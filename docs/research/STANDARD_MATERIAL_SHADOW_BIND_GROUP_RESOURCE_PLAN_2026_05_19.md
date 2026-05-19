# StandardMaterial Shadow Bind-Group Resource Plan — 2026-05-19

## Task

Completed `task-1854` as a focused plan for the next StandardMaterial shadow
resource slice.

## Reference Anchors

- `packages/webgpu/src/webgpu/standard-material-shadow-bind-group-layout.ts`
- `packages/webgpu/src/webgpu/shadow-matrix-buffer-resource.ts`
- `packages/webgpu/src/webgpu/shadow-depth-texture-resource.ts`
- `packages/webgpu/src/webgpu/shadow-pass-plan.ts`
- `packages/webgpu/src/webgpu/standard-material-ibl-bind-group.ts`

## Comparison

### Shadow Bind-Group Descriptor Planning

This is the best next slice. Group 5 layout metadata now exists, and the GLTF
scene has the two renderer-owned resources that should feed group 5:

- a live directional shadow matrix storage buffer; and
- a live shadow depth texture/view.

The missing descriptor plan can stay JSON-safe and validate the group 5
resource contract without creating new GPU work. It should plan bindings for
the matrix buffer, shadow map texture view, and a deferred/default shadow
sampler resource key. Missing pieces should diagnose clearly rather than
falling back to hidden renderer state.

### Live Shadow Bind-Group Creation

This should follow descriptor planning. It needs a stable descriptor resource
key and a concrete shadow sampler resource policy. Creating bind groups first
would either duplicate descriptor planning inline or hide resource assumptions.

### First Shadow Pass Command Encoding

This remains one step too early. The pass needs shadow caster draw resources,
depth-only pipeline policy, matrix-buffer binding, and depth attachment wiring.
Those choices are easier to review after group 5 descriptors make the resource
contract explicit.

## Selected Follow-Up

Implement StandardMaterial shadow bind-group descriptor planning.

Suggested task:

```md
### task-1855 — Create StandardMaterial shadow bind-group descriptor plans

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu`, targeted tests, GLTF scene status path.
Reference anchor:
local `standard-material-shadow-bind-group-layout`,
`shadow-matrix-buffer-resource`, `shadow-depth-texture-resource`, and
`standard-material-ibl-bind-group`.

Acceptance criteria:

- Add JSON-safe group 5 descriptor planning for shadow matrix buffer, shadow
  depth texture view, and shadow sampler resources.
- Report missing matrix/depth/sampler resources with stable diagnostics.
- Expose `shadow.bindGroupDescriptor` in the GLTF scene status.
- Keep live shadow bind-group creation and shader sampling deferred.
```

## Notes

The sampler can be descriptor-only in this slice if no shadow sampler resource
helper exists yet. Do not create a hidden global sampler; use a stable planned
resource key and diagnose that live sampler/bind-group creation remains
deferred.
