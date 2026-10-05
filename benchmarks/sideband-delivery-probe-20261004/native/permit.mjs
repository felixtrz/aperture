import assert from "node:assert/strict";
import { sha256 } from "./inputs.mjs";
export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  return value;
}
export function validateNativePermit(
  begin,
  spec,
  { session, attempt, pinsSha256, boot },
) {
  assert.equal(begin.dispatch_authorized, true);
  assert.equal(begin.kind, "write");
  assert.equal(begin.operation, "run-sideband-native-" + session);
  assert.equal(begin.task, "/root/probe_sideband_delivery");
  assert.equal(
    begin.incarnation,
    "local:34528b6b55687ab3ae8060c82485d7bbd4d9aba5d33690bf933d4225eb448916",
  );
  assert.equal(begin.local_execution.boot_id, boot);
  assert.equal(
    begin.payload,
    sha256(Buffer.from(JSON.stringify(canonical(spec), null, 2) + "\n")),
  );
  assert.equal(spec.session, session);
  assert.equal(spec.attempt, attempt);
  assert.equal(spec.fixturePinsSha256, pinsSha256);
  assert.equal(spec.browserRoute, "runVerifiedScene");
  assert.equal(
    spec.writeDomain,
    `benchmarks/sideband-delivery-probe-20261004/native/renders/${session}`,
  );
  assert.equal(spec.nativeExecution, true);
  return true;
}
