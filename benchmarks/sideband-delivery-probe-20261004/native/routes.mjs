import assert from "node:assert/strict";
import { readFile, realpath } from "node:fs/promises";
import { resolve, relative, extname } from "node:path";
import {
  resolveWorkerModulePath,
  rewriteWorkerModuleImports,
} from "../../../scripts/serve-examples.mjs";
import { here, repo, sha256 } from "./inputs.mjs";
import { SESSIONS } from "./contract.mjs";
export const OWN_ROUTES = [
  "/index.html",
  "/main.mjs",
  "/worker.mjs",
  "/producer.mjs",
  "/scene.mjs",
  "/session.mjs",
  "/contract.mjs",
];
export function resolveModule(pathname) {
  assert(
    !pathname.includes("\\") &&
      !pathname.includes("\0") &&
      !pathname.split("/").some((part) => part === "." || part === ".."),
  );
  if (pathname.startsWith("/worker-modules/"))
    return resolveWorkerModulePath(pathname, repo);
  if (OWN_ROUTES.includes(pathname)) return resolve(here, pathname.slice(1));
  if (["/native-observer.mjs", "/shader-contract.mjs"].includes(pathname))
    return resolve(
      repo,
      "benchmarks/indexed-shared-mesh-fanout-20261004",
      pathname.slice(1),
    );
  throw Error("Unknown static route");
}
export async function readServedModule(pathname, session, pins) {
  assert(SESSIONS.includes(session));
  const target = await realpath(resolveModule(pathname)),
    name = relative(repo, target),
    pin = pins.files[name];
  assert(pin, "Unpinned module: " + name);
  const raw = await readFile(target);
  assert.equal(raw.length, pin.bytes);
  assert.equal(sha256(raw), pin.sha256);
  let body = raw,
    transformation = "none";
  if (pathname === "/session.mjs") {
    const seam = 'export const SESSION = "before-poll";';
    const source = raw.toString("utf8");
    assert.equal(source.split(seam).length, 2);
    body = Buffer.from(
      source.replace(
        seam,
        `export const SESSION = ${JSON.stringify(session)};`,
      ),
    );
    transformation = "one pinned session literal";
  } else if (
    pathname.startsWith("/worker-modules/") &&
    [".js", ".mjs"].includes(extname(target))
  ) {
    body = Buffer.from(rewriteWorkerModuleImports(raw.toString("utf8")));
    transformation = "canonical import rewrites";
  }
  return {
    body,
    name,
    inputSha256: pin.sha256,
    servedSha256: sha256(body),
    bytes: body.length,
    transformation,
  };
}
