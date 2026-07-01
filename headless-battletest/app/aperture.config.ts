import { createStarfallConfig } from "./aperture.shared-config.ts";

export default createStarfallConfig({
  mode: "browser",
  baseUrl: import.meta.env.BASE_URL,
  canvas: "#aperture",
});
