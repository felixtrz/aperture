import { textTemplateFile } from "./files.js";
import type { TemplateFile } from "../types.js";

export function sharedTemplateFiles(): readonly TemplateFile[] {
  return [
    textTemplateFile("index.html", indexHtml()),
    textTemplateFile("tsconfig.json", tsconfigJson()),
    textTemplateFile("vite.config.ts", viteConfigTs()),
  ];
}

function indexHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <!-- Empty inline icon so the browser doesn't log a 404 for /favicon.ico. -->
    <link rel="icon" href="data:," />
    <title>Aperture App</title>
    <style>
      html,
      body {
        margin: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: #0c0f14;
      }

      #aperture {
        display: block;
        width: 100vw;
        height: 100vh;
      }
    </style>
  </head>
  <body>
    <canvas id="aperture"></canvas>
  </body>
</html>
`;
}

function tsconfigJson(): string {
  return `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "types": ["vite/client"]
  },
  "include": ["aperture.config.ts", "vite.config.ts", "src/**/*.ts", ".aperture/generated/**/*.d.ts"]
}
`;
}

function viteConfigTs(): string {
  return `import { defineConfig } from "vite";
import { aperture } from "@aperture-engine/vite-plugin";

export default defineConfig({
  plugins: [
    aperture({
      ai: {
        mode: "agent",
      },
    }),
  ],
});
`;
}
