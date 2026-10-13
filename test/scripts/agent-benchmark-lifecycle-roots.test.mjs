import { describe, expect, it } from "vitest";
import {
  APPROVED_LIFECYCLE_ROOTS,
  validateRootMarker,
} from "../../tools/agent-benchmark/lifecycle-roots.mjs";

const root = APPROVED_LIFECYCLE_ROOTS[1];
const raw =
  '{"schema":"aperture.disposable-root.v2","path":"/workspace/shared/aperture-tmp","device":27,"inode":9223372036856195032}';
const identity = { dev: 27n, ino: 9223372036856195032n };

describe("approved lifecycle root identity", () => {
  it("preserves exact inode identity beyond JavaScript number precision", () => {
    expect(() => validateRootMarker(root, raw, identity)).not.toThrow();
    expect(() =>
      validateRootMarker(root, raw, { ...identity, ino: identity.ino + 1n }),
    ).toThrow(/marker differs/);
  });
  it("rejects relocated markers and unsupported roots", () => {
    expect(() =>
      validateRootMarker(
        root,
        raw.replace("9223372036856195032", "1842111"),
        identity,
      ),
    ).toThrow(/marker differs/);
    expect(() => validateRootMarker("/tmp/unmanaged", raw, identity)).toThrow(
      /Unsupported/,
    );
    expect(() =>
      validateRootMarker(
        root,
        raw.replace(root, APPROVED_LIFECYCLE_ROOTS[0]),
        identity,
      ),
    ).toThrow(/marker differs/);
  });
  it("rejects ambiguous or noninteger identity fields", () => {
    expect(() =>
      validateRootMarker(
        root,
        raw.replace('"device":27', '"device":27,"device":27'),
        identity,
      ),
    ).toThrow(/Ambiguous/);
    expect(() =>
      validateRootMarker(
        root,
        raw.replace('"device":27', '"device":27.0'),
        identity,
      ),
    ).toThrow(/Ambiguous/);
  });
});
