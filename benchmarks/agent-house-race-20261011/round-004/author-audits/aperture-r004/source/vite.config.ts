import { defineConfig } from "vite";
import { aperture } from "@aperture-engine/vite-plugin";
export default defineConfig({ plugins: [aperture({ai:{mode:"off"}})], build:{ target:"esnext" } });
