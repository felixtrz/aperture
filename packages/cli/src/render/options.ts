import { ApertureCliError } from "../errors.js";
import type { ApertureRenderSessionOptions } from "./types.js";

export function parseRenderBackendOptions(argv: readonly string[]): {
  readonly argv: readonly string[];
  readonly renderer: ApertureRenderSessionOptions;
} {
  const remaining: string[] = [];
  const renderer: {
    backend?: "dawn" | "browser";
    adapter?: "auto" | "hardware" | "software";
  } = {};
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]!;
    if (arg === "--backend") {
      const value = argv[++index];
      if (value !== "dawn" && value !== "browser")
        throw new ApertureCliError(
          "aperture.render.invalidBackend",
          "--backend requires dawn or browser.",
        );
      renderer.backend = value;
    } else if (arg === "--adapter") {
      const value = argv[++index];
      if (value !== "auto" && value !== "hardware" && value !== "software")
        throw new ApertureCliError(
          "aperture.render.invalidAdapter",
          "--adapter requires auto, hardware, or software.",
        );
      renderer.adapter = value;
    } else remaining.push(arg);
  }
  return { argv: remaining, renderer };
}
