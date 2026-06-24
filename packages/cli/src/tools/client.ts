import { readApertureDevSession, type ApertureDevSession } from "../session.js";
import {
  closeBrowserConnection,
  connectToManagedPage,
  type BrowserConnection,
} from "./browser.js";
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

  const keepBrowserConnection = options.keepBrowserConnection === true;

  try {
    const result = await callBrowserBackedTool(
      connection.page,
      session,
      options.name,
      args,
    );

    if (!keepBrowserConnection) {
      await closeAndClearBrowserConnection(session, connection);
    }

    return result;
  } catch (error: unknown) {
    if (!keepBrowserConnection) {
      await closeAndClearBrowserConnection(session, connection);
    }

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

    try {
      const result = await callBrowserBackedTool(
        retryConnection.page,
        session,
        options.name,
        args,
      );

      if (!keepBrowserConnection) {
        await closeAndClearBrowserConnection(session, retryConnection);
      }

      return result;
    } catch (retryError: unknown) {
      if (!keepBrowserConnection) {
        await closeAndClearBrowserConnection(session, retryConnection);
      }

      throw retryError;
    }
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

async function closeAndClearBrowserConnection(
  session: ApertureDevSession,
  connection: BrowserConnection,
): Promise<void> {
  clearCachedBrowserConnection(session);
  await closeBrowserConnection(connection);
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
