import type { AperturePage } from "./browser.js";
import { RUNTIME_GLOBAL, STATUS_GLOBAL } from "./types.js";

export async function callGeneratedRuntimeTool(
  page: AperturePage,
  tool: string,
  payload: Record<string, unknown>,
): Promise<unknown> {
  const response = await page.evaluate(
    async ({ runtimeGlobal, runtimeTool, runtimePayload }) => {
      const runtime = (globalThis as unknown as Record<string, unknown>)[
        runtimeGlobal
      ] as
        | {
            callTool(
              tool: string,
              payload?: unknown,
            ): Promise<{
              readonly ok: boolean;
              readonly result?: unknown;
              readonly diagnostics?: readonly unknown[];
            }>;
          }
        | undefined;

      if (runtime === undefined) {
        return {
          ok: false,
          diagnostics: [
            {
              code: "aperture.devtools.runtimeMissing",
              severity: "error",
              message:
                "The managed Aperture runtime bridge is not installed in this tab.",
            },
          ],
        };
      }

      return runtime.callTool(runtimeTool, runtimePayload);
    },
    {
      runtimeGlobal: RUNTIME_GLOBAL,
      runtimeTool: tool,
      runtimePayload: payload,
    },
  );

  return {
    ok: response.ok,
    result: response.result ?? null,
    diagnostics: response.diagnostics ?? [],
  };
}

export async function listGeneratedSystems(
  page: AperturePage,
): Promise<unknown> {
  const systems = await page.evaluate(
    ({ statusGlobal }) => {
      const status = (globalThis as unknown as Record<string, unknown>)[
        statusGlobal
      ] as {
        readonly systems?: unknown;
      } | null;

      return Array.isArray(status?.systems) ? status.systems : [];
    },
    { statusGlobal: STATUS_GLOBAL },
  );

  return { ok: true, systems };
}
