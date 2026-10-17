# vGPU author journal

Started at time recorded in startAt.txt. Read protocol, repository browser/visual guidance, inspected reference. vGPU 0.6.0 native scene API has CPU transforms/cameras/primitives, but no material, light, shadow or renderer system. Chosen approach: authored mesh buffer, vGPU draw/frame/surface, own directional shadow pass and WGSL material. No Three.js bridge.

03:22 UTC, draft-01: build failed before browser launch because `patch` is WGSL reserved. Build-time shader diagnostics identified the exact token and suggested renaming. Renamed local to waterTint.

03:22:54 UTC, draft-02: first verified complete render. All main forms visible. Inspected screenshot. Visible normal winding on custom rocks/roof gave dark shading; switched to camera-facing two-sided surface normals. Refined camera toward more frontal elevated reference angle, lightened slate/pine material, added bank planting and a planar-reflection pass sampled with slight water distortion.

03:25:28 UTC, refined-03: verified, including planar reflections. Queue wait 72.4 s overlapped visual planning/API reading. Inspected screenshot: lighting improved, but the camera exposes the wrong base corner and the pavilion reads too central. Repositioned pavilion to left edge, rotated its entrance toward pond, moved left pine, reshaped pond around plinth, added genuinely pierced scholar rocks, and used the reference's more oblique camera. This is authoring/composition iteration rather than framework failure.

03:30:38 UTC, lighting-05: verified, zero GPU/page errors. Inspected screenshot. Custom SSAO initially darkened all surfaces: source inspection confirmed that vGPU MSAA depth attachments have depthStoreOp="discard". They can be bound but do not retain useful depth after the pass. Workaround: retain depth in alpha of a resolved rgba16float normal MRT, then sample that in the contact-occlusion effect. This keeps 4x MSAA. Moved the tiny maple that was inadvertently inside the relocated pavilion. Final capture requested as final-06.
