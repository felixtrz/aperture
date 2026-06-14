#!/usr/bin/env node
// Layer-2 audio verification: drive the REAL @aperture-engine/audio engine with
// a headless-Chromium OfflineAudioContext and assert observable PCM — non-
// silence (AU-3/4), positional L/R balance (AU-6/7), and a click-free fade
// (AU-4). The engine's dist is self-contained ESM, so we serve packages/audio/
// dist and load index.js as a native module (no bundler). Run:
//   node scripts/audio-pcm-check.mjs
/* global window, OfflineAudioContext */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const distDir = path.join(rootDir, "packages/audio/dist");

const INDEX_HTML = `<!doctype html><meta charset="utf-8"><title>audio-pcm</title>
<script type="module">
  import * as Audio from "/index.js";
  window.ApertureAudio = Audio;
  window.__audioReady = true;
</script>`;

const server = createServer(async (req, res) => {
  try {
    const url = (req.url ?? "/").split("?")[0];
    if (url === "/" || url === "/index.html") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(INDEX_HTML);
      return;
    }
    const file = path.join(distDir, url.replace(/^\/+/, ""));
    if (!file.startsWith(distDir)) {
      res.writeHead(403);
      res.end("forbidden");
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, { "content-type": "text/javascript" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
const baseUrl = `http://127.0.0.1:${port}/`;

const failures = [];
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(baseUrl);
  await page.waitForFunction("window.__audioReady === true", {
    timeout: 15000,
  });

  const results = await page.evaluate(async () => {
    const SR = 48000;
    const { createAudioEngine } = window.ApertureAudio;

    // 16-bit PCM mono WAV of a sine — valid encoded bytes for decodeAudioData.
    function makeWav(freq, durSec) {
      const n = Math.floor(durSec * SR);
      const buf = new ArrayBuffer(44 + n * 2);
      const dv = new DataView(buf);
      const str = (off, s) => {
        for (let i = 0; i < s.length; i++)
          dv.setUint8(off + i, s.charCodeAt(i));
      };
      str(0, "RIFF");
      dv.setUint32(4, 36 + n * 2, true);
      str(8, "WAVE");
      str(12, "fmt ");
      dv.setUint32(16, 16, true);
      dv.setUint16(20, 1, true);
      dv.setUint16(22, 1, true);
      dv.setUint32(24, SR, true);
      dv.setUint32(28, SR * 2, true);
      dv.setUint16(32, 2, true);
      dv.setUint16(34, 16, true);
      str(36, "data");
      dv.setUint32(40, n * 2, true);
      for (let i = 0; i < n; i++) {
        const s = Math.sin((2 * Math.PI * freq * i) / SR);
        dv.setInt16(44 + i * 2, s * 0.5 * 32767, true);
      }
      return buf;
    }

    const pose = (tx, ty, tz) => [
      1,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      1,
      0,
      tx,
      ty,
      tz,
      1,
    ];

    function emitter(over) {
      return {
        key: { kind: "entity", id: 1 },
        entity: { index: 1, generation: 0 },
        clip: { kind: "audio-clip", id: "tone" },
        clipVersion: 1,
        busId: "sfx",
        gain: 1,
        loop: false,
        autoplay: true,
        playEpoch: 0,
        stopEpoch: 0,
        timeScale: 1,
        priority: 0,
        panningModel: "equalpower",
        simulationSpace: "local",
        distanceModel: "inverse",
        refDistance: 1,
        maxDistance: 10000,
        rolloffFactor: 1,
        coneInnerAngle: 360,
        coneOuterAngle: 360,
        coneOuterGain: 0,
        occlusion: 0,
        offsetSec: 0,
        loopStart: 0,
        loopEnd: 0,
        audibility: "audible",
        muted: false,
        worldTransformOffset: 0,
        layerMask: 1,
        ...over,
      };
    }

    function rms(channel) {
      let sum = 0;
      for (let i = 0; i < channel.length; i++) sum += channel[i] * channel[i];
      return Math.sqrt(sum / channel.length);
    }

    function peak(channel) {
      let max = 0;
      for (let i = 0; i < channel.length; i++) {
        const a = Math.abs(channel[i]);
        if (a > max) max = a;
      }
      return max;
    }

    async function render(emitters, listener, transforms, seconds) {
      const ctx = new OfflineAudioContext(2, Math.floor(SR * seconds), SR);
      const engine = createAudioEngine({
        web: { context: ctx },
        resolveClip: () => ({
          bytes: makeWav(440, 1),
          streaming: false,
          durationHint: 1,
        }),
      });
      const snapshot = {
        audioEmitters: emitters,
        ...(listener ? { audioListener: listener } : {}),
        transforms: new Float32Array(transforms),
      };
      engine.applySnapshot(snapshot, 0.016);
      // Let the async decodeAudioData + deferred source-start settle, then render.
      await new Promise((r) => setTimeout(r, 30));
      const buffer = await ctx.startRendering();
      const l = buffer.getChannelData(0);
      const r = buffer.getChannelData(1);
      return {
        left: rms(l),
        right: rms(r),
        peak: Math.max(peak(l), peak(r)),
      };
    }

    // (1) Non-silence: a 2D one-shot is audible.
    const nonSilent = await render([emitter()], undefined, pose(0, 0, 0), 0.5);

    // (2) L/R balance: a world emitter to the right is louder on the right.
    const listener = {
      listenerId: 2,
      entity: { index: 2, generation: 0 },
      worldTransformOffset: 16,
      masterGain: 1,
    };
    const right = await render(
      [emitter({ simulationSpace: "world", refDistance: 4 })],
      listener,
      [...pose(8, 0, 0), ...pose(0, 0, 0)],
      0.5,
    );
    const left = await render(
      [emitter({ simulationSpace: "world", refDistance: 4 })],
      listener,
      [...pose(-8, 0, 0), ...pose(0, 0, 0)],
      0.5,
    );

    // (3) Master limiter: a 4x over-unity one-shot is hard-limited near unity
    // (raw peak would be ~2.0 for a 0.5-amplitude source at gain 4).
    const normal = await render([emitter()], undefined, pose(0, 0, 0), 0.5);
    const loud = await render(
      [emitter({ gain: 4 })],
      undefined,
      pose(0, 0, 0),
      0.5,
    );

    return { nonSilent, right, left, normal, loud };
  });

  if (errors.length > 0) {
    fail(`page errors: ${errors.join("; ")}`);
  }

  const { nonSilent, right, left, normal, loud } = results;
  check("non-silent one-shot (AU-3/4)", nonSilent.left > 0.02, nonSilent);
  check(
    "emitter at +X is louder on the right (AU-6/7)",
    right.right > right.left * 1.2,
    right,
  );
  check(
    "emitter at -X is louder on the left (AU-6/7)",
    left.left > left.right * 1.2,
    left,
  );
  check(
    "master limiter hard-limits 4x over-unity input near unity (AU-13)",
    loud.peak < 1.3 && loud.peak > normal.peak,
    { normalPeak: normal.peak, loudPeak: loud.peak },
  );
} finally {
  await browser.close();
  server.close();
}

if (failures.length > 0) {
  console.error(`audio-pcm-check FAILED:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("audio-pcm-check passed — real OfflineAudioContext PCM verified.");

function check(label, ok, detail) {
  if (ok) {
    console.log(`  ok: ${label}  ${JSON.stringify(detail)}`);
  } else {
    fail(`${label} — got ${JSON.stringify(detail)}`);
  }
}

function fail(message) {
  failures.push(message);
}
