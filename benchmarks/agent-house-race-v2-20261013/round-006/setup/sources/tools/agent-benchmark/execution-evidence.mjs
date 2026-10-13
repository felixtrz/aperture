import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { sha256 } from "./recorder.mjs";

export const EXECUTION_EVIDENCE_SCHEMA =
  "aperture.official-execution-evidence.v1";
export const EXECUTION_VALIDATED = "validated-six-official-completions";
const engines = ["three", "aperture"];
const hash = (value) => /^[a-f0-9]{64}$/.test(value ?? "");
const requireEvidence = (condition, message) => {
  if (!condition) throw new Error(message);
};
const same = isDeepStrictEqual;
// Lifecycle nanoseconds exceed Number.MAX_SAFE_INTEGER. Preserve their exact
// integer tokens; rounded numbers must never establish ordering or identity.
const parse = (raw) =>
  JSON.parse(raw, (_key, value, context) => {
    if (
      typeof value === "number" &&
      Number.isInteger(value) &&
      !Number.isSafeInteger(value)
    ) {
      requireEvidence(
        /^-?\d+$/.test(context?.source ?? ""),
        "Exact lifecycle integer parsing unavailable",
      );
      return BigInt(context.source);
    }
    return value;
  });
const ns = (value) => {
  requireEvidence(
    typeof value === "bigint" || Number.isSafeInteger(value),
    "Invalid lifecycle nanosecond integer",
  );
  const result = BigInt(value);
  requireEvidence(result > 0n, "Invalid lifecycle nanosecond timing");
  return result;
};
const childPath = (root, name) => {
  requireEvidence(
    typeof name === "string" &&
      name.length > 0 &&
      !isAbsolute(name) &&
      !name.includes("\\") &&
      !name.includes("\0") &&
      name.split("/").every((part) => part && part !== "." && part !== ".."),
    "Unsafe evidence child path",
  );
  return resolve(root, name);
};
async function readExact(path) {
  requireEvidence(
    typeof path === "string" && isAbsolute(path) && resolve(path) === path,
    "Canonical absolute evidence path required",
  );
  const stat = await lstat(path);
  requireEvidence(
    stat.isFile() &&
      !stat.isSymbolicLink() &&
      stat.size <= 128 * 1024 * 1024 &&
      (await realpath(path)) === path,
    "Evidence must be a bounded regular file without symlinks",
  );
  const bytes = await readFile(path);
  return { bytes, pin: { path, bytes: bytes.length, sha256: sha256(bytes) } };
}
async function pinned(pin, expectedPath, json = true) {
  requireEvidence(
    pin &&
      hash(pin.sha256) &&
      Number.isSafeInteger(pin.bytes) &&
      pin.bytes >= 0 &&
      (!expectedPath || pin.path === expectedPath),
    "Missing or mismatched evidence pin/path",
  );
  const record = await readExact(pin.path);
  requireEvidence(
    same(record.pin, pin),
    `Evidence byte hash differs: ${pin.path}`,
  );
  return {
    ...record,
    ...(json ? { value: parse(record.bytes.toString("utf8")) } : {}),
  };
}
async function jsonFile(path) {
  const record = await readExact(path);
  return { ...record, value: parse(record.bytes.toString("utf8")) };
}
function argument(argv, name) {
  requireEvidence(
    Array.isArray(argv) &&
      argv.filter((item) => item === name).length === 1 &&
      typeof argv[argv.indexOf(name) + 1] === "string",
    `Unique ${name} argument required`,
  );
  return argv[argv.indexOf(name) + 1];
}

async function capacityCompletion(plan, step, lifecycle, manifest, audit) {
  const join = lifecycle.capacityLifecycleJoin;
  if (!plan.capacityPolicy) {
    requireEvidence(!join, "Undeclared capacity lifecycle join");
    return null;
  }
  const policyRecord = plan.capacityPolicy;
  const policy = await jsonFile(policyRecord.path);
  requireEvidence(
    policy.pin.sha256 === policyRecord.sha256 &&
      policy.value.schema === "aperture.runtime-capacity-policy.v1" &&
      policy.value.root === plan.scratchRoot,
    "Capacity policy hash/root differs",
  );
  const slot = argument(step.argv, "--capacity-slot");
  requireEvidence(
    argument(step.argv, "--capacity-policy") === policyRecord.path &&
      argument(step.argv, "--capacity-policy-sha256") === policyRecord.sha256 &&
      policy.value.slots.some((entry) => entry.id === slot),
    "Capacity slot/policy differs from frozen command",
  );
  const slotRoot = resolve(policy.value.stateDirectory, "slot-" + slot);
  const checkpoint = await pinned(
    join?.checkpoint,
    resolve(slotRoot, "checkpoint.json"),
  );
  const value = checkpoint.value;
  requireEvidence(
    value.schema === "aperture.capacity-completed-checkpoint.v1" &&
      value.policySha256 === policy.pin.sha256 &&
      value.slot === slot &&
      value.run === lifecycle.run &&
      value.job === step.job &&
      value.wrapperExitCode === 0,
    "Original capacity checkpoint identity/completion differs",
  );
  const original = await pinned(
    { ...value.manifest, path: childPath(slotRoot, value.manifest?.path) },
    resolve(slotRoot, "completed-lifecycle-manifest.json"),
  );
  const checkpointAudit = await pinned(
    { ...value.audit, path: childPath(slotRoot, value.audit?.path) },
    resolve(slotRoot, "lifecycle-audit.jsonl"),
    false,
  );
  requireEvidence(
    original.pin.sha256 === manifest.pin.sha256 &&
      checkpointAudit.pin.sha256 === audit.pin.sha256 &&
      join.originalManifestSha256 === manifest.pin.sha256 &&
      hash(join.currentManifestSha256),
    "Capacity original manifest/audit SHA join differs",
  );
  const proof = {
    policy: policy.pin,
    checkpoint: checkpoint.pin,
    originalManifest: original.pin,
    audit: checkpointAudit.pin,
    cacheRetirementBridge: null,
  };
  if (!join.cacheRetirementBridge) {
    requireEvidence(
      join.currentManifestSha256 === manifest.pin.sha256,
      "Changed capacity manifest lacks cache-only bridge",
    );
    return proof;
  }
  const bridge = join.cacheRetirementBridge;
  const applyRoot = bridge.retirement?.evidence_directory;
  requireEvidence(
    policy.value.slots.some(
      (entry) =>
        resolve(
          policy.value.stateDirectory,
          "slot-" + entry.id,
          "pressure-apply",
        ) === applyRoot,
    ),
    "Cache bridge outside bounded policy maintenance",
  );
  const maintenance = await pinned(
    bridge.policyMaintenance,
    resolve(dirname(applyRoot), "maintenance.json"),
  );
  const outcome = await pinned(
    bridge.outcome,
    resolve(applyRoot, "outcome.json"),
  );
  requireEvidence(
    maintenance.value.policySha256 === policy.pin.sha256 &&
      same(maintenance.value.outcome, outcome.pin) &&
      ["completed-target-reached", "completed-bounded-plan-exhausted"].includes(
        outcome.value.status,
      ),
    "Unresolved/mismatched cache maintenance",
  );
  const matches = outcome.value.results.filter(
    (item) => item.run === lifecycle.run,
  );
  requireEvidence(
    matches.length === 1,
    "Unique cache retirement result required",
  );
  const result = matches[0];
  const before = await readExact(childPath(applyRoot, result.beforeManifest));
  const after = await pinned({
    ...result.afterManifest,
    path: childPath(applyRoot, result.afterManifest?.path),
  });
  requireEvidence(
    before.pin.sha256 === manifest.pin.sha256 &&
      result.originalManifestSha256 === manifest.pin.sha256 &&
      bridge.originalManifestSha256 === manifest.pin.sha256 &&
      result.afterManifestSha256 === after.pin.sha256 &&
      join.currentManifestSha256 === after.pin.sha256 &&
      bridge.afterManifestSha256 === after.pin.sha256,
    "Cache before/after manifest SHA join differs",
  );
  const expected = structuredClone(manifest.value);
  const retired = expected.files?.chromium;
  requireEvidence(
    retired !== undefined,
    "Cache bridge has no original chromium registration",
  );
  delete expected.files.chromium;
  const prior = expected.cache_retirements ?? [];
  const retirement = bridge.retirement;
  requireEvidence(
    retirement.name === "chromium" &&
      retirement.original_manifest_sha256 === manifest.pin.sha256 &&
      retirement.plan_sha256 === outcome.value.planSha256 &&
      same(retirement.retired_registration, retired),
    "Cache retirement registration/provenance differs",
  );
  expected.cache_retirements = [...prior, retirement];
  requireEvidence(
    same(expected, after.value),
    "Retirement changes more than chromium registration/provenance",
  );
  proof.cacheRetirementBridge = {
    maintenance: maintenance.pin,
    outcome: outcome.pin,
    before: before.pin,
    after: after.pin,
  };
  return proof;
}

async function verifyOperation(plan, start, step, trial, author) {
  requireEvidence(
    trial?.status === "validated" && trial.path === step.outputRoot,
    "Selected successful app trial/path required",
  );
  const operationRoot = childPath(plan.operationsRoot, step.operationName);
  requireEvidence(
    argument(step.argv, "--root") === plan.scratchRoot &&
      argument(step.argv, "--job") === step.job &&
      argument(step.argv, "--audit-dir") ===
        resolve(operationRoot, "lifecycle-audits") &&
      argument(step.argv, "--engine") === step.engine &&
      argument(step.argv, "--trial") === String(step.trial) &&
      argument(step.argv, "--output") === step.outputRoot &&
      argument(step.argv, "--app") === start.authors[step.engine].appRoot,
    "Official runner argv identity differs",
  );
  const command = await jsonFile(resolve(operationRoot, "command.json"));
  const operation = await jsonFile(resolve(operationRoot, "operation.json"));
  const control = command.value,
    value = operation.value;
  requireEvidence(
    control.schema === "aperture.official-trial-command.v1" &&
      control.ordinal === step.ordinal &&
      control.engine === step.engine &&
      control.trial === step.trial &&
      same(control.argv, step.argv) &&
      control.cwd === plan.cwd &&
      same(control.environmentOverlay, {
        APERTURE_WEBGPU_RUNTIME: plan.runtimeRoot,
      }) &&
      same(control.appInputs, start.authors[step.engine]) &&
      control.outputDirectoryPrecreated === false,
    "Official command/author inputs differ from launch plan",
  );
  requireEvidence(
    value.schema === "aperture.official-trial-operation.v1" &&
      value.status === "completed-attempt" &&
      value.scenePassed === true &&
      value.wrapperExitCode === 0 &&
      value.ordinal === step.ordinal &&
      value.engine === step.engine &&
      value.trial === step.trial &&
      value.outcome?.status === "passed" &&
      Number.isFinite(value.processWallSeconds) &&
      value.processWallSeconds >= 0,
    "Original official operation did not complete successfully",
  );
  requireEvidence(
    Number.isFinite(Date.parse(value.startedAt)) &&
      Date.parse(value.finishedAt) >= Date.parse(value.startedAt) &&
      Date.parse(value.startedAt) >= Date.parse(start.startedAt),
    "Invalid official operation timing",
  );
  const stdout = await pinned(
    value.stdout,
    resolve(operationRoot, "stdout.bin"),
    false,
  );
  const stderr = await pinned(
    value.stderr,
    resolve(operationRoot, "stderr.bin"),
    false,
  );
  const lifecycle = value.lifecycle;
  requireEvidence(
    lifecycle?.status === "completed-after-descendants-reaped" &&
      /^run-[a-f0-9]{32}$/.test(lifecycle.run ?? "") &&
      lifecycle.childExitCode === 0,
    "Original completed/reaped lifecycle required",
  );
  const auditRoot = resolve(operationRoot, "lifecycle-audits");
  const auditFiles = (await readdir(auditRoot)).filter((name) =>
    name.endsWith(".jsonl"),
  );
  requireEvidence(
    auditFiles.length === 1,
    "Unique original lifecycle audit file required",
  );
  const audit = await pinned(
    lifecycle.audit,
    childPath(auditRoot, auditFiles[0]),
    false,
  );
  const events = audit.bytes
    .toString("utf8")
    .split("\n")
    .filter(Boolean)
    .map(parse);
  const starts = events.filter((event) => event.event === "run-start"),
    finishes = events.filter((event) => event.event === "run-completed");
  requireEvidence(
    starts.length === 1 &&
      finishes.length === 1 &&
      !events.some((event) =>
        ["run-error", "run-completion-audit-failed"].includes(event.event),
      ),
    "Genuine unique lifecycle start and completion audit required",
  );
  const first = starts[0],
    last = finishes[0];
  requireEvidence(
    first.root === plan.scratchRoot &&
      last.root === plan.scratchRoot &&
      first.job === step.job &&
      first.run === lifecycle.run &&
      last.run === lifecycle.run &&
      last.exitcode === 0 &&
      events.indexOf(last) > events.indexOf(first) &&
      ns(last.at_ns) >= ns(first.at_ns),
    "Lifecycle audit run/job/exit/timing differs",
  );
  const manifest = await pinned(
    lifecycle.manifest,
    resolve(operationRoot, "completed-lifecycle-manifest.json"),
  );
  const mf = manifest.value;
  requireEvidence(
    mf.schema === "aperture.disposable-run.v2" &&
      mf.state === "completed" &&
      mf.run_id === lifecycle.run &&
      mf.job === step.job &&
      mf.exitcode === 0 &&
      ns(mf.completed_ns) >= ns(mf.created_ns) &&
      ns(first.at_ns) >= ns(mf.created_ns) &&
      ns(first.at_ns) <= ns(mf.completed_ns) &&
      ns(last.at_ns) >= ns(mf.completed_ns),
    "Original completed lifecycle manifest differs",
  );
  const retained = {};
  for (const [key, name] of Object.entries({
    outcome: "outcome.json",
    inputs: "inputs.json",
    receipts: "receipts.json",
    measurement: "measurement.json",
    renderer: "verified-runner.json",
  })) {
    const record = await pinned(
      value.retainedAttemptRecords?.[name],
      resolve(step.outputRoot, name),
    );
    requireEvidence(
      record.pin.sha256 === trial.hashes?.[key],
      `Official/app ${name} hash differs`,
    );
    retained[key] = record;
  }
  requireEvidence(
    same(retained.outcome.value, value.outcome) &&
      retained.inputs.value.engine === step.engine &&
      retained.inputs.value.trial === step.trial &&
      retained.inputs.value.lifecycle?.run === lifecycle.run &&
      retained.inputs.value.lifecycle?.root === plan.scratchRoot &&
      same(
        retained.inputs.value.inputs,
        start.authors[step.engine].appInputs,
      ) &&
      same(trial.appInputs, start.authors[step.engine].appInputs),
    "Official operation/app lifecycle and input identity differ",
  );
  requireEvidence(
    author?.status === "validated-source-and-time" &&
      author.auditSha256 === start.authors[step.engine].auditPin?.sha256 &&
      author.finishSha256 === start.authors[step.engine].finishSha256 &&
      start.authors[step.engine].appRoot ===
        resolve(author.auditRoot, "source", "dist"),
    "Official author audit/finish differs from summary",
  );
  const capacity = await capacityCompletion(
    plan,
    step,
    lifecycle,
    manifest,
    audit,
  );
  return {
    ordinal: step.ordinal,
    engine: step.engine,
    trial: step.trial,
    job: step.job,
    run: lifecycle.run,
    startedAt: value.startedAt,
    finishedAt: value.finishedAt,
    operation: operation.pin,
    command: command.pin,
    stdout: stdout.pin,
    stderr: stderr.pin,
    audit: audit.pin,
    manifest: manifest.pin,
    appRecords: Object.fromEntries(
      Object.entries(retained).map(([key, record]) => [key, record.pin]),
    ),
    capacity,
  };
}

/** Verifies surviving original supervision bytes; never executes or repairs a run. */
export async function verifyOfficialExecution({
  roundRoot,
  executionPath,
  executionSha256,
  engines: engineResults,
  methodSha256,
  dispatchFreezeSha256,
}) {
  const result = {
    schema: EXECUTION_EVIDENCE_SCHEMA,
    status: "invalid-official-execution",
    executionStart: null,
    operations: [],
    validationErrors: [],
  };
  try {
    requireEvidence(
      hash(executionSha256),
      "Exact official execution-start SHA256 required",
    );
    const startRecord = await readExact(executionPath);
    requireEvidence(
      startRecord.pin.sha256 === executionSha256,
      "Official execution-start hash differs",
    );
    result.executionStart = startRecord.pin;
    const start = parse(startRecord.bytes.toString("utf8"));
    const operationsRoot = dirname(executionPath);
    requireEvidence(
      executionPath === resolve(operationsRoot, "execution-start.json") &&
        operationsRoot.startsWith(roundRoot + "/") &&
        start.schema === "aperture.official-trial-execution.v1" &&
        Number.isFinite(Date.parse(start.startedAt)),
      "Official execution identity/path differs",
    );
    const planRecord = await pinned(
      start.launchPlan,
      resolve(operationsRoot, "launch-plan.json"),
    );
    const authorization = await pinned(
      start.rootAuthorization,
      resolve(operationsRoot, "root-authorization.json"),
    );
    const plan = planRecord.value,
      auth = authorization.value;
    const retainedDriver = await pinned(
      start.retainedDriver,
      resolve(operationsRoot, "driver.py"),
      false,
    );
    requireEvidence(
      plan.schema === "aperture.official-trial-plan.v1" &&
        plan.roundRoot === roundRoot &&
        plan.round === roundRoot.split("/").at(-1) &&
        plan.operationsRoot === operationsRoot &&
        start.planSha256 === planRecord.pin.sha256 &&
        start.authorizationSha256 === authorization.pin.sha256 &&
        same(start.driver, plan.driver) &&
        retainedDriver.pin.sha256 === plan.driver?.sha256 &&
        retainedDriver.pin.bytes === plan.driver?.bytes,
      "Frozen plan/source/retained driver differs",
    );
    requireEvidence(
      auth.schema === "aperture.official-trial-authorization.v1" &&
        auth.round === plan.round &&
        auth.planSha256 === planRecord.pin.sha256 &&
        auth.authorizedBy === "/root" &&
        auth.status === "authorized" &&
        [
          "finalAuthorAuditsReviewed",
          "noFurtherAuthorEdits",
          "previewCoordinatorExited",
          "measurementWindowExclusive",
          "lifecycleQuiescenceReviewed",
        ].every((key) => auth[key] === true),
      "Root official execution authorization incomplete",
    );
    requireEvidence(
      plan.method?.sha256 === methodSha256 &&
        plan.dispatchFreeze?.sha256 === dispatchFreezeSha256 &&
        same(auth.capacityPolicy, plan.capacityPolicy),
      "Official frozen method/dispatch/capacity policy differs",
    );
    const method = await pinned(plan.method);
    const freeze = await pinned(plan.dispatchFreeze);
    requireEvidence(
      method.pin.sha256 === methodSha256 &&
        freeze.pin.sha256 === dispatchFreezeSha256 &&
        Array.isArray(plan.sourcePins) &&
        plan.sourcePins.length > 0,
      "Official method/freeze/source inventory incomplete",
    );
    const sourceProofs = [];
    for (const source of plan.sourcePins) {
      const frozen = freeze.value.provenance?.inputs?.[source.repositoryPath];
      requireEvidence(
        frozen &&
          frozen.sha256 === source.sha256 &&
          frozen.bytes === source.bytes &&
          source.path === childPath(plan.cwd, source.repositoryPath),
        "Official source differs from frozen input provenance",
      );
      const snapshotPath = childPath(plan.cwd, frozen.snapshotPath);
      const snapshot = await pinned(
        source.survivingFrozenCopy,
        snapshotPath,
        false,
      );
      requireEvidence(
        snapshot.pin.sha256 === source.sha256 &&
          snapshot.pin.bytes === source.bytes,
        "Official retained source differs",
      );
      sourceProofs.push({
        repositoryPath: source.repositoryPath,
        snapshot: snapshot.pin,
      });
    }
    requireEvidence(
      plan.sourcePins.some(
        (source) =>
          source.path === plan.driver.path &&
          source.sha256 === plan.driver.sha256 &&
          source.bytes === plan.driver.bytes,
      ),
      "Official driver absent from frozen source inventory",
    );
    const preparation = await pinned(plan.preparation);
    const dispatch = await pinned(plan.authorDispatch);
    const selectedOrder = plan.steps?.map((step) => step.engine);
    requireEvidence(
      same(preparation.value.trialOrder, selectedOrder) &&
        same(dispatch.value.officialTrialOrder, selectedOrder) &&
        preparation.value.artifactProtocol === plan.artifactProtocol &&
        preparation.value.officialTrialRunner ===
          "tools/agent-benchmark/run-v2.mjs" &&
        dispatch.value.dispatchFreeze?.sha256 === freeze.pin.sha256,
      "Official order/protocol differs from frozen preparation/dispatch",
    );
    for (const engine of engines) {
      const audit = await pinned(start.authors?.[engine]?.auditPin);
      requireEvidence(
        same(audit.pin, auth.authorAudits?.[engine]),
        "Root/driver author audit pin differs",
      );
    }
    requireEvidence(
      Array.isArray(plan.steps) && plan.steps.length === 6,
      "Exactly six preselected official operations required",
    );
    const selected = new Set();
    for (const [index, step] of plan.steps.entries()) {
      requireEvidence(
        step.ordinal === index + 1 &&
          engines.includes(step.engine) &&
          [1, 2, 3].includes(step.trial) &&
          step.operationName ===
            `${String(step.ordinal).padStart(2, "0")}-${step.engine}-trial-${String(step.trial).padStart(2, "0")}` &&
          step.outputRoot ===
            resolve(
              roundRoot,
              "trials",
              step.engine,
              `trial-${String(step.trial).padStart(2, "0")}`,
            ) &&
          typeof step.job === "string" &&
          step.job.length > 0,
        "Official selected operation/order/path differs",
      );
      const key = step.engine + "/" + step.trial;
      requireEvidence(
        !selected.has(key),
        "Duplicate official engine/trial selection",
      );
      selected.add(key);
      try {
        const entry = engineResults?.[step.engine];
        const proof = await verifyOperation(
          plan,
          start,
          step,
          entry?.trials?.find((trial) => trial.trial === step.trial),
          entry?.author,
        );
        const prior = result.operations.at(-1);
        requireEvidence(
          !prior || Date.parse(proof.startedAt) >= Date.parse(prior.finishedAt),
          "Official operations overlap or reverse their frozen order",
        );
        requireEvidence(
          !result.operations.some((row) => row.run === proof.run),
          "Duplicate official lifecycle run identity",
        );
        result.operations.push(proof);
      } catch (error) {
        result.validationErrors.push({
          engine: step.engine,
          trial: step.trial,
          error: error.message,
        });
      }
    }
    result.launchPlan = planRecord.pin;
    result.rootAuthorization = authorization.pin;
    result.retainedDriver = retainedDriver.pin;
    result.sources = sourceProofs;
    result.method = method.pin;
    result.dispatchFreeze = freeze.pin;
    result.preparation = preparation.pin;
    result.authorDispatch = dispatch.pin;
    if (!result.validationErrors.length && result.operations.length === 6)
      result.status = EXECUTION_VALIDATED;
  } catch (error) {
    result.validationErrors.push({ error: error.message });
  }
  return result;
}

/** Shape guard for pure scoring; file scoring also re-verifies every byte join. */
export function hasCompleteOfficialExecution(summary) {
  const proof = summary?.executionEvidence;
  return (
    proof?.schema === EXECUTION_EVIDENCE_SCHEMA &&
    proof.status === EXECUTION_VALIDATED &&
    Array.isArray(proof.validationErrors) &&
    proof.validationErrors.length === 0 &&
    hash(proof.executionStart?.sha256) &&
    Array.isArray(proof.operations) &&
    proof.operations.length === 6 &&
    proof.operations.every(
      (row, index) =>
        row &&
        row.ordinal === index + 1 &&
        /^run-[a-f0-9]{32}$/.test(row.run ?? ""),
    ) &&
    new Set(proof.operations.map((row) => row.run)).size === 6 &&
    engines.every((engine) =>
      [1, 2, 3].every((number) => {
        const matches = proof.operations.filter(
          (row) => row.engine === engine && row.trial === number,
        );
        const trial = summary.engines?.[engine]?.trials?.find(
          (row) => row.trial === number,
        );
        return (
          matches.length === 1 &&
          hash(matches[0].operation?.sha256) &&
          hash(matches[0].audit?.sha256) &&
          hash(matches[0].manifest?.sha256) &&
          same(Object.keys(matches[0].appRecords ?? {}).sort(), [
            "inputs",
            "measurement",
            "outcome",
            "receipts",
            "renderer",
          ]) &&
          Object.entries(matches[0].appRecords).every(
            ([key, pin]) =>
              hash(pin?.sha256) && pin.sha256 === trial?.hashes?.[key],
          )
        );
      }),
    )
  );
}
