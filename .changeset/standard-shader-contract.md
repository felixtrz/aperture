---
"@aperture-engine/webgpu": patch
---

Fix StandardMaterial clearcoat, sheen and iridescence argument composition across
spot and clustered light routes, including combined lobes. Report the existing
area-light LTC textures and sampler in shader binding metadata so derived shader
inspection matches the actual WGSL resource contract.

Pass the computed fragment material context, including texture samples, through
typed clustered-light helper parameters so those lobe values remain in scope.

Forward the computed fragment normal to combined directional/point shadow
receivers and compose only their emitted directional and point helpers. The
ordinary multi-shadow route retains its directional, spot and point contract.
