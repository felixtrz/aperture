import { createServer } from "node:http";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { createExamplesRequestHandler } from "../../scripts/serve-examples.mjs";
import { runVerifiedScene } from "../../scripts/verified-webgpu.mjs";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const output = resolve(process.argv[2]);
await mkdir(output, { recursive: true });
const handler = createExamplesRequestHandler(repo);
const server = createServer((request, response) => {
  if (request.url === "/favicon.ico") {
    response.writeHead(204);
    response.end();
  } else {
    return handler(request, response);
  }
});
await new Promise((done, fail) => {
  server.once("error", fail);
  server.listen(0, "127.0.0.1", done);
});
try {
  const result = await runVerifiedScene({
    runtimeRoot: process.env.APERTURE_WEBGPU_RUNTIME,
    scratchRoot: process.env.APERTURE_TMP_RUN,
    url: `http://127.0.0.1:${server.address().port}/examples/spinning-cube.html`,
    outputPath: resolve(output, "result.json"),
    screenshotPath: resolve(output, "render.png"),
    readyGlobal: "__APERTURE_EXAMPLE_STATUS__",
    viewport: { width: 1254, height: 800 },
  });
  console.log(JSON.stringify({ status: result.status, proof: result.proof }));
} finally {
  server.closeAllConnections();
  await new Promise((done) => server.close(done));
}
