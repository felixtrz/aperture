# StandardMaterial IBL Shader Bind Group Limit Audit

Date: 2026-05-19

## Question

Can the next StandardMaterial IBL shader slice bind the existing IBL resource as
WGSL `@group(4)` in the browser path?

## Finding

Not yet. The previous shadow receiver work recorded Chrome's WebGPU
`maxBindGroups` limit as `4`, and Aperture already uses groups `0` through `3`
for StandardMaterial forward draws:

- group 0: view projection uniform
- group 1: world transform storage
- group 2: StandardMaterial resources
- group 3: light resources, or the combined light/shadow receiver resources

WGSL `@group(4)` would require a fifth bind group. That is the same limit that
forced the shadow receiver path to collapse its planned separate shadow group
into the browser-safe combined group 3 layout. Routing the IBL bind group through
app frame resources is still useful as a readiness and ownership proof, but
making it executable as group 4 would violate the current browser proof target.

## Options

1. Extend the combined group 3 StandardMaterial layout to carry direct lights,
   shadow receiver resources, and IBL texture/sampler resources.
2. Move IBL resources into group 2 with StandardMaterial resources for IBL-capable
   StandardMaterial pipeline variants.
3. Keep group 4 as a non-executable planning/resource identity and introduce a
   browser-safe executable alias only when shader sampling is enabled.

Option 1 best matches the recent shadow receiver workaround and keeps group 2
focused on material-local resources. Option 2 may fit material ownership but
risks making the material bind group vary more across environment/shadow state.
Option 3 preserves the current group 4 planning vocabulary but still needs a
concrete executable layout.

## Recommendation

Use option 1 for the near-term browser path. Decision 0013 records this: group 4
remains the JSON-safe planning/cache/resource identity, while executable
StandardMaterial IBL sampling aliases the required IBL texture/sampler resources
into a combined browser-safe group 3 layout.

Do not add `@group(4)` to the browser StandardMaterial shader path unless the app
can prove the device supports at least five bind groups and the example gates the
variant accordingly.

## Validation

No code validation was required for this audit beyond inspecting the current
shader/layout path, the existing handoff records for the `maxBindGroups`
blocker, and updating `docs/DECISIONS.md`.
