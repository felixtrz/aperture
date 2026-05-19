# GLTF Scene Vertical Slice Priority

Date: 2026-05-19

## Decision

The near-term backlog should optimize for a useful GLTF scene rendering path:
multiple primitive shapes, multiple built-in material families, transforms,
camera, direct lighting, IBL, and shadows in one browser-verifiable scene.

This should still use Aperture's full architecture:

1. GLTF/GLB-derived data maps into typed assets and ECS-authored entities.
2. Render extraction produces snapshots; the renderer does not query ECS.
3. Render-world preparation owns WebGPU resources.
4. Material-family queueing, sorting, and submission drive drawing.
5. Diagnostics stay JSON-safe and explain unsupported scene features honestly.

## What Moves Up

- A narrow glTF/GLB scene fixture and browser app.
- Multiple primitive shapes in the same scene.
- Different built-in material families in the same scene.
- StandardMaterial fidelity only where the scene needs it.
- IBL/environment resources for StandardMaterial.
- A first shadow-map path for scene lights.

## What Moves Down

- Public custom shader/material APIs.
- Shader graphs or node materials.
- App-owned custom adapter facades.
- Broad custom material rendering.
- Additional isolated status-assertion hardening unless it directly blocks the
  scene path.

## Architecture Guardrail

The priority shift does not authorize a shortcut scene graph, renderer-owned
game state, WebGL fallback, raw GPU handles in source assets, or direct GLTF
viewer code that bypasses ECS/extraction/render-world preparation. The GLTF
scene app is a product slice over the existing architecture, not a parallel
renderer.
