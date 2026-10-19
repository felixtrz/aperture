---
"@aperture-engine/app": minor
"@aperture-engine/cli": minor
---

Add CameraHandle.inspectLocal and camera_inspect_local for projecting caller-owned local points, target residuals, ordered face-facing evidence, and static descendant mesh bounds through freshly resolved ECS transforms without stepping simulation. Share the operation across system, worker, and headless routes. Optionally export a seed for the existing camera project/fit workflow using an explicit reference distance, with diagnostics for unsupported camera models and numerical projection mismatches.
