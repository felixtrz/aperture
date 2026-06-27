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
  readonly status?: { nextFrame?: number };
}

async function runServe(lines: string[]): Promise<ServeResponse[]> {
  const chunks: string[] = [];
  await runHeadlessServeCommand({
    argv: [CONFIG, "--seed", "5"],
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

  it("gates GPU/browser-only tools with aperture.headless.toolUnavailable", async () => {
    const responses = await runServe([
      '{"id":1,"cmd":"tool","params":{"name":"camera_get"}}',
      '{"id":2,"cmd":"shutdown"}',
    ]);

    const camera = responses.find((r) => r.id === 1);
    expect(camera?.ok).toBe(false);
    expect(camera?.diagnostics?.[0]?.code).toBe(
      "aperture.headless.toolUnavailable",
    );
  });

  it("reports an unknown command", async () => {
    const responses = await runServe([
      '{"id":1,"cmd":"frobnicate"}',
      '{"id":2,"cmd":"shutdown"}',
    ]);
    expect(responses.find((r) => r.id === 1)?.ok).toBe(false);
  });
});
