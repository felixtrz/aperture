import { defineConfig } from "vite";
import { aperture } from "@aperture-engine/app/vite";

export default defineConfig({
  plugins: [aperture()],
});
