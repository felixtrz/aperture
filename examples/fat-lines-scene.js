// Shared scene for the fat-lines example (E1): a debug-path visualization drawn
// with the screen-space-width line subsystem (Line2-style). Each polyline
// segment expands to a screen-space-width quad with round caps/joins, so the
// lines are far thicker than a 1px GPU line and stay a constant pixel width
// regardless of camera distance. One SOLID cyan "staple" path proves the
// screen-space width band; one DASHED amber line proves world-continuous dashes
// (a gap shows the background between dashes).

export const clearColor = [0.02, 0.03, 0.05, 1];
export const fatLinesCanvasSize = { width: 360, height: 240 };

export const FRAMES = 2;

// Bright cyan (low red) so a line pixel is trivially distinguishable from the
// dark background; amber (high red + green, low blue) for the dashed line.
export const cyanColor = [0.1, 0.85, 1.0, 1];
export const amberColor = [1.0, 0.62, 0.1, 1];

export const cyanWidthPx = 16;
export const amberWidthPx = 10;
export const amberDashSize = 0.16;
export const amberGapSize = 0.16;

// A cyan "staple" path: up the left, across the top, down the right. The top
// horizontal run (y = 0.35, x in [-1, 1]) is the band the e2e scans for width.
export const cyanPath = [
  -1.0, -0.1, 0.0, -1.0, 0.35, 0.0, 1.0, 0.35, 0.0, 1.0, -0.1, 0.0,
];
// A dashed amber line low in the frame.
export const amberPath = [-1.1, -0.4, 0.0, 1.1, -0.4, 0.0];

// Normalized canvas coordinates the e2e uses.
export const fatLinesSamplePoints = {
  // Column to scan for the cyan width band (worldX = 0 -> center).
  cyanColumnX: 0.5,
  // A point on the cyan top run (worldY 0.35 -> screen ~0.325 from top).
  cyanY: 0.325,
  // Row through the dashed amber line (worldY -0.4 -> screen ~0.7 from top).
  amberRowY: 0.7,
  // Background control between the two lines.
  backgroundX: 0.5,
  backgroundY: 0.5,
};

export function spawnFatLinesScene(aperture, app, canvasSize) {
  const aspect = canvasSize.width / Math.max(1, canvasSize.height);

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 5] }),
    aperture.withCamera({
      projection: "orthographic",
      orthographicHeight: 2,
      aspect,
      near: 0.1,
      far: 20,
      layerMask: 1,
      clearColor,
    }),
  );

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 0] }),
    aperture.withLine({
      positions: cyanPath,
      color: cyanColor,
      width: cyanWidthPx,
    }),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );

  app.spawn(
    aperture.withTransform({ translation: [0, 0, 0] }),
    aperture.withLine({
      positions: amberPath,
      color: amberColor,
      width: amberWidthPx,
      dashSize: amberDashSize,
      gapSize: amberGapSize,
    }),
    aperture.withRenderLayer(1),
    aperture.withVisibility(true),
  );
}
