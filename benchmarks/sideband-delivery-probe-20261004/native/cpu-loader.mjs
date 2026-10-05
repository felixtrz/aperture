import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { here, repo } from "./inputs.mjs";
const data = (source) =>
  "data:text/javascript;base64," + Buffer.from(source).toString("base64");
const local = (source) =>
  source.replace(
    /(["'])\/worker-modules\//g,
    (_, quote) => quote + pathToFileURL(repo).href + "/",
  );
export async function loadProducer() {
  let scene = local(await readFile(resolve(here, "scene.mjs"), "utf8"));
  scene = scene.replace(
    '"./contract.mjs"',
    JSON.stringify(pathToFileURL(resolve(here, "contract.mjs")).href),
  );
  const sceneUrl = data(scene);
  let producer = local(await readFile(resolve(here, "producer.mjs"), "utf8"));
  producer = producer
    .replace('"./scene.mjs"', JSON.stringify(sceneUrl))
    .replace(
      '"./contract.mjs"',
      JSON.stringify(pathToFileURL(resolve(here, "contract.mjs")).href),
    );
  return {
    producer: await import(data(producer)),
    scene: await import(sceneUrl),
  };
}
