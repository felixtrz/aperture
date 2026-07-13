// Shared scene for the point-cloud example (E1): a point-cloud viewer drawn
// with the point subsystem (PointsMaterial-style). Points are camera-facing
// quads sized in world units with PERSPECTIVE size attenuation, so nearer
// points render larger than far ones. Two white probe points sit on the
// horizontal centerline — a NEAR probe (left, large) and a FAR probe (right,
// small) — and the e2e asserts the near probe covers more pixels than the far
// one (attenuation). A colorful decorative cloud along the top shows per-point
// color.

export const clearColor = [0.02, 0.03, 0.06, 1];
export const pointCloudCanvasSize = { width: 360, height: 240 };

export const FRAMES = 2;

export const probeSize = 0.6;
export const decorSize = 0.5;

// Probe cloud: two white points on the centerline (worldY = 0 -> screen y 0.5).
// Near probe close to the camera (large), far probe distant (small).
export const probePositions = [-0.5, 0.0, 3.0, 0.5, 0.0, -9.0];

// Decorative cloud along the top (worldY = 0.8) with per-point rainbow colors.
export const decorPositions = [
  -0.8, 0.8, 0.0, -0.4, 0.8, 0.0, 0.0, 0.8, 0.0, 0.4, 0.8, 0.0, 0.8, 0.8, 0.0,
];
export const decorColors = [
  1.0, 0.2, 0.2, 1, 1.0, 0.7, 0.1, 1, 0.3, 1.0, 0.3, 1, 0.2, 0.6, 1.0, 1, 0.8,
  0.3, 1.0, 1,
];

// Normalized canvas coordinates the e2e uses.
export const pointCloudSamplePoints = {
  // Row through both probe points (worldY = 0 -> screen center).
  probeRowY: 0.5,
  // The near probe sits left of center, the far probe right of center.
  nearProbeX: 0.4,
  farProbeX: 0.52,
  // Background control (bottom-left corner).
  backgroundX: 0.06,
  backgroundY: 0.94,
};

export function spawnPointCloudScene(aperture, app, canvasSize) {
  const aspect = canvasSize.width / Math.max(1, canvasSize.height);

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 6] }),
    aperture.withCamera({
      projection: "perspective",
      fovYRadians: Math.PI / 3,
      aspect,
      near: 0.1,
      far: 100,
      layerMask: 1,
      clearColor,
    }),
  );

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 0] }),
    aperture.withPoints({
      positions: probePositions,
      color: [1, 1, 1, 1],
      size: probeSize,
      sizeAttenuation: true,
      shape: "round",
    }),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 0] }),
    aperture.withPoints({
      positions: decorPositions,
      colors: decorColors,
      size: decorSize,
      sizeAttenuation: true,
      shape: "round",
    }),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
}
