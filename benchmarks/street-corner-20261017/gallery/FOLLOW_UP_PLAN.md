# Aperture follow-up plan from the street-corner trial

This is proposed work, not a claim that these changes are implemented. The
benchmark froze the engine and dependencies. Preserve ECS authority, the
worker/snapshot boundary, WebGPU-only rendering, and direct Dawn-backed Node
tooling without importing vGPU.

## 1. Return failed captures promptly

The first Aperture attempt correctly diagnosed zero-area foliage triangles, but
its capture lifecycle took 122.36 seconds. Trace whether the pending selection,
release request, or both retain their timeout after the worker fails. Propagate
the original diagnostic through capture and make cleanup bounded and idempotent.
A known fatal worker error must not become a generic two-minute wait.

Acceptance: cover errors before selection, during selection, during rendering,
and during release; assert rejection on the failure event with fake timers rather
than waiting out a deadline. Check that listeners/timers are removed, held state
is released, and a subsequent healthy session succeeds. Re-run the retained
invalid-mesh fixture through the approved browser route, with a generous bounded
failure deadline and cleanup proof. Preserve successful still-image pixels.

## 2. Make display-color authoring explicit

The first valid Aperture image was washed out. The author fixed it by converting
the normalized display-space values returned by `hexColor` into linear material
values. `packages/math/src/scalars.ts` currently normalizes bytes; it does not
perform that conversion.

Provide an obvious public sRGB-hex-to-linear material-color helper and document
the color spaces of base color, light color, clear color and textures. Preserve
the existing helper's compatibility rather than silently changing every scene.
Include this in the first material example and the still-image recipe.

Acceptance: verify known transfer-function values and alpha preservation; add a
small rendered color fixture for both browser and Dawn. A fresh author should be
able to use an ordinary hex palette without independently deriving the transfer
function or spending a revision correcting the entire scene.

## 3. Improve the default path to a finished diorama

Create a compact, documented lighting recipe with warm key/fill balance, readable
dark storefronts, subtle contact shading, and shadows fitted to the subject.
Handle large backdrop receivers without letting them determine the useful shadow
extent. Include camera framing and color setup in the same runnable example.
Keep effects configurable, and preserve the existing AO silhouette correction.

Acceptance: review the street corner, garden and a simple glossy-object scene at
fixed resolution. Check contact regions and silhouettes, shadow clipping, bright
plaster, dark glazing, and browser/Dawn parity. Use anonymous before/after visual
review; do not equate stronger AO or higher sample counts with better quality.

## 4. Remove repeated small authoring traps

- Offer a worker-safe, portable shop-sign/text recipe. The street author built
  block glyphs and corrected mirrored side lettering; legibility and polish
  should not require inventing a font or relying on a browser-only DOM path.
- Add a concise local-transform example for rotated assemblies. The car required
  correcting Euler composition before its windshield aligned correctly.
- Provide a robust faceted foliage/icosphere recipe with deterministic variation,
  valid winding and no polar degenerate triangles. Reuse the public mesh APIs.

Acceptance: author a sign on two perpendicular faces, a rotated compact car, and
two seeded faceted trees using only documented facade APIs. Verify geometry
validity, expected bounds/orientation, strict asset closure and browser/Dawn
captures. These helpers must not introduce a second source of scene state.

## 5. Profile rendering with equal images and settings

The final Aperture frame spent about 5.22 seconds awaiting GPU completion on
SwiftShader. The supplementary Dawn render also spent 5.60 seconds at its GPU
fence. The three authors used different shading and draw strategies; their raw
render times do not isolate renderer efficiency.

Use the frozen Aperture scene to measure cold and retained-session rendering,
explicitly separating extraction, decode, resource preparation, CPU submission,
GPU completion, readback and PNG encoding. Profile shadow filtering, AO and
repeated-object submission. Test caching/batching where measurements support it.
Treat reduced effects as quality ablations, not same-image speedups. Explore a
documented simple lit shader recipe separately from the full PBR baseline.

Acceptance: retain images, settings, adapter identity, resource/draw counters and
several timing samples. Require pixel equivalence for changes advertised as
same-image optimizations. For quality tradeoffs, show both images and blind
ratings. Use a minimum-based estimator and additive allowance if a relative
timing gate is introduced, per repository guidance; avoid fragile timing tests.

## 6. Repeat the author experiment after these changes

Use fresh authors, the same street reference, fixed versions, equal budgets and
the same capture route. Run multiple authors per framework and counterbalance
dispatch order. Record first capture request, first useful image, final image,
completion, failures and capture queues. Either avoid shared capture contention
or explicitly account for it when applying the author budget. Capture actual
tokens/cost only if supported instrumentation is available.

Success means fewer corrective iterations and a better useful first image,
without losing final visual quality or full-app architecture. One faster agent
or one higher subjective score is insufficient evidence of a general win.
