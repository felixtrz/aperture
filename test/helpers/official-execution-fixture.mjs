import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { sha256 } from "../../tools/agent-benchmark/recorder.mjs";
import {
  EXECUTION_EVIDENCE_SCHEMA,
  EXECUTION_VALIDATED,
} from "../../tools/agent-benchmark/execution-evidence.mjs";

export const officialRun = (engine, trial) =>
  "run-" + sha256(Buffer.from(engine + trial)).slice(0, 32);
export async function put(path, value) {
  const bytes = Buffer.isBuffer(value)
    ? value
    : Buffer.from(
        JSON.stringify(
          value,
          (_key, item) => (typeof item === "bigint" ? "INT:" + item : item),
          2,
        ).replace(/"INT:(-?\d+)"/g, "$1") + "\n",
      );
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
  return { path, bytes: bytes.length, sha256: sha256(bytes) };
}
export const load = async (path) => JSON.parse(await readFile(path, "utf8"));

// Pure evaluateRound fixtures model already verified evidence. These synthetic
// pins are never used as filesystem verification or official benchmark proof.
export function syntheticExecutionProof(summary) {
  const pin = (label) => ({
    path: "/synthetic/" + label,
    bytes: 1,
    sha256: sha256(Buffer.from(label)),
  });
  let ordinal = 0;
  return {
    schema: EXECUTION_EVIDENCE_SCHEMA,
    status: EXECUTION_VALIDATED,
    validationErrors: [],
    executionStart: pin("start"),
    operations: Object.values(summary.engines).flatMap((entry) =>
      entry.trials.map((trial) => ({
        ordinal: ++ordinal,
        run: officialRun(trial.engine, trial.trial),
        engine: trial.engine,
        trial: trial.trial,
        operation: pin(trial.engine + trial.trial),
        audit: pin("audit" + trial.engine + trial.trial),
        manifest: pin("mf" + trial.engine + trial.trial),
        appRecords: Object.fromEntries(
          ["outcome", "inputs", "receipts", "measurement", "renderer"].map(
            (key) => [key, { ...pin(key), sha256: trial.hashes[key] }],
          ),
        ),
      })),
    ),
  };
}

/** Creates ordinary local control bytes; no process/browser or live scratch. */
export async function completedExecutionFixture(
  root,
  summary,
  { capacity = false, existingApp = false } = {},
) {
  const ops = resolve(summary.roundRoot, "official-operations");
  const authors = {};
  for (const [engine, entry] of Object.entries(summary.engines)) {
    const auditPin = existingApp
      ? {
          path: resolve(entry.author.auditRoot, "audit.json"),
          bytes: (await readFile(resolve(entry.author.auditRoot, "audit.json")))
            .length,
          sha256: entry.author.auditSha256,
        }
      : await put(resolve(root, "audits", engine, "audit.json"), {
          engine,
          status: "retained-audit",
          finishSha256: entry.author.finishSha256,
        });
    if (!existingApp) {
      entry.author.auditSha256 = auditPin.sha256;
      entry.author.auditRoot = dirname(auditPin.path);
    }
    authors[engine] = {
      auditPin,
      finishSha256: entry.author.finishSha256,
      appRoot: resolve(entry.author.auditRoot, "source/dist"),
      appInputs: entry.trials[0].appInputs,
      sourceFileCount: 1,
    };
  }
  const steps = [];
  for (let trial = 1; trial <= 3; trial++)
    for (const engine of ["three", "aperture"]) {
      const ordinal = steps.length + 1;
      steps.push({
        ordinal,
        engine,
        trial,
        operationName: `${String(ordinal).padStart(2, "0")}-${engine}-trial-${String(trial).padStart(2, "0")}`,
        job: "official-fixture-" + ordinal,
        outputRoot: resolve(
          summary.roundRoot,
          "trials",
          engine,
          "trial-0" + trial,
        ),
        argv: [
          "python3",
          "runtime_pressure.py",
          "run",
          "--job",
          "official-fixture-" + ordinal,
          "--",
          "node",
          "run-v2.mjs",
          "--engine",
          engine,
          "--trial",
          String(trial),
          "--app",
          authors[engine].appRoot,
        ],
      });
    }
  const plan = {
    schema: "aperture.official-trial-plan.v1",
    round: summary.roundRoot.split("/").at(-1),
    roundRoot: summary.roundRoot,
    operationsRoot: ops,
    cwd: root,
    scratchRoot: resolve(root, "scratch"),
    runtimeRoot: resolve(root, "runtime"),
    driver: await put(
      resolve(root, "source-driver.py"),
      Buffer.from("# fixture driver\n"),
    ),
    method: { sha256: summary.methodSha256 },
    dispatchFreeze: { sha256: summary.dispatchFreezeSha256 },
    steps,
  };
  const sourceCopy = await put(
    resolve(root, "setup/driver.py"),
    await readFile(plan.driver.path),
  );
  plan.sourcePins = [
    {
      ...plan.driver,
      repositoryPath: "source-driver.py",
      survivingFrozenCopy: sourceCopy,
    },
  ];
  if (existingApp) {
    for (const [key, path] of [
      ["method", resolve(root, "method.json")],
      ["dispatchFreeze", resolve(root, "freezes/round-001-inputs.json")],
    ]) {
      const bytes = await readFile(path);
      plan[key] = { path, bytes: bytes.length, sha256: sha256(bytes) };
    }
  } else {
    plan.method = await put(resolve(root, "method.json"), {
      schema: "fixture-method",
    });
    plan.dispatchFreeze = await put(
      resolve(root, "freezes/round-001-inputs.json"),
      {
        provenance: {
          inputs: {
            "source-driver.py": {
              sha256: sourceCopy.sha256,
              bytes: sourceCopy.bytes,
              snapshotPath: "setup/driver.py",
            },
          },
        },
      },
    );
    summary.methodSha256 = plan.method.sha256;
    summary.dispatchFreezeSha256 = plan.dispatchFreeze.sha256;
  }
  plan.artifactProtocol =
    summary.artifactProtocol ?? "aperture.agent-house-artifacts.v1";
  plan.preparation = await put(resolve(root, "setup/preparation.json"), {
    trialOrder: steps.map((step) => step.engine),
    artifactProtocol: plan.artifactProtocol,
    officialTrialRunner: "tools/agent-benchmark/run-v2.mjs",
  });
  plan.authorDispatch = await put(resolve(root, "dispatch.json"), {
    officialTrialOrder: steps.map((step) => step.engine),
    dispatchFreeze: plan.dispatchFreeze,
  });
  for (const step of steps)
    step.argv.push(
      "--root",
      plan.scratchRoot,
      "--audit-dir",
      resolve(ops, step.operationName, "lifecycle-audits"),
      "--output",
      step.outputRoot,
    );
  if (capacity) {
    const policy = {
      schema: "aperture.runtime-capacity-policy.v1",
      root: plan.scratchRoot,
      stateDirectory: resolve(root, "capacity-state"),
      slots: steps.map((step) => ({ id: "slot-" + step.ordinal })),
    };
    plan.capacityPolicy = await put(
      resolve(root, "capacity-policy.json"),
      policy,
    );
    for (const step of steps)
      step.argv.unshift(
        "--capacity-policy",
        plan.capacityPolicy.path,
        "--capacity-policy-sha256",
        plan.capacityPolicy.sha256,
        "--capacity-slot",
        "slot-" + step.ordinal,
      );
  }
  const operations = [];
  for (const step of steps) {
    const trial = summary.engines[step.engine].trials.find(
      (row) => row.trial === step.trial,
    );
    const operationRoot = resolve(ops, step.operationName),
      run = officialRun(step.engine, step.trial);
    const recordNames = {
      outcome: "outcome.json",
      inputs: "inputs.json",
      receipts: "receipts.json",
      measurement: "measurement.json",
      renderer: "verified-runner.json",
    };
    const retainedAttemptRecords = {};
    for (const [key, name] of Object.entries(recordNames)) {
      const path = resolve(step.outputRoot, name);
      const value = existingApp
        ? await readFile(path)
        : key === "inputs"
          ? {
              engine: step.engine,
              trial: step.trial,
              lifecycle: { run, root: plan.scratchRoot },
              inputs: trial.appInputs,
            }
          : key === "outcome"
            ? { status: "passed" }
            : { schema: "fixture-" + key };
      retainedAttemptRecords[name] = await put(path, value);
      trial.hashes[key] = retainedAttemptRecords[name].sha256;
    }
    const startedAt = new Date(
        Date.UTC(2026, 0, 1, 0, 0, step.ordinal * 2),
      ).toISOString(),
      finishedAt = new Date(Date.parse(startedAt) + 1000).toISOString();
    // Keep real >2^53 timestamps in raw bytes, including a 1ns ordering witness.
    const manifestRaw = Buffer.from(
      `{"schema":"aperture.disposable-run.v2","state":"completed","run_id":"${run}","job":"${step.job}","exitcode":0,"created_ns":1791855961897657312,"completed_ns":1791855961897657314,"files":{"chromium":{"kind":"download-cache","sha256":"${"c".repeat(64)}","size":10}}}\n`,
    );
    const auditRaw = Buffer.from(
      `{"event":"run-start","root":"${plan.scratchRoot}","job":"${step.job}","run":"${run}","at_ns":1791855961897657313}\n{"event":"run-completed","root":"${plan.scratchRoot}","run":"${run}","exitcode":0,"at_ns":1791855961897657315}\n`,
    );
    const lifecycle = {
      status: "completed-after-descendants-reaped",
      run,
      childExitCode: 0,
      audit: await put(
        resolve(operationRoot, "lifecycle-audits", "cleanup-fixture.jsonl"),
        auditRaw,
      ),
      manifest: await put(
        resolve(operationRoot, "completed-lifecycle-manifest.json"),
        manifestRaw,
      ),
    };
    if (capacity) {
      const slot = "slot-" + step.ordinal,
        slotRoot = resolve(root, "capacity-state", "slot-" + slot);
      const mf = await put(
        resolve(slotRoot, "completed-lifecycle-manifest.json"),
        manifestRaw,
      );
      const audit = await put(
        resolve(slotRoot, "lifecycle-audit.jsonl"),
        auditRaw,
      );
      lifecycle.capacityLifecycleJoin = {
        originalManifestSha256: mf.sha256,
        currentManifestSha256: mf.sha256,
        cacheRetirementBridge: null,
        checkpoint: await put(resolve(slotRoot, "checkpoint.json"), {
          schema: "aperture.capacity-completed-checkpoint.v1",
          policySha256: plan.capacityPolicy.sha256,
          slot,
          run,
          job: step.job,
          wrapperExitCode: 0,
          manifest: { ...mf, path: "completed-lifecycle-manifest.json" },
          audit: { ...audit, path: "lifecycle-audit.jsonl" },
        }),
      };
    }
    const operation = {
      schema: "aperture.official-trial-operation.v1",
      ordinal: step.ordinal,
      engine: step.engine,
      trial: step.trial,
      startedAt,
      finishedAt,
      wrapperExitCode: 0,
      processWallSeconds: 1,
      status: "completed-attempt",
      scenePassed: true,
      outcome: await load(resolve(step.outputRoot, "outcome.json")),
      stdout: await put(
        resolve(operationRoot, "stdout.bin"),
        Buffer.from("actual child output\n"),
      ),
      stderr: await put(resolve(operationRoot, "stderr.bin"), Buffer.alloc(0)),
      lifecycle,
      retainedAttemptRecords,
    };
    await put(resolve(operationRoot, "command.json"), {
      schema: "aperture.official-trial-command.v1",
      ordinal: step.ordinal,
      engine: step.engine,
      trial: step.trial,
      argv: step.argv,
      cwd: plan.cwd,
      environmentOverlay: { APERTURE_WEBGPU_RUNTIME: plan.runtimeRoot },
      appInputs: authors[step.engine],
      outputDirectoryPrecreated: false,
    });
    await put(resolve(operationRoot, "operation.json"), operation);
    operations.push({ root: operationRoot, value: operation, step });
  }
  const launchPlan = await put(resolve(ops, "launch-plan.json"), plan);
  const rootAuthorization = await put(resolve(ops, "root-authorization.json"), {
    schema: "aperture.official-trial-authorization.v1",
    round: plan.round,
    planSha256: launchPlan.sha256,
    authorizedBy: "/root",
    status: "authorized",
    finalAuthorAuditsReviewed: true,
    noFurtherAuthorEdits: true,
    previewCoordinatorExited: true,
    measurementWindowExclusive: true,
    lifecycleQuiescenceReviewed: true,
    authorAudits: Object.fromEntries(
      Object.entries(authors).map(([engine, value]) => [
        engine,
        value.auditPin,
      ]),
    ),
    ...(capacity ? { capacityPolicy: plan.capacityPolicy } : {}),
  });
  const start = {
    schema: "aperture.official-trial-execution.v1",
    startedAt: "2026-01-01T00:00:00.000Z",
    planSha256: launchPlan.sha256,
    authorizationSha256: rootAuthorization.sha256,
    launchPlan,
    rootAuthorization,
    driver: plan.driver,
    retainedDriver: await put(
      resolve(ops, "driver.py"),
      await readFile(plan.driver.path),
    ),
    authors,
  };
  const execution = await put(resolve(ops, "execution-start.json"), start);
  return {
    root,
    summary,
    plan,
    start,
    operations,
    options: {
      officialExecutionPath: execution.path,
      officialExecutionSha256: execution.sha256,
    },
    verifyOptions: {
      roundRoot: summary.roundRoot,
      executionPath: execution.path,
      executionSha256: execution.sha256,
      engines: summary.engines,
      methodSha256: summary.methodSha256,
      dispatchFreezeSha256: summary.dispatchFreezeSha256,
    },
  };
}
