"""Opt-in cooperative capacity admission and completed-job cache maintenance.

No prospective reclamation is credited. A reviewed policy may treat the next
Chromium allocation as a controlled peak: every successor still needs a fresh
admission after observed completion, immutable checkpoint and bounded maintenance.
Operational reserves are estimates, not disk quotas or hostile-actor confinement.
"""
from __future__ import annotations

import contextlib
import dataclasses
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "recovery"))
import cleanup as c
import pressure_cache_retirement as pressure
from capacity_budget import FLOOR_BYTES, CHROMIUM_BYTES, Growth, Job, budget

SCHEMA = "aperture.runtime-capacity-policy.v1"
HELPER_SHA = "381320c9f4e26ac1e5e3553362eb979024dd3c7f1cc378133ba6bced7e27549c"
POLICY_MAX_SLOTS = 256


def read(path, limit=c.MAX_JSON):
    path = os.fspath(path)
    c.require(os.path.isabs(path) and os.path.normpath(path) == path, "Canonical absolute capacity input required")
    with c.PinnedDirectory(os.path.dirname(path)) as parent:
        raw, st, sha = c.read_file(parent.fd, os.path.basename(path), limit)
        parent.verify()
    return raw, st, sha


def pinned(path, expected):
    raw, st, sha = read(path)
    c.require(not st.st_mode & 0o222 and sha == expected, "Immutable capacity input SHA differs")
    return json.loads(raw, object_pairs_hook=c.unique_pairs)


def integer(value, name, maximum=2**63-1):
    c.require(type(value) is int and 0 <= value <= maximum, "Invalid " + name)
    return value


def source_pin(path):
    path = os.fspath(path)
    with c.PinnedDirectory(os.path.dirname(path)) as parent:
        _, st, sha = c.read_file(parent.fd, os.path.basename(path))
        parent.verify()
    return {"path": path, "bytes": st.st_size, "sha256": sha}


def validate_policy(value):
    c.require(value.get("schema") == SCHEMA and value.get("status") == "root-reviewed", "Reviewed capacity policy required")
    c.require(value.get("root") == pressure.ROOT and value.get("runtimeRoot") == pressure.RUNTIME_ROOT, "Capacity root/runtime differs from pinned installations")
    c.require(value.get("floorBytes") == FLOOR_BYTES, "Capacity cannot change the 2-GiB floor")
    c.require(isinstance(value.get("rootMarker"), dict), "Exact root marker binding required")
    c.require(value.get("declaredReservesAcknowledged") is True, "Root must acknowledge operational reserve limitations")
    c.require(value.get("cacheLifetime") in ("retained", "controlled-post-close"), "Unknown cache lifetime")
    slots = value.get("slots")
    c.require(isinstance(slots, list) and 0 < len(slots) <= POLICY_MAX_SLOTS, "Bounded capacity slots required")
    c.require(len({item.get("id") for item in slots}) == len(slots), "Duplicate capacity slot")
    for item in slots:
        c.require(isinstance(item.get("id"), str) and re.fullmatch(r"[a-z][a-z0-9-]{0,63}", item["id"]), "Invalid capacity slot identity")
        c.require(isinstance(item.get("jobPattern"), str) and len(item["jobPattern"]) <= 256, "Bounded job pattern required")
        re.compile(item["jobPattern"])
        for name in ("retainedReserveBytes", "peakReserveBytes"):
            integer(item.get(name), name)
        if "expectedInputBytes" in item:
            integer(item["expectedInputBytes"], "expected input reserve")
        if "createsPinnedChromium" in item:
            c.require(type(item["createsPinnedChromium"]) is bool, "Explicit cache allocation flag required")
    integer(value.get("externalGrowthReserveBytes"), "external growth reserve")
    for name in ("createdNs", "expiresNs"):
        integer(value.get(name), name)
    c.require(value["createdNs"] <= time.time_ns() <= value["expiresNs"] and value["expiresNs"] - value["createdNs"] <= 24 * 3600 * 10**9, "Expired/future capacity policy")
    auto = value.get("maintenance")
    c.require(isinstance(auto, dict) and type(auto.get("enabled")) is bool, "Explicit maintenance policy required")
    integer(auto.get("maximumPasses"), "maintenance pass cap", POLICY_MAX_SLOTS)
    integer(auto.get("maximumRetirements"), "maintenance retirement cap", POLICY_MAX_SLOTS + pressure.MAX_CACHES)
    c.require(value["cacheLifetime"] != "controlled-post-close" or auto["enabled"], "Controlled cache peak requires enabled post-close maintenance")
    initial = auto.get("initialKnownRuns")
    c.require(isinstance(initial, list) and len(initial) <= pressure.MAX_CACHES and len(set(initial)) == len(initial) and all(isinstance(run, str) and c.RUN_RE.fullmatch(run) for run in initial), "Bounded explicit initial cache runs required")
    state_root = value.get("stateDirectory")
    c.require(isinstance(state_root, str) and os.path.isabs(state_root) and os.path.normpath(state_root) == state_root and os.path.commonpath((state_root, value["root"])) != value["root"], "Capacity state/evidence must survive outside scratch")
    c.require(value.get("helperSource") == source_pin(Path(pressure.__file__).resolve()) and value["helperSource"]["sha256"] == HELPER_SHA, "Reviewed exact pressure helper source differs")
    for entry in value.get("sourcePins", []):
        c.require(entry == source_pin(entry["path"]), "Frozen capacity dependency source differs")
    return value


def capacity_jobs(value, remaining, actual_retained_minimum=0):
    first_cache = next((index for index, slot in enumerate(remaining) if slot.get("createsPinnedChromium", True)), None)
    jobs = []
    for index, slot in enumerate(remaining):
        retained = max(slot["retainedReserveBytes"], actual_retained_minimum if index == 0 else 0)
        creates = slot.get("createsPinnedChromium", True) and (value["cacheLifetime"] == "retained" or index == first_cache)
        jobs.append(Job(slot["id"], (Growth("retained " + slot["id"], retained, 0, "declared-reserve", "Reviewed reserve raised by fresh actual current inputs"),), (Growth("peak " + slot["id"], slot["peakReserveBytes"], 0, "declared-reserve", "Reviewed transient/browser profile reserve"),), creates))
    return jobs


@dataclasses.dataclass(frozen=True)
class Policy:
    value: dict
    sha256: str

    @classmethod
    def load(cls, path, sha256):
        return cls(validate_policy(pinned(path, sha256)), sha256)

    def session(self, slot, job, actual_retained_minimum=0):
        return Session(self, slot, job, actual_retained_minimum)

    def next_slot(self):
        path = os.path.join(self.value["stateDirectory"], "state.json")
        try:
            raw, _, _ = read(path)
        except FileNotFoundError:
            return self.value["slots"][0]
        state = json.loads(raw)
        c.require(state.get("policySha256") == self.sha256 and state.get("status") == "ready", "Capacity state unresolved; no automatic retry")
        ordinal = len(state["completedSlots"])
        c.require(ordinal < len(self.value["slots"]), "Frozen capacity phase exhausted")
        return self.value["slots"][ordinal]

    def phase_admission(self, output):
        """Create-only fresh whole-phase receipt before author clocks start.

        The external reserve includes subsequent official trials/setup/audit/judge
        growth not represented by current phase slots. It is not a reservation.
        """
        value = self.value
        with pressure.output_directory(output, value["root"]) as evidence, c.Store(c.Config(value["root"], evidence.path)) as store, store.locked(exclusive=True):
            c.require(store.marker == value["rootMarker"] and os.fstat(store.fd).st_dev == value["filesystemDevice"], "Frozen capacity root/filesystem differs")
            Session.require_quiet(store)
            fs = os.fstatvfs(store.fd)
            jobs = capacity_jobs(value, value["slots"])
            result = budget(pressure.disk_free(store.fd), fs.f_frsize, jobs, (Growth("later phases and external writers", value["externalGrowthReserveBytes"], 0, "declared-reserve", "Acknowledged full-round official/setup/author/audit/judge reserve"),), True)
            result.update(policySha256=self.sha256, observedNs=time.time_ns(), filesystemDevice=value["filesystemDevice"], cacheLifetime=value["cacheLifetime"], admissionMeaning="Conditional whole-round reserves, no quota or prospective reclamation credit.")
            pressure.immutable(evidence.fd, "admission.json", c.json_bytes(result))
            c.require(result["status"].startswith("admissible-"), "Whole-round capacity admission failed before author start")
            return result


def cli_arguments(record, slot, actual_retained_minimum):
    """Arguments for the existing runtime wrapper; no secrets/env are embedded."""
    c.require(isinstance(record, dict) and set(record) == {"path", "sha256"}, "Exact common capacity policy pin required")
    integer(actual_retained_minimum, "fresh actual retained minimum")
    Policy.load(record["path"], record["sha256"])
    return ["--capacity-policy", record["path"], "--capacity-policy-sha256", record["sha256"], "--capacity-slot", slot, "--capacity-retained-minimum-bytes", str(actual_retained_minimum)]


def start_admission(record, receipt):
    policy = Policy.load(record["path"], record["sha256"])
    value = pinned(receipt["path"], receipt["sha256"])
    c.require(source_pin(receipt["path"])["bytes"] == receipt["bytes"] and value.get("policySha256") == policy.sha256 and value.get("status") == "admissible-under-declared-reserves", "Frozen whole-round author admission differs")
    with c.PinnedDirectory(policy.value["root"]) as root:
        c.require(os.fstat(root.fd).st_dev == value["filesystemDevice"] and pressure.disk_free(root.fd) >= value["requiredFreeBytes"] >= FLOOR_BYTES, "Fresh actual free space no longer supports author admission")
    return {"policySha256": policy.sha256, "admissionSha256": receipt["sha256"], "meaning": "Conditional acknowledged whole-round reserves, freshly checked before author start."}


def checkpoint_manifest(record, slot, expected_run=None, expected_job=None):
    """Join original completed MF to current MF through exact cache-only receipts.

    Return original bytes for downstream proof copies. A removed regenerable
    executable remains historical native evidence; it is never regenerated or
    substituted here. No source/raw/unknown file is opened or removed.
    """
    policy = Policy.load(record["path"], record["sha256"])
    value = policy.value
    c.require(slot in {entry["id"] for entry in value["slots"]}, "Checkpoint slot outside frozen policy")
    operation = os.path.join(value["stateDirectory"], "slot-" + slot)
    checkpoint_pin = source_pin(os.path.join(operation, "checkpoint.json"))
    checkpoint = pinned(checkpoint_pin["path"], checkpoint_pin["sha256"])
    c.require(checkpoint["policySha256"] == policy.sha256 and checkpoint["slot"] == slot and (expected_run is None or checkpoint["run"] == expected_run) and (expected_job is None or checkpoint["job"] == expected_job), "Original completed checkpoint identity differs")
    entry = checkpoint["manifest"]
    c.require(entry["path"] == "completed-lifecycle-manifest.json", "Original checkpoint manifest path differs")
    original, original_stat, original_sha = read(os.path.join(operation, entry["path"]))
    c.require(not original_stat.st_mode & 0o222 and len(original) == entry["bytes"] and original_sha == entry["sha256"], "Immutable original manifest pin differs")
    previous = json.loads(original)
    bridge = None
    with c.Store(c.Config(value["root"], operation)) as store, store.locked(exclusive=True):
        Session.require_quiet(store)
        fd = c.open_run(store, checkpoint["run"])
        try:
            with c.registry_lock(fd):
                current_raw, _, current_sha = c.read_file(fd, c.MANIFEST, c.MAX_JSON)
                current = json.loads(current_raw)
                c.validate_manifest(previous, checkpoint["run"])
                c.validate_manifest(current, checkpoint["run"])
                c.require(previous["state"] == "completed" and previous["job"] == checkpoint["job"], "Original completed job differs")
                if current_sha != original_sha:
                    provenance = current.get("cache_retirements", [])
                    c.require(isinstance(provenance, list) and len(provenance) > 0, "Current manifest lacks exact cache retirement provenance")
                    apply_dir = provenance[-1].get("evidence_directory")
                    allowed_dirs = {os.path.join(value["stateDirectory"], "slot-" + entry["id"], "pressure-apply") for entry in value["slots"]}
                    c.require(apply_dir in allowed_dirs, "Retirement belongs outside bounded policy-owned maintenance receipts")
                    maintenance_pin = source_pin(os.path.join(os.path.dirname(apply_dir), "maintenance.json"))
                    maintenance = pinned(maintenance_pin["path"], maintenance_pin["sha256"])
                    c.require(maintenance.get("policySha256") == policy.sha256, "Retirement receipt belongs to another policy")
                    outcome_pin = source_pin(os.path.join(apply_dir, "outcome.json"))
                    outcome = pinned(outcome_pin["path"], outcome_pin["sha256"])
                    c.require(maintenance.get("outcome") == outcome_pin, "Policy maintenance/outcome source pin differs")
                    c.require(outcome["status"] in ("completed-target-reached", "completed-bounded-plan-exhausted"), "Cache retirement outcome is unresolved")
                    matches = [item for item in outcome["results"] if item["run"] == checkpoint["run"]]
                    c.require(len(matches) == 1, "Exact original-run retirement bridge missing")
                    item = matches[0]
                    c.require(item["originalManifestSha256"] == original_sha and item["afterManifestSha256"] == current_sha, "Before/after/current cache-only SHA join differs")
                    for name, expected in ((item["beforeManifest"], original_sha), (item["afterManifest"]["path"], current_sha)):
                        raw, st, sha = read(os.path.join(apply_dir, name))
                        c.require(not st.st_mode & 0o222 and sha == expected, "Immutable retirement manifest differs")
                    unchanged = dict(previous)
                    unchanged["files"] = dict(previous["files"])
                    retired = unchanged["files"].pop(pressure.NAME)
                    changes = current.get("cache_retirements", [])
                    prior = previous.get("cache_retirements", [])
                    c.require(len(changes) == len(prior) + 1 and changes[:-1] == prior, "Unrelated retirement records changed")
                    last = changes[-1]
                    c.require(last["name"] == pressure.NAME and last["original_manifest_sha256"] == original_sha and last["retired_registration"] == retired and last["evidence_directory"] == apply_dir and last["plan_sha256"] == outcome["planSha256"], "Truthful exact cache retirement provenance differs")
                    unchanged["cache_retirements"] = changes
                    c.require(current == unchanged and not os.path.lexists(os.path.join(value["root"], checkpoint["run"], pressure.NAME)), "Retirement changed more than cache registration/provenance")
                    bridge = {"policyMaintenance": maintenance_pin, "outcome": outcome_pin, "originalManifestSha256": original_sha, "afterManifestSha256": current_sha, "retirement": last}
        finally:
            os.close(fd)
    return original, {"checkpoint": checkpoint_pin, "originalManifestSha256": original_sha, "currentManifestSha256": current_sha, "cacheRetirementBridge": bridge}


class Session:
    def __init__(self, policy, slot, job, actual_retained_minimum=0):
        self.policy, self.slot, self.job = policy, slot, job
        self.actual_retained_minimum = integer(actual_retained_minimum, "fresh actual retained minimum")
        self.pin = self.lock = self.operation = None
        self.state = None

    def __enter__(self):
        value = self.policy.value
        parent, name = os.path.split(value["stateDirectory"])
        with c.PinnedDirectory(parent) as base:
            try:
                os.mkdir(name, 0o700, dir_fd=base.fd)
                os.fsync(base.fd)
            except FileExistsError:
                pass
        try:
            self.pin = c.PinnedDirectory(value["stateDirectory"])
            try:
                c.create_file(self.pin.fd, ".capacity.lock", b"")
            except FileExistsError:
                pass
            self.lock = os.open(".capacity.lock", os.O_RDWR | os.O_NOFOLLOW | os.O_CLOEXEC, dir_fd=self.pin.fd)
            c.check_regular(os.fstat(self.lock))
            try:
                fcntl.flock(self.lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError as error:
                raise c.Busy("Capacity session busy; no overlapping admission or maintenance") from error
            try:
                self.state, _, _ = c.read_json(self.pin.fd, "state.json")
            except FileNotFoundError:
                self.state = {"schema": "aperture.runtime-capacity-state.v1", "policySha256": self.policy.sha256, "completedSlots": [], "completedRuns": [], "maintenancePasses": 0, "retiredCount": 0, "status": "ready"}
                c.create_file(self.pin.fd, "state.json", c.json_bytes(self.state))
            c.require(self.state.get("policySha256") == self.policy.sha256 and self.state.get("status") == "ready", "Wrong/blocked/unresolved capacity session; inspect retained evidence")
            ordinal = len(self.state["completedSlots"])
            c.require(ordinal < len(value["slots"]) and value["slots"][ordinal]["id"] == self.slot, "Capacity slots must execute once in frozen order")
            self.current = value["slots"][ordinal]
            c.require(re.fullmatch(self.current["jobPattern"], self.job), "Actual job differs from reviewed capacity slot")
            name = "slot-" + self.slot
            os.mkdir(name, 0o700, dir_fd=self.pin.fd)
            self.operation = c.PinnedDirectory(os.path.join(self.pin.path, name))
            self.state.update(status="accepted", currentSlot=self.slot, actualJob=self.job)
            self.persist()
            self.admit()
            return self
        except BaseException as error:
            if self.operation is not None:
                self.fail(error)
            self.close()
            raise

    def persist(self):
        self.pin.verify()
        c.replace_json(self.pin.fd, "state.json", self.state)

    def save(self, name, value):
        return pressure.immutable(self.operation.fd, name, c.json_bytes(value))

    def admit(self):
        value = self.policy.value
        c.require(value["createdNs"] <= time.time_ns() <= value["expiresNs"], "Capacity policy expired before launch")
        with c.Store(c.Config(value["root"], self.operation.path)) as store, store.locked(exclusive=True):
            c.require(store.marker == value["rootMarker"], "Frozen capacity root marker differs")
            self.require_quiet(store)
            fs = os.fstatvfs(store.fd)
            c.require(os.fstat(store.fd).st_dev == value["filesystemDevice"], "Capacity filesystem device differs")
            remaining = value["slots"][len(self.state["completedSlots"]):]
            jobs = capacity_jobs(value, remaining, self.actual_retained_minimum)
            result = budget(pressure.disk_free(store.fd), fs.f_frsize, jobs, (Growth("remaining external writers", value["externalGrowthReserveBytes"], 0, "declared-reserve", "Acknowledged cooperative author/setup/log growth reserve"),), True)
            result.update(policySha256=self.policy.sha256, slot=self.slot, actualRetainedMinimumBytes=self.actual_retained_minimum, observedNs=time.time_ns(), filesystemDevice=value["filesystemDevice"], cacheLifetime=value["cacheLifetime"], guarantee="Conditional operational reserves, fresh actual free-space checks, no quotas or prospective reclaim credit.")
            self.save("admission.json", result)
            c.require(result["status"].startswith("admissible-"), "Insufficient actual capacity; original request/attempt preserved, no retry")
            return result

    @staticmethod
    def require_quiet(store):
        for run in os.listdir(store.fd):
            if not c.RUN_RE.fullmatch(run):
                c.require(not run.startswith(".pressure-cache-"), "Unreconciled pressure capture remains")
                continue
            fd = c.open_run(store, run)
            try:
                with c.registry_lock(fd):
                    value, _, _ = c.read_json(fd, c.MANIFEST)
                    c.validate_manifest(value, run)
                    c.require(value["state"] in ("completed", "retired"), "Unresolved known lifecycle prevents capacity launch/maintenance")
            finally:
                os.close(fd)

    def complete(self, cfg, returncode):
        # Called only after cleanup.run_command returned: child and all descendants
        # were observed exited, registration and completed-manifest write finished.
        audits = [name for name in os.listdir(cfg.audit_dir) if name.endswith(".jsonl")]
        c.require(len(audits) == 1, "Unique per-job lifecycle audit required")
        raw, _, _ = read(os.path.join(cfg.audit_dir, audits[0]))
        events = [json.loads(line) for line in raw.splitlines() if line]
        starts = [event for event in events if event["event"] == "run-start"]
        ends = [event for event in events if event["event"] == "run-completed"]
        c.require(len(starts) == len(ends) == 1 and starts[0]["run"] == ends[0]["run"] and starts[0]["job"] == self.job, "Observed job completion identity differs")
        c.require(not any(event["event"] in ("run-error", "run-completion-audit-failed") for event in events), "Lifecycle failure requires reconciliation")
        run = starts[0]["run"]
        with c.Store(cfg) as store, store.locked(exclusive=True):
            self.require_quiet(store)
            fd = c.open_run(store, run)
            try:
                with c.registry_lock(fd):
                    manifest, _, _ = c.read_json(fd, c.MANIFEST)
                    original, _, _ = c.read_file(fd, c.MANIFEST, c.MAX_JSON)
                    c.require(manifest["state"] == "completed" and manifest["job"] == self.job and manifest["exitcode"] == ends[0]["exitcode"] and (manifest["exitcode"] if manifest["exitcode"] >= 0 else 128-manifest["exitcode"]) == returncode, "Actual completed manifest/return code differs")
            finally:
                os.close(fd)
        receipt = pressure.immutable(self.operation.fd, "completed-lifecycle-manifest.json", original)
        audit = pressure.immutable(self.operation.fd, "lifecycle-audit.jsonl", raw)
        checkpoint = {"schema": "aperture.capacity-completed-checkpoint.v1", "policySha256": self.policy.sha256, "slot": self.slot, "run": run, "job": self.job, "wrapperExitCode": returncode, "manifest": receipt, "audit": audit}
        self.save("checkpoint.json", checkpoint)
        self.state["completedRuns"].append(run)
        self.persist()
        if self.policy.value["maintenance"]["enabled"]:
            self.maintain()
        self.state["completedSlots"].append(self.slot)
        self.state.update(status="ready", currentSlot=None, actualJob=None)
        self.save("completion.json", {**checkpoint, "maintenancePasses": self.state["maintenancePasses"], "retiredCount": self.state["retiredCount"]})
        self.persist()
        return checkpoint

    def helper(self, action, output, extra=()):
        value = self.policy.value
        c.require(value["helperSource"] == source_pin(Path(pressure.__file__).resolve()) and value["helperSource"]["sha256"] == HELPER_SHA, "Pressure helper changed after admission")
        argv = [sys.executable, "-B", str(Path(pressure.__file__).resolve()), "--root", value["root"], "--runtime-root", value["runtimeRoot"], "--output", output, "--pressure", action, *extra]
        self.save(action + "-command.json", {"argv": argv, "startedNs": time.time_ns(), "noOuterLifecycleWrapper": True})
        started = time.monotonic_ns()
        with os.fdopen(os.open(action + "-stdout.bin", os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600, dir_fd=self.operation.fd), "wb") as stdout, os.fdopen(os.open(action + "-stderr.bin", os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600, dir_fd=self.operation.fd), "wb") as stderr:
            result = subprocess.run(argv, stdout=stdout, stderr=stderr, check=False)
            for stream in (stdout, stderr):
                stream.flush()
                os.fsync(stream.fileno())
                os.fchmod(stream.fileno(), 0o444)
        self.save(action + "-result.json", {"exitCode": result.returncode, "finishedNs": time.time_ns(), "wallNs": time.monotonic_ns()-started, "stdout": source_pin(os.path.join(self.operation.path, action + "-stdout.bin")), "stderr": source_pin(os.path.join(self.operation.path, action + "-stderr.bin"))})
        c.require(result.returncode == 0, "Cache maintenance failed; inspect exact output and reconcile, never retry automatically")

    def maintain(self):
        value, rules = self.policy.value, self.policy.value["maintenance"]
        c.require(time.time_ns() <= value["expiresNs"], "Expired capacity authority cannot retire caches")
        c.require(self.state["maintenancePasses"] < rules["maximumPasses"], "Capacity maintenance pass cap exhausted")
        cfg = c.Config(value["root"], self.operation.path)
        with c.Store(cfg) as store, store.locked(exclusive=True):
            self.require_quiet(store)
            # No cache scan/hash needed when neither initial nor completed runs
            # currently retain a registered exact cache. Other/unknown runs remain.
            eligible = []
            allowed = {*rules["initialKnownRuns"], *self.state["completedRuns"]}
            for run in allowed:
                fd = c.open_run(store, run)
                try:
                    with c.registry_lock(fd):
                        m, _, _ = c.read_json(fd, c.MANIFEST)
                        item = m["files"].get(pressure.NAME)
                        if item is not None:
                            c.require(item.get("kind") == pressure.KIND and item.get("size") == pressure.SIZE and item.get("sha256") == pressure.SHA256, "Allowed cache registration changed")
                            eligible.append(run)
                finally:
                    os.close(fd)
            if not eligible or pressure.disk_free(store.fd) >= pressure.TARGET_FREE_BYTES:
                self.save("maintenance.json", {"policySha256": self.policy.sha256, "status": "no-exact-caches" if not eligible else "target-already-reached", "freeBytesAfter": pressure.disk_free(store.fd), "retiredCount": 0})
                return
        plan_dir = os.path.join(self.operation.path, "pressure-plan")
        apply_dir = os.path.join(self.operation.path, "pressure-apply")
        self.helper("plan", plan_dir)
        plan_raw, _, plan_sha = read(os.path.join(plan_dir, "plan.json"))
        plan = json.loads(plan_raw)
        c.require(all(entry["run"] in allowed for entry in plan["entries"]), "Fresh pressure plan includes unapproved run; preserve all caches")
        c.require(len(plan["entries"]) <= rules["maximumRetirements"]-self.state["retiredCount"], "Bounded total retirement authority insufficient for exact plan")
        self.state["maintenancePasses"] += 1
        self.persist()
        self.helper("apply", apply_dir, ("--plan", os.path.join(plan_dir, "plan.json"), "--approved-sha256", plan_sha))
        outcome = pinned(os.path.join(apply_dir, "outcome.json"), source_pin(os.path.join(apply_dir, "outcome.json"))["sha256"])
        c.require(outcome["status"] in ("completed-target-reached", "completed-bounded-plan-exhausted"), "Unverified pressure completion")
        with c.Store(cfg) as store, store.locked(exclusive=True):
            self.require_quiet(store)
            for item in outcome["results"]:
                before, _, before_sha = read(os.path.join(apply_dir, item["beforeManifest"]))
                after, _, after_sha = read(os.path.join(apply_dir, item["afterManifest"]["path"]))
                previous, updated = json.loads(before), json.loads(after)
                for field in ("state", "created_ns", "completed_ns", "exitcode", "job", "recreation", "run_id", "schema"):
                    c.require(updated[field] == previous[field], "Cache retirement changed completed lifecycle metadata")
                unchanged = dict(previous["files"])
                unchanged.pop(pressure.NAME)
                c.require(updated["files"] == unchanged and before_sha == item["originalManifestSha256"] and after_sha == item["afterManifestSha256"], "Cache-only manifest bridge differs")
                fd = c.open_run(store, item["run"])
                try:
                    with c.registry_lock(fd):
                        _, _, current_sha = c.read_file(fd, c.MANIFEST, c.MAX_JSON)
                        c.require(current_sha == after_sha and not os.path.lexists(os.path.join(value["root"], item["run"], pressure.NAME)), "Actual cache retirement/current manifest differs")
                finally:
                    os.close(fd)
            actual_free = pressure.disk_free(store.fd)
        self.state["retiredCount"] += len(outcome["results"])
        self.save("maintenance.json", {"policySha256": self.policy.sha256, "status": outcome["status"], "planSha256": plan_sha, "outcome": source_pin(os.path.join(apply_dir, "outcome.json")), "freeBytesAfter": actual_free, "results": outcome["results"], "nextAdmissionRequired": True})
        self.persist()

    def fail(self, error):
        self.state.update(status="blocked-reconciliation-required", error=str(error))
        self.persist()
        self.save("failure.json", {"error": str(error), "policySha256": self.policy.sha256, "slot": self.slot, "noAutomaticRetry": True})

    def close(self):
        if self.operation is not None:
            self.operation.close()
            self.operation = None
        if self.lock is not None:
            os.close(self.lock)
            self.lock = None
        if self.pin is not None:
            self.pin.close()
            self.pin = None

    def __exit__(self, kind, error, traceback):
        try:
            if error is not None:
                self.fail(error)
            else:
                c.require(self.state["status"] == "ready", "Completed job checkpoint required before capacity release")
        finally:
            self.close()


def main(argv=None):
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--policy", required=True)
    parser.add_argument("--policy-sha256", required=True)
    sub = parser.add_subparsers(dest="action", required=True)
    admit = sub.add_parser("admit-phase")
    admit.add_argument("--output", required=True)
    args = parser.parse_args(argv)
    result = Policy.load(args.policy, args.policy_sha256).phase_admission(args.output)
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (c.Unsafe, OSError, ValueError, KeyError, TypeError) as error:
        print(json.dumps({"error": str(error), "filesPreserved": True, "noAutomaticRetry": True}), file=sys.stderr)
        raise SystemExit(2)
