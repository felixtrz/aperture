import { readApertureDevSession, type ApertureDevSession } from "../session.js";
import { connectToManagedPage, type BrowserConnection } from "./browser.js";
import { callBrowserBackedTool, sessionSummary } from "./dispatch.js";
import { callReferenceTool } from "./reference.js";
import type { ApertureToolCallOptions } from "./types.js";

let cachedBrowserConnection: {
  readonly key: string;
  readonly connection: BrowserConnection;
} | null = null;

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

  const connection = await managedBrowserConnection(session).catch(() => null);

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

  // Do not call Browser.close() here. For Playwright CDP connections to the
  // managed Chrome instance, explicit close propagates as a remote browser
  // shutdown and tears down the active Aperture dev session. One-shot CLI tool
  // commands exit after printing, and MCP servers intentionally keep the
  // connection alive for their process lifetime.
  try {
    return await callBrowserBackedTool(
      connection.page,
      session,
      options.name,
      args,
    );
  } catch (error: unknown) {
    if (!isClosedTargetError(error)) {
      throw error;
    }

    clearCachedBrowserConnection(session);
    const retryConnection = await managedBrowserConnection(session).catch(
      () => null,
    );
    if (retryConnection === null) {
      throw error;
    }

    return await callBrowserBackedTool(
      retryConnection.page,
      session,
      options.name,
      args,
    );
  }
}

function managedBrowserConnection(
  session: ApertureDevSession,
): Promise<BrowserConnection> {
  const key = browserConnectionKey(session);
  if (cachedBrowserConnection?.key === key) {
    return Promise.resolve(cachedBrowserConnection.connection);
  }

  return connectToManagedPage(session).then((connection) => {
    cachedBrowserConnection = { key, connection };
    return connection;
  });
}

function clearCachedBrowserConnection(session: ApertureDevSession): void {
  if (cachedBrowserConnection?.key === browserConnectionKey(session)) {
    cachedBrowserConnection = null;
  }
}

function browserConnectionKey(session: ApertureDevSession): string {
  return [
    session.appRoot,
    session.url,
    session.startedAt,
    session.browser.cdpUrl ?? "",
  ].join("\n");
}

function isClosedTargetError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("Target page, context or browser has been closed") ||
    message.includes("Target closed") ||
    message.includes("has been closed")
  );
}
