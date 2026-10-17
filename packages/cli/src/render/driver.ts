import { ApertureCliError } from "../errors.js";
import {
  decodeShaderJob,
  isShaderJob,
  shaderJobRequiredFeatures,
} from "@aperture-engine/shader";
import type {
  ApertureRenderSession,
  ApertureRenderSessionOptions,
  ApertureRenderSessionRenderOptions,
  RenderBundleResult,
} from "./types.js";
export type * from "./types.js";
export { renderHarnessHtml } from "./harness.js";
export {
  renderBundleFeedbackMetadata,
  readRenderBundleDigestMetadata,
  normalizeRenderBundleWebGpuMetadata,
} from "./metadata.js";

/** Backend dispatch stays safe to import from CPU-only headless tooling. */
export async function createApertureRenderSession(
  options: ApertureRenderSessionOptions = {},
): Promise<ApertureRenderSession> {
  const backend =
    options.backend ?? process.env["APERTURE_RENDER_BACKEND"] ?? "dawn";
  if (backend === "dawn") {
    const { createDawnRenderSession } = await import("./dawn-driver.js");
    return createDawnRenderSession(options);
  }
  if (backend !== "browser")
    throw new ApertureCliError(
      "aperture.render.invalidBackend",
      `Unknown renderer '${backend}'; use dawn or browser.`,
    );
  if (options.adapter !== undefined)
    throw new ApertureCliError(
      "aperture.render.invalidAdapter",
      "--adapter selects a Dawn adapter; select --backend dawn.",
    );
  const { createBrowserRenderSession } = await import("./browser-driver.js");
  return createBrowserRenderSession(options);
}

export async function renderBundleToPng(
  options: ApertureRenderSessionRenderOptions & ApertureRenderSessionOptions,
): Promise<RenderBundleResult> {
  const required = isShaderJob(options.bundle)
    ? shaderJobRequiredFeatures(decodeShaderJob(options.bundle))
    : [];
  const session = await createApertureRenderSession({
    ...options,
    ...(required.length === 0
      ? {}
      : {
          native: {
            ...options.native,
            requiredFeatures: [
              ...new Set([
                ...(options.native?.requiredFeatures ?? []),
                ...required,
              ]),
            ] as NonNullable<
              NonNullable<
                ApertureRenderSessionOptions["native"]
              >["requiredFeatures"]
            >,
          },
        }),
    displayWidth: options.width,
    displayHeight: options.height,
  });
  try {
    return await session.render(options);
  } finally {
    await session.dispose();
  }
}
