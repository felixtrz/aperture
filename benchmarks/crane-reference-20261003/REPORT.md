# Crane courtyard reference: local completion report

## Result

A deterministic procedural low-poly industrial courtyard reference is complete. The final scene has 78 semantic mesh objects and 2,444 triangles. All three 1024 × 1024 reference views were rendered by installed Blender 4.3.2, Cycles CPU, 256 samples, fixed seed 314159, without denoising. The builder uses no downloaded assets, texture maps or external Python packages. Existing engine sources and earlier benchmark evidence were not changed by this task.

Deliverables:

- `build-reference.py`: retained deterministic Blender builder, parameters and actual-geometry audits. Withhold from independent authors.
- `crane-courtyard.blend`: real editable baseline scene.
- `crane-courtyard.glb`: real exported geometry/material/camera/punctual-light asset.
- `reference-front-quarter.png`, `reference-rear-quarter.png`, `reference-high-oblique.png`: fixed baseline views.
- `scene-manifest.json`: axes, dimensions, parameters, seven edits, palette, light/camera pins, semantic mesh inventory and measured bounds.
- `author-brief.md`: shared reconstruction task and exact geometric/edit expectations.
- `baseline-audit.json`, `edit-audits.json`: mesh-derived verification results.
- `glb-import-audit.json`: successful real GLB re-import and world-bound comparison.
- `artifact-hashes.json`: primary deliverable hashes.
- `author-inputs.zip`: explicit equal-input author packet containing only the brief, numeric manifest and three PNGs.

## Verification

All 275 checks across baseline and the seven independent edited scenes passed. Checks read actual mesh vertices, face-centroid endpoints, bounds, BVH ray intersections and manifold topology; they do not merely echo parameter values. They verify:

- Boom lengths, actual shoulder/relative-elbow angles and joint coincidence.
- Cylinder attachment points, common axis, body length and rod overlap.
- World-vertical hoist; connected hook, four slings and load.
- Symmetric arched-opening width/apex and a clear ray through the full wall thickness.
- Constant hollow-pipe cross-section/wall thickness, centreline/end relations and clear inlet/outlet bore rays.
- Closed two-manifold mesh edges, positive signed volumes and nondegenerate faces.
- Unchanged geometry outside each edit; exact tier-follow and whole-assembly rigid transforms.
- Every mesh vertex fits all three fixed cameras with at least a 2.5% border, for baseline and every edited case.

The GLB re-import contained all 78 expected meshes, no extras, and zero measured per-mesh world-bound discrepancy from the Blender baseline. A repeated rebuild preserved the identical semantic part inventory, triangle counts, bounds and baseline numeric measurements. This is evidence of deterministic geometric construction under the installed toolchain, not a promise of byte-identical Blender files or cross-machine render pixels.

The three final views were visually inspected. The front-quarter exposes the connected hydraulic mechanism and suspended load; the rear-quarter shows the reverse wall face and open pipe inlet; the high-oblique reveals the pipe outlet, tiers and sling arrangement. The reference is deliberately modest. Subtle residual Monte Carlo grain remains because this Blender build lacks a CPU denoiser.

## Attempts and lifecycle

Four of eight permitted Blender background invocations were used, all through the reviewed `tools/recovery/cleanup.py run` lifecycle. All four lifecycles reached completed state, with no active descendant work remaining. No browser, installation, remote write or descendant agent was used. No cleanup/retirement of earlier disposable runs was performed.

1. `build-01.log`: first build/export succeeded, render failed because this installed Blender has no OpenImageDenoise. Initial geometry audit also detected three inward-oriented mesh volumes. Initial builder, assets, manifests and audit are retained in `attempt-01/`.
2. `build-02.log`: recalculated consistent outward mesh normals and disabled unavailable denoising. All three 64-sample views and the original geometric audits passed. The first useful image was reported promptly. The earlier builder, images and audits are retained in `attempt-02/`.
3. `build-03.log`: added mesh-derived angle/hook/sling/outlet checks and increased final samples to 256. Final 275 checks and all renders passed.
4. `glb-import-04.log`: real Blender GLB re-import passed with exact measured world bounds for all meshes.

`lifecycle-summary.json` and `lifecycle-audits/` preserve run completion evidence. The accidental one-file Python compile cache from the initial syntax check was moved into invocation 2's owned disposable run and explicitly registered as a regenerable build intermediate. Retained source, reference assets, images and unique evidence remain outside disposable storage.

## Reproduction

From the repository root, use the existing marked lifecycle root and keep retained output in this directory:

```sh
python3 -B tools/recovery/cleanup.py \
  --root /workspace/scratch/0190a8c72f8a/aperture-tmp \
  --audit-dir "$PWD/benchmarks/crane-reference-20261003/lifecycle-audits" \
  run --job crane-reference-rebuild \
  --recreation 'Run the retained procedural reference builder with installed Blender CPU.' \
  -- blender -b -t 8 --python-exit-code 1 \
  --python benchmarks/crane-reference-20261003/build-reference.py -- --mode full
```

A future run still requires an appropriate fresh bounded permit. The builder refuses missing lifecycle ownership or less than 2 GiB available space. `--mode audit` rebuilds and audits all parameter cases without rendering; `--mode import-check` validates the already-exported GLB.

## Limitations and next case

This reference is a kinematic authoring probe, not a physical simulation or formal scored benchmark. No collision solver, load rating, mechanical stress, deformation rig or physically guaranteed cylinder travel is claimed. Core glTF does not reproduce the Blender world, area fill or AgX appearance fully; the PNGs and explicit lighting metadata remain the visual references. All results here are local until independently published.

Next: freeze `author-inputs.zip` identically for separate native Aperture and control-engine authors. Withhold the builder and reference scene assets. Ask each author for the three baseline views and seven front-quarter edit renders plus actual-geometry checks. Retain genuine attempts, render/runtime evidence and limitations. Compare geometry, shadows/lighting, camera views, articulation, procedural changes and authoring ergonomics qualitatively, then turn demonstrated gaps into compatible fixes before increasing complexity again. No additional engine run or scoring was performed by this reference task.
