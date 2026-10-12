import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import {
  inspectLivePngDataUrl,
  sha256Bytes,
} from "./live-image-response-v3.mjs";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=",
  "base64",
);
const returned = (mime = "application/octet-stream", bytes = png) => ({
  detail: "original",
  image_url: `data:${mime};base64,${bytes.toString("base64")}`,
});

test("pure SHA256 matches independent Node oracle across block boundaries", () => {
  for (const size of [0, 1, 3, 55, 56, 63, 64, 65, 127, 128, 1024, 65536]) {
    const bytes = Uint8Array.from({ length: size }, (_, index) => index & 255);
    assert.equal(
      sha256Bytes(bytes),
      createHash("sha256").update(bytes).digest("hex"),
    );
  }
});

test("actual octet transport metadata remains truthful and hashes returned bytes", () => {
  const response = inspectLivePngDataUrl(returned());
  assert.equal(response.dataUrlMime, "application/octet-stream");
  assert.equal(response.decodedBytes, png.length);
  assert.equal(
    response.decodedSha256,
    createHash("sha256").update(png).digest("hex"),
  );
  assert.deepEqual(response.pngDimensions, { width: 1, height: 1 });
  assert.equal(response.dataUrlCharacters, returned().image_url.length);
  assert.equal(
    inspectLivePngDataUrl(returned("image/png")).dataUrlMime,
    "image/png",
  );
  assert.equal("image_url" in response, false);
});

test("exact same helper runs without Node or browser decoder/crypto globals", () => {
  const code = readFileSync(
    new URL("./live-image-response-v3.mjs", import.meta.url),
    "utf8",
  ).replace(/^export (?=function )/gm, "");
  const response = runInNewContext(`${code}\ninspectLivePngDataUrl(input);`, {
    input: returned(),
    atob: undefined,
    crypto: undefined,
    TextEncoder: undefined,
    Buffer: undefined,
  });
  assert.equal(
    response.decodedSha256,
    createHash("sha256").update(png).digest("hex"),
  );
  assert.equal(response.dataUrlMime, "application/octet-stream");
});

test("unknown MIME, non-base64, padding corruption and non-PNG fail closed", () => {
  for (const result of [
    returned("image/jpeg"),
    returned("unknown"),
    { ...returned(), detail: "high" },
    { ...returned(), image_url: returned().image_url.slice(0, -1) },
    {
      ...returned(),
      image_url: returned().image_url.replace(";base64,", ";charset=UTF-8,"),
    },
    { ...returned(), image_url: returned().image_url.replace(/=+$/, "===") },
    { ...returned(), image_url: returned().image_url.replace(/=+$/, "=A") },
    returned("application/octet-stream", Buffer.alloc(33)),
  ])
    assert.throws(() => inspectLivePngDataUrl(result));
});

test("same length returned bytes are hashed rather than substituted with source", () => {
  const changed = Buffer.from(png);
  changed[40] ^= 1;
  assert.notEqual(
    inspectLivePngDataUrl(returned("application/octet-stream", changed))
      .decodedSha256,
    inspectLivePngDataUrl(returned()).decodedSha256,
  );
});
