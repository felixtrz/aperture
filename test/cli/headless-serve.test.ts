import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runHeadlessServeCommand } from "@aperture-engine/cli";

const CONFIG = fileURLToPath(
  new URL(
    "../fixtures/headless-procedural/aperture.headless.config.ts",
    import.meta.url,
  ),
);

interface ServeResponse {
  readonly ready?: boolean;
  readonly id?: number;
  readonly ok?: boolean;
  readonly result?: Record<string, unknown>;
  readonly diagnostics?: ReadonlyArray<{ code?: string }>;
  readonly status?: {
    readonly nextFrame?: number;
    readonly assetMode?: string;
    readonly allowHttpAssets?: boolean;
    readonly determinism?: string;
  };
}

async function runServe(
  lines: string[],
  argv: readonly string[] = [CONFIG, "--seed", "5"],
): Promise<ServeResponse[]> {
  const chunks: string[] = [];
  await runHeadlessServeCommand({
    argv,
    cwd: process.cwd(),
    stdout: (text) => {
      chunks.push(text);
    },
    stdin: Readable.from(lines.map((line) => `${line}\n`)),
  });
  return chunks
    .join("")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as ServeResponse);
}

describe("aperture headless serve (PC.2/PC.5)", () => {
  it("boots once, emits ready, and answers ordered id-correlated commands", async () => {
    const responses = await runServe([
      '{"id":1,"cmd":"get-status"}',
      '{"id":2,"cmd":"step","params":{"delta":0.016}}',
      '{"id":3,"cmd":"step","params":{"delta":0.016}}',
      '{"id":4,"cmd":"shutdown"}',
    ]);

    expect(responses[0]?.ready).toBe(true);
    // Hybrid is the default asset mode (#66), matching the one-shot command.
    expect(responses[0]?.status?.assetMode).toBe("hybrid");
    expect(responses[0]?.status?.allowHttpAssets).toBe(false);
    expect(responses.slice(1).map((r) => r.id)).toEqual([1, 2, 3, 4]);
    expect(responses[2]?.result?.["nextFrame"]).toBe(1);
    expect(responses[3]?.result?.["nextFrame"]).toBe(2);
  });

  it("resets to a fresh world without restarting the process", async () => {
    const responses = await runServe([
      '{"id":1,"cmd":"step","params":{"delta":0.016}}',
      '{"id":2,"cmd":"step","params":{"delta":0.016}}',
      '{"id":3,"cmd":"reset"}',
      '{"id":4,"cmd":"get-status"}',
      '{"id":5,"cmd":"shutdown"}',
    ]);

    const reset = responses.find((r) => r.id === 3);
    expect(reset?.ok).toBe(true);
    const status = responses.find((r) => r.id === 4);
    expect(status?.result?.["nextFrame"]).toBe(0);
  });
});

describe("aperture headless serve — tool routing (PC.3/PC.4)", () => {
  it("routes ecs_* tools through the in-process bridge", async () => {
    const responses = await runServe([
      '{"id":1,"cmd":"tool","params":{"name":"ecs_diff","arguments":{"label":"x"}}}',
      '{"id":2,"cmd":"tool","params":{"name":"ecs_snapshot","arguments":{"label":"a"}}}',
      '{"id":3,"cmd":"step","params":{"delta":0.016}}',
      '{"id":4,"cmd":"tool","params":{"name":"ecs_diff","arguments":{"label":"b"}}}',
      '{"id":5,"cmd":"shutdown"}',
    ]);

    // ecs_diff before any snapshot fails with a structured diagnostic.
    expect(responses.find((r) => r.id === 1)?.ok).toBe(false);
    // snapshot then diff succeeds.
    expect(responses.find((r) => r.id === 2)?.ok).toBe(true);
    expect(responses.find((r) => r.id === 4)?.ok).toBe(true);
  });

  it("routes camera tools through the same warm headless session", async () => {
    const responses = await runServe([
      '{"id":1,"cmd":"tool","params":{"name":"camera_get","arguments":{"key":"camera.main"}}}',
      '{"id":2,"cmd":"tool","params":{"name":"camera_create_agent","arguments":{"key":"camera.agent","translation":[0,2,4],"lookAt":[0,0,0]}}}',
      '{"id":3,"cmd":"tool","params":{"name":"camera_get","arguments":{"key":"camera.agent"}}}',
      '{"id":4,"cmd":"shutdown"}',
    ]);

    expect(responses.find((r) => r.id === 1)?.ok).toBe(true);
    expect(responses.find((r) => r.id === 1)?.result?.["key"]).toBe(
      "camera.main",
    );
    expect(responses.find((r) => r.id === 2)?.ok).toBe(true);
    expect(responses.find((r) => r.id === 3)?.result?.["key"]).toBe(
      "camera.agent",
    );
  });

  it("reports an unknown command", async () => {
    const responses = await runServe([
      '{"id":1,"cmd":"frobnicate"}',
      '{"id":2,"cmd":"shutdown"}',
    ]);
    expect(responses.find((r) => r.id === 1)?.ok).toBe(false);
  });

  it("accepts an explicit asset mode", async () => {
    const responses = await runServe(
      ['{"id":1,"cmd":"shutdown"}'],
      [
        CONFIG,
        "--seed",
        "5",
        "--asset-mode",
        "strict",
        "--allow-http-assets",
        "--determinism",
        "warn",
      ],
    );

    expect(responses[0]?.status?.assetMode).toBe("strict");
    expect(responses[0]?.status?.allowHttpAssets).toBe(true);
    expect(responses[0]?.status?.determinism).toBe("warn");
  });

  it("returns deterministic digests when requested", async () => {
    const responses = await runServe([
      '{"id":1,"cmd":"step","params":{"delta":0.016,"digest":true}}',
      '{"id":2,"cmd":"get-status","params":{"digest":true}}',
      '{"id":3,"cmd":"shutdown"}',
    ]);

    const step = responses.find((r) => r.id === 1)?.result as
      | {
          readonly digests?: {
            readonly ecs?: { readonly hash?: string };
            readonly snapshot?: { readonly hash?: string };
          };
        }
      | undefined;
    const status = responses.find((r) => r.id === 2)?.result as
      | {
          readonly digests?: {
            readonly ecs?: { readonly hash?: string };
            readonly status?: { readonly hash?: string };
          };
        }
      | undefined;

    expect(step?.digests?.ecs?.hash).toMatch(/^[0-9a-f]{8}$/u);
    expect(step?.digests?.snapshot?.hash).toMatch(/^[0-9a-f]{8}$/u);
    expect(status?.digests?.ecs?.hash).toBe(step?.digests?.ecs?.hash);
    expect(status?.digests?.status?.hash).toMatch(/^[0-9a-f]{8}$/u);
  });
});
