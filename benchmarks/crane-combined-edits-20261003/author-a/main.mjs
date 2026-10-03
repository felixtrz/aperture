import { startGeneratedBrowserApp } from '/worker-modules/packages/app/dist/browser.js';
import { createGeneratedCommandMessage, createApertureDevtoolsRequest } from '/worker-modules/packages/app/dist/commands.js';
import { installLiveEditTracking, runLiveEditHarness } from '/harness/client.mjs';
import { STATES } from '/harness/contract.mjs';
import { CONFIG, CAMERAS, PALETTE } from './scene.mjs';
import { installGpuObserver } from './gpu-observer.mjs';
import { webGpuAppRenderReportToJsonValue } from '/worker-modules/packages/webgpu/dist/index.js';
import { jsonValue } from './native-evidence.mjs';
import { inspectFrameCorrespondence, inspectConsumedSnapshot } from './frame-proof.mjs';

const tracking = installLiveEditTracking();
const gpuObserver = installGpuObserver();
const published = new Map(), completed = new Map(), errors = [], publicationTrace = [], receptionTrace = [], stepAcks = [];
let latestGate = null, nativeRenderer = null;
const clone = value => JSON.parse(JSON.stringify(value));
const canvas = document.querySelector('#scene');
let workerObject = null;
window.__CRANE_LIVE_AUTHOR_PROGRESS__ = { phase: 'boot' };
window.addEventListener('error', event => errors.push({ type: 'window-error', message: event.message }));
window.addEventListener('unhandledrejection', event => errors.push({ type: 'rejection', message: String(event.reason?.stack ?? event.reason) }));

async function until(read, label) {
  const deadline = performance.now() + 180000;
  while (performance.now() < deadline) {
    if (errors.length) throw Error(`${label}: ${JSON.stringify(errors)}`);
    const value = read();
    if (value) return value;
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
  const diagnostics = nativeRenderer?.getDiagnostics({detail:'full'});
  const trace = {latestGate,publicationTrace:publicationTrace.slice(-8),receptionTrace:receptionTrace.slice(-8),stepAcks:stepAcks.slice(-3),publishedFrames:[...published.keys()],completedFrames:[...completed.keys()],transport:diagnostics?.transport,cadence:diagnostics?.cadence,lastFrame:diagnostics?.lastFrame?{frame:diagnostics.lastFrame.frame,ok:diagnostics.lastFrame.ok,counts:diagnostics.lastFrame.counts,renderTargets:diagnostics.lastFrame.renderTargets,diagnostics:diagnostics.lastFrame.diagnostics}:null};
  throw Error(`Timed out waiting for ${label}; retained correspondence diagnostics: ${JSON.stringify(trace)}`);
}

try {
  const app = await startGeneratedBrowserApp({ config: CONFIG, workerEntry: new URL('./worker.mjs', import.meta.url), workerStartOptions: { sharedSnapshotMessageRateHz: 240, sourceAssetsMessageRateHz: 240, workerFullSummaryIntervalMilliseconds: 16 }, workerFactory: (url, options) => {
    if (workerObject) throw Error('Second Worker rejected');
    workerObject = new Worker(url, options);
    workerObject.addEventListener('message', event => { if(event.data?.type==='crane-live-publication-trace') publicationTrace.push(event.data); });
    return workerObject;
  } });
  if (!app.webgpu.ok) throw Error(`Native WebGPU failed: ${JSON.stringify(app.webgpu)}`);
  const renderer = app.webgpu.app;
  nativeRenderer = renderer;
  // Preserve the actual renderer and native method, observing its completion.
  const nativeRenderSnapshot = renderer.renderSnapshot;
  renderer.renderSnapshot = async function (snapshot, options) {
    const actualSnapshot = jsonValue(snapshot);
    const result = await nativeRenderSnapshot.call(this, snapshot, options);
    if(result.frame !== actualSnapshot.frame || result.snapshot.frame !== actualSnapshot.frame) throw Error('Native renderSnapshot completion changed the input snapshot frame');
    completed.set(result.frame, {frame:webGpuAppRenderReportToJsonValue(result),snapshot:actualSnapshot});
    return result;
  };
  app.worker.onError(event => errors.push({ type: 'worker', ...event }));
  app.worker.onSnapshot(event => {
    const evidence = event.message.craneLive;
    receptionTrace.push({frame:event.frame,snapshotFrame:event.snapshot.frame,revision:evidence?.revision??null,stateId:evidence?.stateId??null,full:event.message.workerSummary?.summaryCadence?.full??null,postMessageReasons:event.message.workerSummary?.postMessageDecision?.postMessageReasons??null});
    if (!evidence) return;
    if (evidence.snapshotFrame !== event.frame || evidence.snapshotFrameField !== event.snapshot.frame) throw Error('Observed native worker snapshot frame disagrees with revision evidence');
    published.set(event.frame, evidence);
  });
  app.worker.onMessage(message => {
    if (message.type === 'aperture.devtools.response' && message.requestId?.startsWith('crane-live-')) { stepAcks.push(clone(message)); if(!message.ok) errors.push({ type: 'step-failed', message }); }
  });
  const sourceFiles = {};
  for (const file of ['scene.mjs', 'scene-system.mjs', 'worker.mjs', 'main.mjs', 'native-evidence.mjs', 'gpu-observer.mjs', 'frame-proof.mjs', 'index.html']) {
    const response = await fetch(new URL(file, import.meta.url));
    if (!response.ok) throw Error(`Own source could not be retained: ${file}`);
    sourceFiles[file] = await response.text();
  }
  const appearance = { config: CONFIG.render, palette: PALETTE, cameraClearColor: [.115, .17, .209, 1], lights: [
    { kind: 'directional', color: [1,.89,.72,1], intensity:2.65, position:[-4,7,5], target:[0,0,0], shadow:{mapSize:1024,cascadeCount:1,shadowType:2,strength:.82,filterRadius:16,normalBias:.02,bias:.0006,slopeBias:1,center:[0,1.4,0],orthographicSize:12,near:.1,far:35,lightDistance:15} },
    { kind:'rect-area',color:[.67,.8,1,1],intensity:.85,position:[3,6,-4],target:[0,1,0],width:7,height:7,range:30 },
    { kind:'ambient',color:[.42,.54,.66,1],intensity:.65 },
    { kind:'point',color:[1,.55,.22,1],intensity:1.15,position:[2.61,1.76,-1.69],range:1.9 }
  ] };
  const adapter = {
    engine: 'aperture', canvas,
    getRuntimeHandles() { return { renderer, scene: app.worker, worker: workerObject }; },
    async applyAndSubmit(state) {
      const revision = state.index + 1;
      window.__CRANE_LIVE_AUTHOR_PROGRESS__ = { phase: 'requesting-worker-edit', stateId: state.id, revision };
      app.worker.postMessage(createGeneratedCommandMessage({ channel: 'crane.live.apply', payload: { id: state.id, index: state.index, revision } }));
      app.worker.postMessage(createApertureDevtoolsRequest({ requestId: `crane-live-${revision}`, tool: 'ecs_step', payload: { delta: 1 / 60, time: revision / 60 } }));
      const native = await until(() => {
        const diagnostics = renderer.getDiagnostics({ detail: 'full' });
        if (diagnostics.lastError) throw Error(`Native renderer error: ${JSON.stringify(diagnostics.lastError)}`);
        // A completed native method call and exact worker publication are both
        // necessary. Queue counters, step acknowledgments and parameter values
        // alone can never satisfy this gate.
        for (const submission of [...completed.values()].reverse()) {
          const gate = inspectFrameCorrespondence(state, published, submission);
          latestGate = gate;
          if (!gate.ok) continue;
          const evidence = published.get(submission.frame.frame);
          const consumedChecks = inspectConsumedSnapshot(evidence.nativeGeometry.meshes, submission.snapshot);
          if(consumedChecks.some(check=>!check.ok)) throw Error(`Actual renderer snapshot mismatch: ${JSON.stringify(consumedChecks.filter(check=>!check.ok))}`);
          return { evidence, frame:clone(submission.frame), submittedSnapshot:submission.snapshot, consumedChecks };
        }
        return null;
      }, `revision ${revision} on its actual native submitted snapshot frame`);
      this.last = native;
      return { stateId: state.id, revision, workerRevision: native.evidence.revision, submittedRevision: native.evidence.revision, nativeFrame: native.frame.frame,
        details: { correspondence: 'Worker revision evidence attached to the exact native snapshot publication; native renderer report.frame equals that same snapshot.frame after successful swapchain submission.', workerSnapshotFrame: native.evidence.snapshotFrame, workerSnapshotFrameField: native.evidence.snapshotFrameField, nativeReportFrame: native.frame.frame, actualRenderSnapshotFrame: native.submittedSnapshot.frame, nativeRenderMethodCompletionObserved: true, nativeStepAcknowledgment: stepAcks.find(ack=>ack.requestId===`crane-live-${revision}`)??null, nativeReportOk: native.frame.ok, nativeDrawCalls: native.frame.counts.drawCalls, submittedAssetVersions: native.evidence.resources.assetVersions, nativeFrameReport: native.frame } };
    },
    async readEvidence(state, receipt) {
      const observed = this.last;
      if (observed.evidence.stateId !== state.id || observed.evidence.revision !== receipt.revision || observed.frame.frame !== receipt.nativeFrame) throw Error('Evidence/receipt drift');
      const native = clone(observed.evidence), gpu = gpuObserver.evidence(native.nativeGeometry.meshes);
      native.nativeGeometry.gpuBuffers = gpu.buffers;
      native.nativeGeometry.actualSubmittedSnapshot = observed.submittedSnapshot;
      native.nativeChecks.checks.push(...gpu.checks, ...observed.consumedChecks);
      native.nativeChecks.ok = native.nativeChecks.checks.every(check => check.ok) && errors.length === 0;
      native.sourceGeometry.sourceFiles = sourceFiles;
      return { ...native, camera: { position: CAMERAS['front-quarter'], target: [0,1.4,0], verticalSpan:10.5, projection:'orthographic', aspect:1, near:.1, far:80 }, appearance,
        resources: { worker: native.resources, gpu: gpuObserver.counters(), nativeRenderer: observed.frame.resourceReuse },
        validationErrors: clone(errors), nativeCorrespondenceTrace:{publication:publicationTrace.slice(-3),reception:receptionTrace.slice(-3),gate:latestGate}, nativeSubmission: receipt.details, transport: nativeRenderer.getDiagnostics({detail:'full'}).transport,
        limitations: ['GPU bytes are actual native queue-upload observations plus native asset bytes, not GPU readback.', 'This is a native dynamic-asset publication benchmark; replacement assets and typed arrays are explicitly counted, even when actual GPU buffers are reused.', 'No engine changes, appearance retuning, new dependencies or geometry re-authoring.'] };
    }
  };
  window.__CRANE_LIVE_ADAPTER__ = adapter;
  await runLiveEditHarness(adapter, { tracking });
  window.__CRANE_LIVE_AUTHOR_PROGRESS__ = { phase: 'complete', states:STATES.length };
} catch (error) {
  window.__CRANE_LIVE_AUTHOR_PROGRESS__ = { phase:'error', message:String(error.stack ?? error) };
  console.error(error);
  throw error;
}
