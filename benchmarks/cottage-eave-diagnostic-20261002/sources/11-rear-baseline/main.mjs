import { startGeneratedBrowserApp } from '@aperture-engine/app/browser';
import { config } from './config.mjs';
import { normalizeOptions, cottageReport } from './part-data.mjs';

const fail = error => {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  globalThis.__COTTAGE_READY__ = { ok: false, engine: 'aperture', error: message };
  document.querySelector('#error').textContent = message;
  console.error(message);
};
try {
  if (!navigator.gpu) throw new Error('Native WebGPU is required');
  const params = new URLSearchParams(location.search);
  const options = normalizeOptions({ view: params.get('view') ?? 'front', edit: params.get('edit') ?? 'base' });
  globalThis.__COTTAGE_SPEC__ = cottageReport(options);
  let authoredReport = null;
  const generated = await startGeneratedBrowserApp({ config,
    workerEntry: new URL('./worker.mjs', import.meta.url),
    workerStartOptions: { ...options, entityCapacity: 192 },
    workerFactory(entry, workerOptions) {
      const worker = new Worker(entry, workerOptions);
      worker.addEventListener('message', event => {
        if (event.data?.type === 'cottage-authored') authoredReport = event.data.report;
      });
      worker.addEventListener('error', event => fail(event.message || 'Simulation worker failed'));
      return worker;
    },
  });
  if (!generated.webgpu.ok) throw new Error(`${generated.webgpu.reason}: ${generated.webgpu.message}`);
  const app = generated.webgpu.app;
  globalThis.__COTTAGE_APP__ = generated;
  const deadline = performance.now() + 240000;
  async function check() {
    try {
      const diagnostics = app.getDiagnostics({ detail: 'full' });
      if (diagnostics.lastError) throw new Error(JSON.stringify(diagnostics.lastError));
      const status = globalThis.__APERTURE_GENERATED_APP__;
      if (status?.status === 'worker-error' || status?.lastError) throw new Error(JSON.stringify(status.lastError));
      const frame = diagnostics.lastFrame;
      if (frame?.ok && frame.counts.drawCalls > 0 && authoredReport) {
        await app.initialization.device.queue.onSubmittedWorkDone();
        globalThis.__COTTAGE_PARTS__ = authoredReport;
        globalThis.__COTTAGE_READY__ = { ok: true, engine: 'aperture', backend: 'native-webgpu',
          view: options.view, edit: options.edit, width: 800, height: 800, pixelRatio: 1,
          authored: authoredReport, render: { frame: frame.frame, counts: frame.counts,
            shadow: frame.shadow, diagnostics: frame.diagnostics, cadence: diagnostics.cadence } };
        return;
      }
      if (performance.now() > deadline) throw new Error('No completed cottage frame within 240 seconds');
      requestAnimationFrame(check);
    } catch (error) { fail(error); }
  }
  requestAnimationFrame(check);
} catch (error) { fail(error); }
