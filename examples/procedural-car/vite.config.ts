import { defineConfig } from "vite";
import { aperture } from "@aperture-engine/vite-plugin";
export default defineConfig({ base: "./", plugins: [aperture()] });
