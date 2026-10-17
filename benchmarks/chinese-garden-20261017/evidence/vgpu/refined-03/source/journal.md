# vGPU author journal

Started at time recorded in startAt.txt. Read protocol, repository browser/visual guidance, inspected reference. vGPU 0.6.0 native scene API has CPU transforms/cameras/primitives, but no material, light, shadow or renderer system. Chosen approach: authored mesh buffer, vGPU draw/frame/surface, own directional shadow pass and WGSL material. No Three.js bridge.

03:22 UTC, draft-01: build failed before browser launch because `patch` is WGSL reserved. Build-time shader diagnostics identified the exact token and suggested renaming. Renamed local to waterTint.

03:22:54 UTC, draft-02: first verified complete render. All main forms visible. Inspected screenshot. Visible normal winding on custom rocks/roof gave dark shading; switched to camera-facing two-sided surface normals. Refined camera toward more frontal elevated reference angle, lightened slate/pine material, added bank planting and a planar-reflection pass sampled with slight water distortion.
