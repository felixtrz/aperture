import { defineConfig } from "vite";
import { apertureShaders } from "@aperture-engine/vite-plugin";
export default defineConfig({ plugins: [apertureShaders()] });
