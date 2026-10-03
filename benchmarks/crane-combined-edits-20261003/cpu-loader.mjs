/** CPU loader changes import URLs only; geometry-source transformations are frozen separately. */
import { readFile } from "node:fs/promises";
import { pathToFileURL, fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
export const here = dirname(fileURLToPath(import.meta.url)),
  repo = resolve(here, "../..");
const url = (path) => pathToFileURL(resolve(repo, path)).href;
export const dataUrl = (source) =>
  "data:text/javascript;base64," + Buffer.from(source).toString("base64");
export const localImports = (source) =>
  source
    .replaceAll("'/worker-modules/", `'${pathToFileURL(repo).href}/`)
    .replaceAll(
      "'/three.core.js'",
      JSON.stringify(url("shadow-lab/src/compare/three.core.js")),
    );
export async function sceneModule(engine, original = false) {
  const path = original
    ? `benchmarks/crane-live-edits-20261003/${engine === "aperture" ? "author-a/post-author-byte-diagnostic/scene.mjs" : "author-b/v1/scene-data.mjs"}`
    : `benchmarks/crane-combined-edits-20261003/${engine === "aperture" ? "author-a/scene.mjs" : "author-b/scene-data.mjs"}`;
  let source = localImports(await readFile(resolve(repo, path), "utf8"));
  source = source.replaceAll(
    "'../contract.mjs'",
    JSON.stringify(
      url("benchmarks/crane-combined-edits-20261003/contract.mjs"),
    ),
  );
  const moduleUrl = dataUrl(source);
  return { module: await import(moduleUrl), moduleUrl };
}
export async function apertureSystem(session = "live") {
  const scene = await sceneModule("aperture");
  const contract = dataUrl(
    (await readFile(resolve(here, "harness/contract.mjs"), "utf8"))
      .replaceAll(
        "'../contract.mjs'",
        JSON.stringify(
          url("benchmarks/crane-combined-edits-20261003/contract.mjs"),
        ),
      )
      .replace(
        "export const SESSION_ID = 'live';",
        `export const SESSION_ID = ${JSON.stringify(session)};`,
      ),
  );
  const text = localImports(
    await readFile(resolve(here, "author-a/scene-system.mjs"), "utf8"),
  )
    .replaceAll("'./scene.mjs'", JSON.stringify(scene.moduleUrl))
    .replaceAll(
      "'./native-evidence.mjs'",
      JSON.stringify(
        url(
          "benchmarks/crane-combined-edits-20261003/author-a/native-evidence.mjs",
        ),
      ),
    )
    .replaceAll("'/harness/contract.mjs'", JSON.stringify(contract));
  return { system: await import(dataUrl(text)), scene: scene.module };
}
export async function threeModules() {
  const scene = await sceneModule("threejs");
  const checks = await import(
    dataUrl(
      (await readFile(resolve(here, "author-b/checks.mjs"), "utf8")).replaceAll(
        "'./scene-data.mjs'",
        JSON.stringify(scene.moduleUrl),
      ),
    )
  );
  const store = await import(
    dataUrl(
      localImports(
        await readFile(resolve(here, "author-b/native-meshes.mjs"), "utf8"),
      ),
    )
  );
  const THREE = await import(url("shadow-lab/src/compare/three.core.js"));
  return { scene: scene.module, checks, store, THREE };
}
