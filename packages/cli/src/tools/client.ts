import { readApertureDevSession } from "../session.js";
import { connectToManagedPage } from "./browser.js";
import { callBrowserBackedTool, sessionSummary } from "./dispatch.js";
import { callReferenceTool } from "./reference.js";
import type { ApertureToolCallOptions } from "./types.js";

export async function callApertureTool(
  options: ApertureToolCallOptions,
): Promise<unknown> {
  const args = options.arguments ?? {};

  if (options.name.startsWith("reference_")) {
    return callReferenceTool(options.cwd, options.name, args);
  }

  const session = await readApertureDevSession(options.cwd);

  if (session === null) {
    return {
      ok: false,
      diagnostic: {
        code: "aperture.mcp.sessionMissing",
        message:
          "No Aperture dev session exists. Run 'aperture dev up' before using browser, ECS, input, camera, or render tools.",
      },
    };
  }

  if (session.browser.cdpUrl === null) {
    return {
      ok: false,
      diagnostic: {
        code: "aperture.mcp.browserUnavailable",
        message:
          "The active Aperture dev session does not expose a browser debugging endpoint.",
      },
      session,
    };
  }

  const connection = await connectToManagedPage(session).catch(() => null);

  if (connection === null) {
    return {
      ok: false,
      diagnostic: {
        code: "aperture.mcp.browserConnectFailed",
        message:
          "The active Aperture dev session browser could not be reached over CDP.",
        suggestedFix:
          "Run 'aperture dev status', then restart the managed session with 'aperture dev down' and 'aperture dev up'.",
      },
      session: sessionSummary(session),
    };
  }

  try {
    return await callBrowserBackedTool(
      connection.page,
      session,
      options.name,
      args,
    );
  } finally {
    await connection.browser.close();
  }
}
