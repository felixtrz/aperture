import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import { aperture } from "@aperture-engine/vite-plugin";

const siteBase = process.env.APERTURE_DOCS_BASE ?? "/";

export default defineConfig({
  base: siteBase,
  devToolbar: {
    enabled: false,
  },
  integrations: [react()],
  output: "static",
  vite: {
    worker: {
      format: "es",
    },
    plugins: [
      aperture({
        ai: {
          mode: "agent",
        },
      }),
    ],
  },
});
