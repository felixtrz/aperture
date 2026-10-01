import { readApertureDevSession, type ApertureDevSession } from "../session.js";
import {
  closeBrowserConnection,
  connectToManagedPage,
  type BrowserConnection,
} from "./browser.js";
import { callBrowserBackedTool, sessionSummary } from "./dispatch.js";
import { callReferenceTool } from "./reference.js";
import type { ApertureToolCallOptions } from "./types.js";

/** A connection cache scoped to one MCP client, or the one-shot CLI facade. */
export class ApertureToolClient {
  #cachedBrowserConnection: {
    readonly key: string;
    readonly connection: BrowserConnection;
  } | null = null;

  async call(options: ApertureToolCallOptions): Promise<unknown> {
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

    const connection = await this.#managedBrowserConnection(session).catch(
      () => null,
    );

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
        await this.#closeAndClearBrowserConnection(session, connection);
      }

      return result;
    } catch (error: unknown) {
      if (!keepBrowserConnection) {
        await this.#closeAndClearBrowserConnection(session, connection);
      }

      if (!isClosedTargetError(error)) {
        throw error;
      }

      if (keepBrowserConnection) {
        await this.#closeAndClearBrowserConnection(session, connection);
      }
      const retryConnection = await this.#managedBrowserConnection(
        session,
      ).catch(() => null);
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
          await this.#closeAndClearBrowserConnection(session, retryConnection);
        }

        return result;
      } catch (retryError: unknown) {
        if (!keepBrowserConnection) {
          await this.#closeAndClearBrowserConnection(session, retryConnection);
        }

        throw retryError;
      }
    }
  }

  async #managedBrowserConnection(
    session: ApertureDevSession,
  ): Promise<BrowserConnection> {
    const key = browserConnectionKey(session);
    if (this.#cachedBrowserConnection?.key === key) {
      return Promise.resolve(this.#cachedBrowserConnection.connection);
    }

    await this.dispose();
    return connectToManagedPage(session).then((connection) => {
      this.#cachedBrowserConnection = { key, connection };
      return connection;
    });
  }

  #clearCachedBrowserConnection(session: ApertureDevSession): void {
    if (this.#cachedBrowserConnection?.key === browserConnectionKey(session)) {
      this.#cachedBrowserConnection = null;
    }
  }

  async #closeAndClearBrowserConnection(
    session: ApertureDevSession,
    connection: BrowserConnection,
  ): Promise<void> {
    this.#clearCachedBrowserConnection(session);
    await closeBrowserConnection(connection);
  }

  async dispose(): Promise<void> {
    const cached = this.#cachedBrowserConnection;
    this.#cachedBrowserConnection = null;
    if (cached !== null) {
      await closeBrowserConnection(cached.connection);
    }
  }
}

const defaultClient = new ApertureToolClient();

export function callApertureTool(
  options: ApertureToolCallOptions,
): Promise<unknown> {
  return defaultClient.call(options);
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
