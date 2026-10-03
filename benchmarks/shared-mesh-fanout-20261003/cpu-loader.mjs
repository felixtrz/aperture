import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
export const here = dirname(fileURLToPath(import.meta.url)),
  repo = resolve(here, "../..");
const url = (p) => pathToFileURL(resolve(here, p)).href;
const data = (s) =>
  "data:text/javascript;base64," + Buffer.from(s).toString("base64");
const local = (s) =>
  s.replace(
    /(["'])\/worker-modules\//g,
    (_, q) => q + pathToFileURL(repo).href + "/",
  );
const specifier = (text, from, to) =>
  text
    .replaceAll(JSON.stringify(from), JSON.stringify(to))
    .replaceAll("'" + from + "'", JSON.stringify(to));
export async function sceneModule() {
  const legacy = data(
    specifier(
      local(await readFile(resolve(here, "author-a/legacy-scene.mjs"), "utf8")),
      "../contract.mjs",
      url("contract.mjs"),
    ),
  );
  const src = specifier(
    specifier(
      await readFile(resolve(here, "author-a/scene.mjs"), "utf8"),
      "./legacy-scene.mjs",
      legacy,
    ),
    "../contract.mjs",
    url("contract.mjs"),
  );
  const moduleUrl = data(src);
  return { module: await import(moduleUrl), moduleUrl };
}
export async function apertureSystem(session = "live") {
  const scene = await sceneModule();
  const contract = data(
    specifier(
      await readFile(resolve(here, "harness/contract.mjs"), "utf8"),
      "../contract.mjs",
      url("contract.mjs"),
    ).replace(
      /export const SESSION_ID = ["']live["'];/,
      `export const SESSION_ID = ${JSON.stringify(session)};`,
    ),
  );
  let src = local(
    await readFile(resolve(here, "author-a/scene-system.mjs"), "utf8"),
  );
  src = specifier(src, "./scene.mjs", scene.moduleUrl);
  src = specifier(
    src,
    "./native-evidence.mjs",
    url("author-a/native-evidence.mjs"),
  );
  src = specifier(src, "/harness/contract.mjs", contract);
  return { system: await import(data(src)), scene: scene.module };
}
