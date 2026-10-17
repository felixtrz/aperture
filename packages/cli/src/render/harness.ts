export const HARNESS_PREFIX = "/_harness/";

/**
 * Build the harness `index.html` with an import map generated from the resolved
 * engine packages. The import map must be inline in the served HTML — module
 * scripts resolve it at parse time, before any `addInitScript` can run.
 */
export function renderHarnessHtml(
  importMap: Readonly<Record<string, string>>,
  options: { readonly width: number; readonly height: number },
): string {
  const imports = JSON.stringify({ imports: importMap }, null, 2);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Aperture Snapshot Render Harness</title>
    <style>
      /* Pin the page to the canvas so the element screenshot never picks up
         default body margins or scrollbars (see finding F10). */
      html,
      body {
        margin: 0;
        padding: 0;
        overflow: hidden;
        background: #000;
      }
      #aperture-canvas {
        display: block;
      }
    </style>
    <script type="importmap">
${imports}
    </script>
    <script type="module" src="${HARNESS_PREFIX}render-harness.main.js"></script>
  </head>
  <body>
    <canvas id="aperture-canvas" width="${options.width}" height="${options.height}"></canvas>
  </body>
</html>
`;
}
