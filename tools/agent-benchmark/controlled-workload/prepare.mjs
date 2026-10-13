import { createHash } from "node:crypto";
import {
  cp,
  mkdir,
  readFile,
  readdir,
  realpath,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createWorkload,
  groupedInstances,
  typedGeometry,
  VARIANTS,
} from "./scene.mjs";
import { verifyGeometryBufferParity } from "./buffer-parity.mjs";

const directory = dirname(fileURLToPath(import.meta.url));
const repository = resolve(directory, "../../..");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const json = (value) => JSON.stringify(value, null, 2) + "\n";
const save = (path, value) => writeFile(path, value, { flag: "wx" });
const packetHash = (value) =>
  hash(Buffer.from(value.buffer, value.byteOffset, value.byteLength));
const adapterFiles = {
  aperture: [
    "aperture-main.mjs",
    "aperture-config.mjs",
    "aperture-worker.mjs",
    "aperture-scene.mjs",
  ],
  three: ["three-main.mjs", "three-geometry.mjs"],
};

export function workloadManifest(workload) {
  const geometries = workload.geometries.map((source) => {
    const data = typedGeometry(source);
    const fields = Object.fromEntries(
      ["positions", "normals", "uvs", "indices"].map((name) => [
        name,
        {
          bytes: data[name].byteLength,
          sha256: packetHash(data[name]),
          type: data[name].constructor.name,
        },
      ]),
    );
    return {
      id: source.id,
      vertices: data.positions.length / 3,
      triangles: data.indices.length / 3,
      fields,
    };
  });
  const byId = new Map(geometries.map((entry) => [entry.id, entry]));
  return {
    schema: "aperture.controlled-workload.manifest.v1",
    variant: workload.variant,
    workloadSha256: hash(json(workload)),
    settingsSha256: hash(json(workload.settings)),
    instancesSha256: hash(json(workload.instances)),
    materialSha256: hash(json(workload.materials)),
    geometries,
    textures: workload.textures.map((source) => ({
      id: source.id,
      width: source.width,
      height: source.height,
      bytes: source.bytes.length,
      sha256: packetHash(Uint8Array.from(source.bytes)),
    })),
    totals: {
      geometries: geometries.length,
      materials: workload.materials.length,
      textures: workload.textures.length,
      instances: workload.instances.length,
      instancingGroups: groupedInstances(workload).length,
      storedGeometryBytes: geometries.reduce(
        (sum, entry) =>
          sum +
          Object.values(entry.fields).reduce(
            (part, field) => part + field.bytes,
            0,
          ),
        0,
      ),
      storedInstanceBytes: workload.instances.length * 16 * 4,
      placedTriangles: workload.instances.reduce(
        (sum, entry) => sum + byId.get(entry.geometry).triangles,
        0,
      ),
    },
    settings: workload.settings,
    comparisonLimits: [
      "Input positions, normals, UVs, indices, texture bytes, material factors and object transforms match. Renderer shaders, BRDF implementation, native shadow filtering and final color processing may differ.",
      "Both adapters share geometry and materials; Three uses public InstancedMesh, Aperture authors ordinary ECS entities and lets extraction/renderer batch them.",
      "Static shadow reuse is enabled on both. First-frame initialization and shadow generation are excluded from steady-state timings by the common warmup.",
      "Native submitted draw/index/transform coverage and images must be reviewed before any speed conclusion; a source manifest alone cannot prove submitted equivalence.",
      "These controlled implementation diagnostics do not measure independent authoring skill, author speed or authored visual quality, and remain separate from scored authoring rounds.",
    ],
  };
}

async function inventory(root) {
  const files = {};
  async function visit(path) {
    for (const entry of (await readdir(path, { withFileTypes: true })).sort(
      (a, b) => a.name.localeCompare(b.name),
    )) {
      const absolute = resolve(path, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile()) {
        const bytes = await readFile(absolute);
        files[relative(root, absolute)] = {
          bytes: bytes.length,
          sha256: hash(bytes),
        };
      } else
        throw new Error("Generated source inventory requires regular files");
    }
  }
  await visit(root);
  return files;
}

async function apertureAliases(apertureRoot) {
  const aliases = [],
    packages = {},
    externals = new Map();
  for (const entry of await readdir(resolve(apertureRoot, "packages"), {
    withFileTypes: true,
  })) {
    if (!entry.isDirectory()) continue;
    const root = resolve(apertureRoot, "packages", entry.name);
    const metadata = await readFile(resolve(root, "package.json"));
    const descriptor = JSON.parse(metadata);
    if (!descriptor.name.startsWith("@aperture-engine/")) continue;
    packages[descriptor.name] = {
      version: descriptor.version,
      packageJsonSha256: hash(metadata),
      root,
    };
    for (const [key, exported] of Object.entries(descriptor.exports ?? {})) {
      if (typeof exported !== "object" || !exported.import) continue;
      aliases.push({
        find: descriptor.name + (key === "." ? "" : key.slice(1)),
        replacement: resolve(root, exported.import),
      });
    }
    for (const [id, range] of Object.entries(descriptor.dependencies ?? {})) {
      if (range.startsWith("workspace:") || externals.has(id)) continue;
      const external = await realpath(resolve(root, "node_modules", id));
      externals.set(id, external);
    }
  }
  aliases.push(
    ...[...externals].map(([find, replacement]) => ({ find, replacement })),
  );
  aliases.sort((a, b) => b.find.length - a.find.length);
  return { aliases, packages };
}

async function buildAdapter(engine, root, aliases) {
  const { build } = await import("vite");
  const used = new Set();
  const retain = () => ({
    name: "controlled-retain-inputs",
    moduleParsed(module) {
      used.add(module.id);
    },
  });
  await build({
    configFile: false,
    root: resolve(root, "source"),
    logLevel: "silent",
    resolve: { alias: aliases },
    worker: { format: "es", plugins: () => [retain()] },
    plugins: [retain()],
    build: {
      outDir: resolve(root, "dist"),
      emptyOutDir: false,
      target: "es2022",
      sourcemap: true,
      // The pinned Chromium supports modulepreload natively. Avoid rewriting
      // Vite's virtual polyfill through the engine dependency alias for vite.
      modulePreload: { polyfill: false },
    },
  });
  const resolvedInputs = {};
  await mkdir(resolve(root, "resolved-inputs"));
  for (const id of [...used].sort()) {
    if (!isAbsolute(id) || id.includes("?")) continue;
    const bytes = await readFile(id),
      digest = hash(bytes),
      name = `${digest}.source`;
    if (!Object.values(resolvedInputs).some((entry) => entry.copy === name))
      await save(resolve(root, "resolved-inputs", name), bytes);
    resolvedInputs[id] = { bytes: bytes.length, sha256: digest, copy: name };
  }
  await save(
    resolve(root, "build-inputs.json"),
    json({
      engine,
      resolvedInputs,
      build: await inventory(resolve(root, "dist")),
    }),
  );
  return {
    modules: Object.keys(resolvedInputs).length,
    dist: resolve(root, "dist"),
  };
}

/** CPU-only preparation. Browser launches belong to the established run-v2 route. */
export async function prepareControlledWorkload({
  outputRoot,
  apertureRoot = repository,
  threeRoot,
  variant = "baseline",
  build = true,
}) {
  if (!isAbsolute(outputRoot))
    throw new Error("Controlled outputRoot must be absolute and new");
  if (
    build &&
    (!isAbsolute(apertureRoot) || !threeRoot || !isAbsolute(threeRoot))
  )
    throw new Error("Build requires absolute apertureRoot and threeRoot");
  const workload = createWorkload(variant),
    manifest = workloadManifest(workload);
  let apertureInputs, threeMetadata, productionBufferParity;
  if (build) {
    apertureInputs = await apertureAliases(apertureRoot);
    threeMetadata = JSON.parse(
      await readFile(resolve(threeRoot, "package.json"), "utf8"),
    );
    if (threeMetadata.name !== "three")
      throw new Error("threeRoot must contain the Three.js package");
    productionBufferParity = await verifyGeometryBufferParity({
      workload,
      apertureRoot,
      threeRoot,
    });
  }
  await mkdir(dirname(outputRoot), { recursive: true });
  await mkdir(outputRoot);
  await save(resolve(outputRoot, "workload.json"), json(workload));
  await save(resolve(outputRoot, "canonical-manifest.json"), json(manifest));
  if (productionBufferParity)
    await save(
      resolve(outputRoot, "production-buffer-parity.json"),
      json(productionBufferParity),
    );
  const adapters = {};
  for (const engine of ["aperture", "three"]) {
    const root = resolve(outputRoot, engine),
      source = resolve(root, "source");
    await mkdir(source, { recursive: true });
    for (const name of ["scene.mjs", ...adapterFiles[engine]])
      await cp(resolve(directory, name), resolve(source, name), {
        errorOnExist: true,
        force: false,
      });
    await save(resolve(source, "workload.json"), json(workload));
    await save(
      resolve(source, "package.json"),
      json({ name: `controlled-${engine}`, type: "module", private: true }),
    );
    const entry =
      engine === "aperture" ? "aperture-main.mjs" : "three-main.mjs";
    await save(
      resolve(source, "index.html"),
      `<!doctype html><html><head><meta charset="utf-8"><title>Controlled workload</title><style>html,body{margin:0;overflow:hidden;width:1024px;height:768px}canvas{display:block;width:1024px;height:768px}</style></head><body>${engine === "aperture" ? '<canvas id="scene" width="1024" height="768"></canvas>' : ""}<script type="module" src="./${entry}"></script></body></html>\n`,
    );
    const input = {
      source,
      sourceInventory: await inventory(source),
      canonicalWorkloadSha256: manifest.workloadSha256,
    };
    if (build)
      Object.assign(
        input,
        await buildAdapter(
          engine,
          root,
          engine === "aperture"
            ? apertureInputs.aliases
            : [
                {
                  find: "three/webgpu",
                  replacement: resolve(threeRoot, "build/three.webgpu.js"),
                },
                {
                  find: "three",
                  replacement: resolve(threeRoot, "build/three.module.js"),
                },
              ],
        ),
      );
    adapters[engine] = input;
  }
  await save(
    resolve(outputRoot, "provenance.json"),
    json({
      schema: "aperture.controlled-workload.inputs.v1",
      preparedAt: new Date().toISOString(),
      variant,
      declaredVariants: VARIANTS,
      canonical: manifest,
      productionBufferParity,
      adapters,
      engines: build
        ? {
            aperture: apertureInputs.packages,
            three: {
              version: threeMetadata.version,
              root: threeRoot,
              packageJsonSha256: hash(
                await readFile(resolve(threeRoot, "package.json")),
              ),
            },
          }
        : null,
    }),
  );
  return { outputRoot, manifest, adapters };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const [
      outputRoot,
      threeRoot,
      variant = "baseline",
      apertureRoot = repository,
    ] = process.argv.slice(2);
    const result = await prepareControlledWorkload({
      outputRoot,
      threeRoot,
      variant,
      apertureRoot,
    });
    console.log(
      json({
        outputRoot: result.outputRoot,
        totals: result.manifest.totals,
        adapters: Object.fromEntries(
          Object.entries(result.adapters).map(([engine, value]) => [
            engine,
            { source: value.source, dist: value.dist, modules: value.modules },
          ]),
        ),
      }),
    );
  } catch (error) {
    console.error(error.stack ?? error);
    process.exitCode = 1;
  }
}
