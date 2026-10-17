# vGPU author journal

Started at time recorded in startAt.txt. Read protocol, repository browser/visual guidance, inspected reference. vGPU 0.6.0 native scene API has CPU transforms/cameras/primitives, but no material, light, shadow or renderer system. Chosen approach: authored mesh buffer, vGPU draw/frame/surface, own directional shadow pass and WGSL material. No Three.js bridge.
