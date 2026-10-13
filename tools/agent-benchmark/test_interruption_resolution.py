"""Synthetic private roots/process metadata; never resolves an actual run."""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import capacity as cap
import interruption_resolution as ir


class InterruptionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="interruption-unit-")
        self.base = Path(self.temp.name)
        self.root = self.base / "root"
        self.cfg = cap.c.Config(str(self.root), str(self.base / "audit"), frozenset([str(self.root)]))
        cap.c.initialize(self.cfg)
        self.allow = patch.object(cap.c, "ALLOWED_ROOTS", frozenset([str(self.root)])); self.allow.start()
        with cap.c.Store(self.cfg) as store, store.locked():
            self.run = cap.c.new_run(store, "interrupted-unit", "Synthetic interrupted supervision")
        self.manifest = self.root / self.run / cap.c.MANIFEST
        self.original = self.manifest.read_bytes()
        self.audit = self.base / "start.jsonl"
        self.audit.write_text(json.dumps({"event": "run-start", "run": self.run, "job": "interrupted-unit", "root": str(self.root), "at_ns": json.loads(self.original)["created_ns"]}) + "\n")
        self.audit.chmod(0o444)
        self.copy = self.base / "original.json"; self.copy.write_bytes(self.original); self.copy.chmod(0o444)
        self.owned = {"pid": 900001, "exists": True, "state": "S", "parentPid": 1, "processGroup": 900001, "sessionId": 900001, "startTimeTicks": 123, "rawExitStatus": 0}
        self.closed = {**self.owned, "state": "Z", "rawExitStatus": 9}
        self.application = {**self.owned, "pid": 900003, "processGroup": 900003, "sessionId": 900003, "startTimeTicks": 124}
        self.application_closed = {**self.application, "state": "Z", "rawExitStatus": 0}
        self.ownership = self.base / "ownership.json"
        self.put(self.ownership, {"run": self.run, "processes": [self.owned, self.application]})
        self.review = {"schema": ir.REVIEW_SCHEMA, "run": self.run, "job": "interrupted-unit", "bootId": "synthetic-boot", "originalManifest": ir.pin(self.manifest), "preservedOriginalManifest": ir.pin(self.copy), "originalAudit": ir.pin(self.audit), "preservedOriginalAudit": ir.pin(self.audit), "initialProcessOwnershipSnapshot": ir.pin(self.ownership), "ownedSessions": [900001, 900003], "liveOwnedSessionProcesses": [], "actualProcessClosureObservations": [self.closed, self.application_closed], "exclusiveLifecycleLockObservedAvailable": True, "rawManifestStillActive": True, "applicationOutcome": "passed", "applicationKernelExitStatus": 0}
        self.native = {}
        executable = str(self.root / self.run / "chromium")
        records = {"inputs": ("inputs.json", {"lifecycle": {"root": str(self.root), "run": self.run}, "engine": "aperture", "trial": 3}), "verified": ("verified-runner.json", {"status": "passed", "launch": {"requested": {"executablePath": executable}, "actualArgv": [executable]}, "sceneStatus": {"engine": "aperture", "trial": 3}})}
        for key, (name, value) in records.items():
            path = self.base / name; self.put(path, value); self.native[key] = ir.pin(path)
        path = self.base / "outcome.json"
        self.put(path, {"status": "passed", "browserStatus": "passed", "inputManifestSha256": self.native["inputs"]["sha256"]})
        self.native["outcome"] = ir.pin(path)
        self.review["applicationArtifacts"] = {Path(value["path"]).name: value for value in self.native.values()}
        for key in ("wrapperCompleted", "wrapperReaped", "officialDriverCompleted", "oldCapacitySlotCompleted", "roundEligibleForCombinedScoring", "sourceOrManifestRewritten", "nativeProcessesSignaledByRoot"):
            self.review[key] = False
        self.boot_patch = patch.object(ir, "boot_id", return_value="synthetic-boot")
        self.boot = self.boot_patch.start()
        self.metadata_patch = patch.object(ir, "process_metadata", return_value=[self.closed, self.application_closed])
        self.metadata = self.metadata_patch.start()
        self.output = self.base / "resolution"
        self.auth_pin = self.authority()

    def put(self, path, value):
        if path.exists(): path.chmod(0o600)  # Deliberate mutation of synthetic fixtures only.
        path.write_text(json.dumps(value)); path.chmod(0o444)

    def authority(self):
        review_path = self.base / "review.json"; self.put(review_path, self.review)
        auth_path = self.base / "auth.json"
        stat = self.root.stat()
        self.put(auth_path, {"schema": ir.AUTH_SCHEMA, "status": "authorized", "authorizedBy": "/root", "interruptionKind": "supervisor-interrupted", "root": str(self.root), "rootMarker": json.loads((self.root / cap.c.MARKER).read_bytes()), "rootIdentity": {"device": stat.st_dev, "inode": stat.st_ino}, "run": self.run, "rootReview": ir.pin(review_path), "helperSource": ir.pin(Path(ir.__file__).resolve()), "supervisorPids": [900001], "applicationPid": 900003, "nativeApplication": self.native, "outputRoot": str(self.output)})
        return ir.pin(auth_path)

    def tearDown(self):
        self.metadata_patch.stop(); self.boot_patch.stop(); self.allow.stop(); self.temp.cleanup()

    def test_resolution_preserves_raw_active_and_requires_explicit_caller_pin(self):
        receipt = ir.resolve(self.auth_pin, self.output)
        self.assertEqual(self.manifest.read_bytes(), self.original)
        data = json.loads(Path(receipt["path"]).read_bytes())
        self.assertFalse(data["wrapperCompleted"]); self.assertFalse(data["wrapperReaped"])
        self.assertIsNone(data["wrapperExitCode"]); self.assertFalse(data["scoringEligible"])
        with cap.c.Store(self.cfg) as store, store.locked(exclusive=True):
            with self.assertRaises(cap.c.Unsafe): cap.Session.require_quiet(store)
            cap.Session.require_quiet(store, [receipt])
        self.assertEqual(json.loads(self.manifest.read_bytes())["state"], "active")
        with cap.c.Store(self.cfg) as store, store.locked(exclusive=True):
            fd = cap.c.open_run(store, self.run)
            try:
                with self.assertRaisesRegex(cap.c.Unsafe, "not observed completed"):
                    cap.pressure.candidate(store, self.run, fd, cap.pressure.Pin(), 2**63-1)
            finally: __import__("os").close(fd)

    def test_live_owned_process_or_escaped_descendant_refuses(self):
        for metadata in [[self.owned], [self.closed, {**self.owned, "pid": 900002, "parentPid": 900001, "sessionId": 900002, "state": "R"}]]:
            self.metadata.return_value = metadata
            with self.assertRaisesRegex(cap.c.Unsafe, "Live owned"):
                ir.resolve(self.auth_pin, self.output)
            self.assertFalse(self.output.exists())

    def test_boot_change_missing_failed_supervisor_or_ambiguous_identity_refuses(self):
        self.boot.return_value = "new-boot"
        with self.assertRaisesRegex(cap.c.Unsafe, "Boot changed"): ir.resolve(self.auth_pin, self.output)
        self.boot.return_value = "synthetic-boot"
        self.review["actualProcessClosureObservations"] = []
        with self.assertRaisesRegex(cap.c.Unsafe, "failed supervisor"): ir.resolve(self.authority(), self.output)

    def test_tampered_manifest_authority_or_copy_never_becomes_quiet(self):
        self.manifest.write_bytes(self.original + b" ")
        with self.assertRaisesRegex(cap.c.Unsafe, "manifest changed"): ir.resolve(self.auth_pin, self.output)
        self.manifest.write_bytes(self.original)
        self.copy.chmod(0o600); self.copy.write_bytes(b"changed"); self.copy.chmod(0o444)
        with self.assertRaises(cap.c.Unsafe): ir.resolve(self.auth_pin, self.output)

    def test_pid_reuse_is_recorded_as_another_instance_without_signaling(self):
        self.metadata.return_value = [{**self.owned, "startTimeTicks": 999, "sessionId": 12345, "processGroup": 12345}]
        receipt = ir.resolve(self.auth_pin, self.output)
        data = json.loads(Path(receipt["path"]).read_bytes())
        self.assertFalse(data["processClosure"]["knownInstances"][0]["sameInstance"])
        self.assertFalse(data["wrapperReaped"])

    def test_later_live_session_and_forged_completion_flag_invalidate_receipt(self):
        receipt = ir.resolve(self.auth_pin, self.output)
        self.metadata.return_value = [self.owned]
        with cap.c.Store(self.cfg) as store, store.locked(exclusive=True):
            with self.assertRaisesRegex(cap.c.Unsafe, "Live owned"): cap.Session.require_quiet(store, [receipt])
        self.metadata.return_value = [self.closed]
        p = Path(receipt["path"]); d = json.loads(p.read_bytes()); d["wrapperCompleted"] = True
        p.chmod(0o600); self.put(p, d)
        with cap.c.Store(self.cfg) as store, store.locked(exclusive=True):
            with self.assertRaisesRegex(cap.c.Unsafe, "bounded interruption"): cap.Session.require_quiet(store, [ir.pin(p)])

    def test_symlink_and_duplicate_receipt_pins_refuse(self):
        receipt = ir.resolve(self.auth_pin, self.output)
        link = self.base / "linked.json"; link.symlink_to(receipt["path"])
        with self.assertRaises(cap.c.Unsafe): ir.read_pin({**receipt, "path": str(link)})
        with cap.c.Store(self.cfg) as store, store.locked(exclusive=True):
            with self.assertRaisesRegex(cap.c.Unsafe, "one explicit"): cap.Session.require_quiet(store, [receipt, receipt])

    def test_real_proc_stat_parser_uses_only_numeric_identity_metadata(self):
        import os
        data = ir.parse_stat(Path(f"/proc/{os.getpid()}/stat").read_text())
        self.assertEqual(data["pid"], os.getpid()); self.assertGreater(data["startTimeTicks"], 0)
        self.assertNotIn("cmdline", data); self.assertNotIn("environment", data)

    def test_inherited_live_shared_lock_cannot_be_overridden(self):
        with cap.c.Store(self.cfg) as holder, holder.locked():
            with self.assertRaises(cap.c.Busy): ir.resolve(self.auth_pin, self.output)
        self.assertFalse(self.output.exists())

    def test_wrong_root_identity_and_application_pid_refuse_before_output(self):
        for change in [{"rootIdentity": {"device": self.root.stat().st_dev, "inode": self.root.stat().st_ino + 1}}, {"applicationPid": 900999}, {"applicationPid": 900001}]:
            auth_pin = self.authority(); path = Path(auth_pin["path"])
            value = json.loads(path.read_bytes()); value.update(change); self.put(path, value)
            with self.assertRaises(cap.c.Unsafe): ir.resolve(ir.pin(path), self.output)
            self.assertFalse(self.output.exists())

    def test_application_exit_requires_observed_same_instance_wait_status(self):
        self.review["applicationKernelExitStatus"] = 17
        with self.assertRaisesRegex(cap.c.Unsafe, "exit differs"): ir.resolve(self.authority(), self.output)
        self.review["applicationKernelExitStatus"] = 0
        self.review["actualProcessClosureObservations"][1] = {**self.application_closed, "startTimeTicks": 999}
        with self.assertRaisesRegex(cap.c.Unsafe, "exit differs"): ir.resolve(self.authority(), self.output)
        self.review["applicationKernelExitStatus"] = None
        receipt = ir.resolve(self.authority(), self.output)
        value = json.loads(Path(receipt["path"]).read_bytes())
        self.assertIsNone(value["applicationKernelExitStatus"])
        self.assertFalse(value["applicationProcess"]["kernelExitStatusWitnessed"])

    def test_run_start_requires_exact_root_and_creation_time(self):
        original = json.loads(self.audit.read_bytes())
        for change in [{"root": str(self.base / "other")}, {"at_ns": json.loads(self.original)["created_ns"] - 1}]:
            value = {**original, **change}; self.put(self.audit, value)
            self.review["originalAudit"] = self.review["preservedOriginalAudit"] = ir.pin(self.audit)
            with self.assertRaisesRegex(cap.c.Unsafe, "audit root/time"): ir.resolve(self.authority(), self.output)
            self.assertFalse(self.output.exists())

    def test_tampered_or_wrong_lifecycle_native_application_graph_refuses(self):
        path = Path(self.native["inputs"]["path"]); original = path.read_bytes()
        self.put(path, {"lifecycle": {"root": str(self.root), "run": "run-wrong"}, "engine": "aperture", "trial": 3})
        with self.assertRaisesRegex(cap.c.Unsafe, "pin differs"): ir.resolve(self.auth_pin, self.output)
        self.native["inputs"] = ir.pin(path)
        self.review["applicationArtifacts"]["inputs.json"] = self.native["inputs"]
        with self.assertRaisesRegex(cap.c.Unsafe, "another lifecycle"): ir.resolve(self.authority(), self.output)
        path.chmod(0o600); path.write_bytes(original); path.chmod(0o444)
        self.native["inputs"] = ir.pin(path); self.review["applicationArtifacts"]["inputs.json"] = self.native["inputs"]
        path = Path(self.native["verified"]["path"]); value = json.loads(path.read_bytes()); value["status"] = "failed"; self.put(path, value)
        self.native["verified"] = ir.pin(path); self.review["applicationArtifacts"]["verified-runner.json"] = self.native["verified"]
        with self.assertRaisesRegex(cap.c.Unsafe, "verifier status"): ir.resolve(self.authority(), self.output)


class NoLaunchTests(unittest.TestCase):
    put = InterruptionTests.put
    authority = InterruptionTests.authority
    tearDown = InterruptionTests.tearDown

    def setUp(self):
        InterruptionTests.setUp(self)
        for key in ("initialProcessOwnershipSnapshot", "ownedSessions", "actualProcessClosureObservations", "applicationArtifacts"):
            self.review.pop(key)
        self.missing = self.base / "missing-node"
        child = [str(self.missing), "unused-formatter", "--write", "unused-file"]
        pressure = Path(cap.c.__file__).resolve().with_name("runtime_pressure.py")
        cwd = pressure.parents[2]
        self.command = {"argv": ["python3", "-B", str(pressure), "--root", str(self.root), "run", "--job", "interrupted-unit", "--", *child], "childArgv": child, "cwd": str(cwd), "startedAt": "2026-10-13T03:00:00+00:00"}
        self.result = {"stage": "format-unit", "exitCode": 2, "startedAt": self.command["startedAt"], "finishedAt": "2026-10-13T03:00:01+00:00", "elapsedSeconds": 1}
        self.graph = {"cleanupSource": ir.pin(Path(cap.c.__file__).resolve()), "runtimePressureSource": ir.pin(pressure)}
        for key, value in (("command", self.command), ("result", self.result), ("stderr", {"error": str(FileNotFoundError(2, __import__("os").strerror(2), str(self.missing))), "files_preserved": True})):
            path = self.base / (key + ".json"); self.put(path, value); self.graph[key] = ir.pin(path)
        path = self.base / "stdout.log"
        path.write_text(json.dumps({"run": self.run, "temporary_directory": str(self.root / self.run)}) + "\n" + json.dumps({"free_bytes_after": 100}) + "\n"); path.chmod(0o444)
        self.graph["stdout"] = ir.pin(path)
        self.events = [json.loads(self.audit.read_bytes()), {"event": "run-error", "run": self.run, "root": str(self.root), "at_ns": json.loads(self.original)["created_ns"] + 1, "phase": "launch", "reason": "FileNotFoundError", "completion_persisted": False}]
        self.write_audit()
        self.review.update(interruptionKind="command-not-launched", launchEvidence=self.graph, attemptedCommand=child, managedCommandLaunched=False, missingExecutable=str(self.missing), missingExecutableObservedAbsent=True, wrapperRecordedExitCode=2, applicationOutcome=None, applicationKernelExitStatus=None, applicationPid=None, supervisorPids=[], nativeLaunchAttempted=False)
        self.auth_pin = self.launch_authority()

    def write_audit(self):
        self.audit.chmod(0o600); self.audit.write_text("".join(json.dumps(event) + "\n" for event in self.events)); self.audit.chmod(0o444)
        self.review["originalAudit"] = self.review["preservedOriginalAudit"] = ir.pin(self.audit)

    def launch_authority(self, changes=None):
        record = self.authority(); path = Path(record["path"]); value = json.loads(path.read_bytes())
        value.update(interruptionKind="command-not-launched", supervisorPids=[], applicationPid=None, nativeApplication=None, launchEvidence=self.graph)
        value.update(changes or {}); self.put(path, value); return ir.pin(path)

    def update_record(self, key, value):
        path = Path(self.graph[key]["path"]); self.put(path, value); self.graph[key] = ir.pin(path)

    def test_exact_missing_command_only_resolves_quiescence(self):
        receipt = ir.resolve(self.auth_pin, self.output)
        value = json.loads(Path(receipt["path"]).read_bytes())
        self.assertEqual(self.manifest.read_bytes(), self.original)
        self.assertIsNone(value["applicationPid"]); self.assertIsNone(value["applicationKernelExitStatus"])
        self.assertIsNone(value["wrapperExitCode"]); self.assertFalse(value["wrapperReaped"])
        self.assertEqual(value["applicationProcess"]["wrapperRecordedExitCode"], 2)
        with cap.c.Store(self.cfg) as store, store.locked(exclusive=True):
            cap.Session.require_quiet(store, [receipt])
            with self.assertRaises(cap.c.Unsafe): cap.Session.require_quiet(store)

    def test_other_error_phase_or_completion_never_resolves(self):
        original = dict(self.events[1])
        for changes in [{"reason": "PermissionError"}, {"phase": "waiting"}, {"completion_persisted": True}, {"root": str(self.base)}, {"event": "run-completed"}]:
            self.events[1] = {**original, **changes}; self.write_audit()
            with self.assertRaises(cap.c.Unsafe): ir.resolve(self.launch_authority(), self.output)
            self.assertFalse(self.output.exists())

    def test_present_executable_wrong_return_or_command_suffix_refuses(self):
        self.missing.write_text("not launched")
        with self.assertRaisesRegex(cap.c.Unsafe, "missing absolute"): ir.resolve(self.auth_pin, self.output)
        self.missing.unlink()
        self.update_record("result", {**self.result, "exitCode": 0})
        with self.assertRaisesRegex(cap.c.Unsafe, "return2"): ir.resolve(self.launch_authority(), self.output)
        self.update_record("result", self.result)
        self.update_record("command", {**self.command, "childArgv": ["different"]})
        with self.assertRaisesRegex(cap.c.Unsafe, "command suffix"): ir.resolve(self.launch_authority(), self.output)

    def test_application_claim_or_unsupported_kind_refuses(self):
        for changes in [{"applicationPid": 900003}, {"supervisorPids": [900001]}, {"interruptionKind": "timeout"}]:
            with self.assertRaises(cap.c.Unsafe): ir.resolve(self.launch_authority(changes), self.output)
        self.review["applicationKernelExitStatus"] = 0
        with self.assertRaisesRegex(cap.c.Unsafe, "absent application"): ir.resolve(self.launch_authority(), self.output)

    def test_tampered_launch_logs_or_different_popen_source_refuses(self):
        path = Path(self.graph["stderr"]["path"]); raw = path.read_bytes()
        self.put(path, {"error": "invented", "files_preserved": True})
        with self.assertRaisesRegex(cap.c.Unsafe, "pin differs"): ir.resolve(self.auth_pin, self.output)
        path.chmod(0o600); path.write_bytes(raw); path.chmod(0o444)
        path = self.base / "different-cleanup.py"; path.write_bytes(Path(cap.c.__file__).read_bytes()); path.chmod(0o444)
        self.graph["cleanupSource"] = ir.pin(path)
        with self.assertRaisesRegex(cap.c.Unsafe, "source/Popen"): ir.resolve(self.launch_authority(), self.output)

    def test_later_executable_or_changed_boot_invalidates_sidecar(self):
        receipt = ir.resolve(self.auth_pin, self.output)
        self.missing.write_text("appeared later")
        with cap.c.Store(self.cfg) as store, store.locked(exclusive=True):
            with self.assertRaises(cap.c.Unsafe): cap.Session.require_quiet(store, [receipt])
        self.missing.unlink(); self.boot.return_value = "another-boot"
        with cap.c.Store(self.cfg) as store, store.locked(exclusive=True):
            with self.assertRaisesRegex(cap.c.Unsafe, "Boot changed"): cap.Session.require_quiet(store, [receipt])


if __name__ == "__main__": unittest.main()
