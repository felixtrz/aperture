import { expect, it } from "vitest";
import { HeadlessRealmTransport } from "../../packages/cli/src/headless/realm-client.js";
import { cloneRealmValue } from "../../packages/cli/src/headless/realm-protocol.js";
const limits = {
  requestTimeoutMs: 10_000,
  bootTimeoutMs: 10_000,
  disposeTimeoutMs: 10_000,
  maxPending: 2,
  maxQueuedBytes: 1024,
  maxReplyBytes: 4096,
};
function transport() {
  return new HeadlessRealmTransport({
    limits,
    log() {},
    workerEntry: new URL(
      "../fixtures/headless-realm/protocol-worker.mjs",
      import.meta.url,
    ),
  });
}
it("detaches allowed DTOs and rejects live functions, buffers, cycles and oversized payloads", () => {
  const value = { nested: { numbers: [1, 2] } };
  const copy = cloneRealmValue(value);
  copy.nested.numbers[0] = 99;
  expect(value.nested.numbers[0]).toBe(1);
  expect(() => cloneRealmValue({ fn() {} })).toThrow("JSON-safe");
  expect(() => cloneRealmValue(new Float32Array([1]))).toThrow("plain objects");
  expect(() => cloneRealmValue(Buffer.from([1]))).toThrow("plain objects");
  expect(() => cloneRealmValue(new Date())).toThrow("plain objects");
  const cyclic: { self?: unknown } = {};
  cyclic.self = cyclic;
  expect(() => cloneRealmValue(cyclic)).toThrow();
  expect(() => cloneRealmValue({ text: "large" }, 1)).toThrow("message budget");
});
it("ignores duplicate replies before they can poison metadata and observes actual exact-once exit", async () => {
  const realm = transport();
  expect(await realm.request("status", { kind: "duplicate" })).toMatchObject({
    last: 1,
  });
  expect(await realm.request("status", { kind: "normal" })).toMatchObject({
    last: 2,
  });
  expect(realm.metadata).toBeNull();
  const first = realm.retire();
  expect(realm.retire()).toBe(first);
  expect(await first).toMatchObject({
    graceful: true,
    exitObserved: true,
    forcedTermination: false,
    exitCode: 0,
  });
  await expect(realm.request("status", {})).rejects.toThrow("exited");
}, 30_000);
it("rejects all pending work on a mismatched response and verifies forced worker exit", async () => {
  const realm = transport();
  const first = realm.request("status", { kind: "hang" });
  const second = realm.request("status", { kind: "invalid" });
  expect(
    (await Promise.allSettled([first, second])).every(
      (entry) => entry.status === "rejected",
    ),
  ).toBe(true);
  expect(await realm.retire()).toMatchObject({
    graceful: false,
    forcedTermination: true,
    exitObserved: true,
  });
}, 30_000);
it("bounds pending work and retires after an actual missed-response deadline", async () => {
  const realm = transport();
  const first = realm.request("status", { kind: "hang" });
  const second = realm.request("status", { kind: "hang" });
  await expect(realm.request("status", {})).rejects.toThrow("Too many pending");
  expect(
    (await Promise.allSettled([first, second])).every(
      (entry) => entry.status === "rejected",
    ),
  ).toBe(true);
  expect(await realm.retire()).toMatchObject({
    graceful: false,
    exitObserved: true,
    forcedTermination: true,
  });
}, 40_000);
