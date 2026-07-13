// Shared constants for the debug-draw example (E3): an immediate-mode debug
// overlay. This module holds only plain data shared by BOTH the main thread and
// the worker, so it stays importable under the main-thread import map (the
// system class + physics helper live in the worker, which resolves the app and
// physics packages through the worker-module loader).
//
// A single system (see the worker) draws — every frame, from its update() — an
// AABB, a wireframe sphere, a coordinate frame (axes), a ground grid, and a
// physics collider wireframe (real physics debug geometry routed through the
// SAME overlay via `this.debugDraw.physics`). Each primitive tessellates into
// world-space line segments rendered through the shared E1 fat-line pipeline as
// an overlay. When debug draw is disabled (config.debugDraw: false),
// `this.debugDraw.*` is a no-op: no overlay, no report, byte-identical to a
// frame without debug draw.

export const clearColor = [0.02, 0.03, 0.05, 1];
export const debugDrawCanvasSize = { width: 360, height: 240 };
export const FRAMES = 2;

// Distinct, background-separable overlay colors (dark background is near-black).
export const cyanColor = [0.1, 0.9, 1.0, 1]; // AABB
export const magentaColor = [1.0, 0.15, 0.9, 1]; // sphere
export const orangeColor = [1.0, 0.55, 0.1, 1]; // physics collider wireframe
export const greyColor = [0.45, 0.5, 0.55, 1]; // grid

export const lineWidthPx = 4;
export const sphereSegments = 16;
export const gridDivisions = 6;

// Deterministic per-primitive segment counts the e2e/report assertions pin.
export const EXPECTED = Object.freeze({
  axes: 3,
  aabb: 12,
  sphere: 3 * sphereSegments, // 48
  grid: 2 * (gridDivisions + 1), // 14
  physics: 12, // one collider AABB = 12 edges
  get primitives() {
    return 5;
  },
  get segments() {
    return this.axes + this.aabb + this.sphere + this.grid + this.physics; // 89
  },
});

// Normalized canvas coordinates the e2e samples.
export const debugDrawSamplePoints = {
  // A background control above every primitive (the AABB/sphere tops sit near
  // screen y ~0.26; the edge-on grid line is at y ~0.5).
  backgroundX: 0.5,
  backgroundY: 0.08,
};
