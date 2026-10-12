"""Focused recorder tests; no Docker, browser, package build or checkout writes."""

import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest import mock
import uuid


SPEC = importlib.util.spec_from_file_location("author_lane", Path(__file__).with_name("author-lane.py"))
LANE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(LANE)


class RecorderTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="author-lane-test-")
        self.root = Path(self.temporary.name)
        self.workspace = self.root / "work-three"
        self.workspace.mkdir()
        other = self.root / "work-aperture"
        other.mkdir()
        prompt = self.root / "prompt.txt"
        prompt.write_text("Build the same house, road and car scene.\n")
        reference = self.root / "reference.png"
        reference.write_bytes(b"reference image bytes")
        self.config = {"schema": LANE.SCHEMA, "transcriptRoot": str(self.root / "evidence"), "lanes": {name: {"engine": name, "container": "private-" + name, "workspace": str(workspace), "budgetSeconds": 1800, "commandDeadlineSeconds": 600, "promptPath": str(prompt), "referencePath": str(reference)} for name, workspace in (("three", self.workspace), ("aperture", other))}}
        self.config_path = self.root / "control" / "lanes.json"
        self.config_path.parent.mkdir()
        self.write_config()
        self.identity = "a" * 64

    def tearDown(self):
        self.temporary.cleanup()

    def write_config(self):
        self.config_path.write_text(json.dumps(self.config))

    def run_lane(self, action, text=None):
        with mock.patch.object(LANE, "inspect_container", return_value=self.identity), mock.patch.object(LANE, "running_processes", return_value=[]), contextlib.redirect_stdout(io.StringIO()):
            return LANE.run("three", action, text, config_path=self.config_path)

    def test_configuration_requires_separate_workspaces(self):
        self.config["lanes"]["aperture"]["workspace"] = str(self.workspace)
        self.write_config()
        with self.assertRaisesRegex(LANE.LaneError, "cannot overlap"):
            LANE.load_config(self.config_path)

    def test_evidence_must_not_be_mounted(self):
        self.config["transcriptRoot"] = str(self.workspace / "evidence")
        self.write_config()
        with self.assertRaisesRegex(LANE.LaneError, "outside every"):
            LANE.load_config(self.config_path)

    def test_cannot_mount_other_lane_read_only(self):
        self.config["lanes"]["three"]["readOnlyMounts"] = [{"source": self.config["lanes"]["aperture"]["workspace"], "target": "/other"}]
        self.write_config()
        with self.assertRaisesRegex(LANE.LaneError, "other lane"):
            LANE.load_config(self.config_path)

    def test_container_checks_id_privileges_and_exact_mounts(self):
        lane = self.config["lanes"]["three"]
        info = {"Id": self.identity, "Name": "/private-three", "State": {"Running": True}, "HostConfig": {"Privileged": False, "NetworkMode": "none", "PidMode": ""}, "Config": {"WorkingDir": "/work"}, "Mounts": [{"Type": "bind", "Source": str(self.workspace), "Destination": "/work", "RW": True}]}
        self.assertEqual(LANE.validate_container(info, lane), self.identity)
        info["Mounts"].append({"Type": "bind", "Source": "/var/run/docker.sock", "Destination": "/var/run/docker.sock", "RW": True})
        with self.assertRaisesRegex(LANE.LaneError, "mounts differ"):
            LANE.validate_container(info, lane)
        info["Mounts"].pop()
        info["HostConfig"]["Privileged"] = True
        with self.assertRaisesRegex(LANE.LaneError, "host privileges"):
            LANE.validate_container(info, lane)

    def test_hash_chain_verifies_existing_lines_before_append(self):
        evidence = self.root / "chain"
        evidence.mkdir()
        first = LANE.append_event(evidence, "note", {"text": "hello"})
        second = LANE.append_event(evidence, "note", {"text": "world"})
        self.assertEqual(second["previousSha256"], first["sha256"])
        path = evidence / "events.jsonl"
        path.write_bytes(path.read_bytes().replace(b"hello", b"HELLO"))
        with self.assertRaisesRegex(LANE.LaneError, "hash chain"):
            LANE.append_event(evidence, "note", {"text": "cannot hide corruption"})

    def test_start_is_immutable_and_pins_prompt_reference(self):
        self.run_lane("start")
        evidence = self.root / "evidence/three"
        started = json.loads((evidence / "start.json").read_text())
        self.assertEqual(started["prompt"]["sha256"], LANE.digest((evidence / "prompt.txt").read_bytes()))
        self.assertEqual(started["reference"]["sha256"], LANE.digest((evidence / "reference.png").read_bytes()))
        self.assertEqual((evidence / "start.json").stat().st_mode & 0o222, 0)
        with self.assertRaisesRegex(LANE.LaneError, "cannot be reset"):
            self.run_lane("start")

    def test_configuration_and_directory_identity_are_pinned(self):
        self.run_lane("start")
        self.config["lanes"]["three"]["budgetSeconds"] = 1900
        self.write_config()
        with self.assertRaisesRegex(LANE.LaneError, "configuration changed"):
            self.run_lane("note", "changed budget")

    def test_finish_hashes_real_files_and_forbids_further_edits(self):
        (self.workspace / "scene.ts").write_text("const house = true;\n")
        dependencies = self.workspace / "node_modules"
        dependencies.mkdir()
        (dependencies / "dependency.js").write_text("dependency")
        self.run_lane("start")
        self.run_lane("finish")
        result = json.loads((self.root / "evidence/three/finish.json").read_text())
        self.assertEqual(result["files"], [{"path": "scene.ts", "bytes": 20, "sha256": LANE.digest(b"const house = true;\n")}])
        with self.assertRaisesRegex(LANE.LaneError, "finished"):
            self.run_lane("note", "late change")

    def test_finish_rejects_symlink_escape(self):
        (self.workspace / "escape").symlink_to(self.root / "prompt.txt")
        self.run_lane("start")
        with self.assertRaisesRegex(LANE.LaneError, "symbolic links"):
            self.run_lane("finish")

    def test_preview_limit_and_clean_handoff(self):
        self.run_lane("start")
        with mock.patch.object(LANE, "wait_for_preview", return_value=0):
            for _ in range(3):
                self.run_lane("preview")
        request = json.loads((self.root / "evidence/three/previews/01-request.json").read_text())
        self.assertEqual(request["appRoot"], str(self.workspace / "dist"))
        self.assertEqual(request["engine"], "three")
        self.assertIn("adopted", request["route"])
        self.assertEqual(request["artifactRoot"], str(self.root / "evidence/three/previews/01-artifacts"))
        with self.assertRaisesRegex(LANE.LaneError, "At most three"):
            self.run_lane("preview")

    def frozen_preview(self):
        for lane in self.config["lanes"].values():
            lane["previewProtocol"] = LANE.FROZEN_PREVIEW_PROTOCOL
        self.write_config()
        build = self.workspace / "dist"
        (build / "assets").mkdir(parents=True)
        (build / "index.html").write_bytes(b"requested build index")
        (build / "assets/main.js").write_bytes(b"requested scene code")
        self.run_lane("start")
        with mock.patch.object(LANE, "wait_for_preview", return_value=0):
            self.run_lane("preview")
        path = self.root / "evidence/three/previews/01-request.json"
        return path, json.loads(path.read_bytes()), build

    def test_frozen_preview_captures_request_time_bytes_before_queue_and_original_mutations(self):
        path, request, original = self.frozen_preview()
        frozen = Path(request["appRoot"])
        self.assertEqual(frozen, path.with_name("01-frozen-build"))
        self.assertEqual(request["originalBuildRoot"], str(original))
        (original / "index.html").write_bytes(b"later rebuilt index")
        (original / "assets/main.js").write_bytes(b"later rebuilt scene")
        manifest = LANE.validate_frozen_preview(request, path, self.config["lanes"]["three"])
        self.assertEqual((frozen / "index.html").read_bytes(), b"requested build index")
        self.assertEqual((frozen / "assets/main.js").read_bytes(), b"requested scene code")
        self.assertEqual(manifest["fileCount"], 2)
        self.assertEqual(frozen.stat().st_mode & 0o222, 0)
        self.assertEqual((frozen / "assets").stat().st_mode & 0o222, 0)
        self.assertEqual((frozen / "index.html").stat().st_mode & 0o222, 0)
        with self.assertRaisesRegex(LANE.LaneError, "manifest already exists"):
            LANE.freeze_preview_build(path.parent.parent, "three", self.config["lanes"]["three"], 1)

    def test_frozen_preview_refuses_symlink_and_size_limits_without_publishing_request(self):
        for lane in self.config["lanes"].values():
            lane["previewProtocol"] = LANE.FROZEN_PREVIEW_PROTOCOL
        self.write_config()
        build = self.workspace / "dist"
        build.mkdir()
        (build / "index.html").write_bytes(b"requested index")
        (build / "linked.js").symlink_to(self.root / "prompt.txt")
        self.run_lane("start")
        with self.assertRaisesRegex(LANE.LaneError, "symbolic links"):
            self.run_lane("preview")
        (build / "linked.js").unlink()
        with mock.patch.object(LANE, "PREVIEW_MAX_TOTAL_BYTES", 4):
            with self.assertRaisesRegex(LANE.LaneError, "bounded"):
                self.run_lane("preview")
        self.assertFalse((self.root / "evidence/three/previews/01-request.json").exists())
        self.assertEqual(json.loads((self.root / "evidence/three/state.json").read_bytes())["previews"], 0)

    def test_frozen_preview_rejects_retained_byte_tampering_and_wrong_owner(self):
        path, request, _ = self.frozen_preview()
        with self.assertRaisesRegex(LANE.LaneError, "owner/engine/number"):
            LANE.validate_frozen_preview({**request, "engine": "aperture"}, path, self.config["lanes"]["three"])
        target = Path(request["appRoot"]) / "index.html"
        target.chmod(0o644)
        target.write_bytes(b"tampered frozen bytes")
        target.chmod(0o444)
        with self.assertRaisesRegex(LANE.LaneError, "hashes/inventory"):
            LANE.validate_frozen_preview(request, path, self.config["lanes"]["three"])

    def test_finished_lane_stays_finished_even_after_budget(self):
        self.run_lane("start")
        state_path = self.root / "evidence/three/state.json"
        state = json.loads(state_path.read_bytes())
        state["deadlineMonotonicNs"] = 0
        LANE.store_state(state_path.parent, state)
        with self.assertRaisesRegex(LANE.LaneError, "budget has expired"):
            self.run_lane("note", "out of budget")
        self.run_lane("finish")

    def test_incomplete_command_prevents_finish(self):
        self.run_lane("start")
        state_path = self.root / "evidence/three/state.json"
        state = json.loads(state_path.read_bytes())
        state["activeCommand"] = "incomplete"
        LANE.store_state(state_path.parent, state)
        with self.assertRaisesRegex(LANE.LaneError, "incomplete"):
            self.run_lane("finish")

    def test_feedback_inlines_existing_public_error_without_spending_preview_or_budget(self):
        self.run_lane("start")
        with mock.patch.object(LANE, "wait_for_preview", return_value=3):
            self.run_lane("preview")
        evidence = self.root / "evidence/three"
        before = json.loads((evidence / "state.json").read_bytes())
        request_path = evidence / "previews/01-request.json"
        request = json.loads(request_path.read_bytes())
        error = Path(request["artifactRoot"]) / "error.txt"
        error.parent.mkdir()
        data = b"Actual public shader error\n" + b"x" * LANE.MAX_INLINE_ERROR_BYTES
        error.write_bytes(data)
        LANE.write_json(Path(request["replyPath"]), {"schema": "aperture.author-preview-result.v1", "lane": "three", "engine": "three", "number": 1, "requestSha256": LANE.digest(request_path.read_bytes()), "completedAt": LANE.utc_now(), "status": "error", "capturePaths": [], "errorPath": str(error)})
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            code = LANE.run("three", "feedback", "1", config_path=self.config_path)
        self.assertEqual(code, 3)
        response = json.loads(output.getvalue())
        self.assertTrue(response["publicErrorText"].startswith("Actual public shader error"))
        self.assertEqual(response["publicErrorTextBytes"], LANE.MAX_INLINE_ERROR_BYTES)
        self.assertTrue(response["publicErrorTextTruncated"])
        self.assertEqual(response["publicErrorSha256"], LANE.digest(data))
        self.assertEqual(json.loads((evidence / "state.json").read_bytes()), before)
        events = [json.loads(line) for line in (evidence / "events.jsonl").read_bytes().splitlines()]
        self.assertEqual(events[-1]["kind"], "preview-feedback-read")
        self.assertEqual(events[-1]["payload"]["artifacts"][0]["sha256"], LANE.digest(data))
        with self.assertRaisesRegex(LANE.LaneError, "cannot create"):
            LANE.run("three", "feedback", "2", config_path=self.config_path)

    def test_execution_preserves_exact_bytes_command_deadline_and_exit(self):
        self.run_lane("start")
        evidence = self.root / "evidence/three"
        state = json.loads((evidence / "state.json").read_bytes())
        script = "printf 'actual public command'; exit 7"

        class FakeDockerProcess:
            def __init__(process_self, args, stdout, stderr, start_new_session):
                self.assertEqual(args[:5], ["docker", "exec", "--workdir", "/work", self.identity])
                self.assertEqual(args[-3], script)
                self.assertTrue(start_new_session)
                stdout.write(b"binary\x00stdout\xff")
                stderr.write(b"actual stderr\n")

            def wait(process_self, timeout):
                self.assertGreaterEqual(timeout, 10)
                return 7

        stdout_bytes, stderr_bytes = io.BytesIO(), io.BytesIO()
        stdout, stderr = io.TextIOWrapper(stdout_bytes), io.TextIOWrapper(stderr_bytes)
        supervision = {"shellExitCode": 7, "timedOut": False, "remainingDescendantPids": []}
        with mock.patch.object(LANE.subprocess, "Popen", FakeDockerProcess), mock.patch.object(LANE, "read_remote_result", return_value=supervision), contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
            code = LANE.execute(evidence, state, self.config["lanes"]["three"], script)
        self.assertEqual(code, 7)
        commands = list((evidence / "commands").iterdir())
        self.assertEqual(len(commands), 1)
        request = json.loads((commands[0] / "request.json").read_bytes())
        result = json.loads((commands[0] / "result.json").read_bytes())
        self.assertEqual(request["script"], script)
        self.assertLessEqual(request["deadlineSeconds"], 600)
        self.assertEqual(result["exitCode"], 7)
        self.assertEqual((commands[0] / "stdout.bin").read_bytes(), b"binary\x00stdout\xff")
        self.assertEqual((commands[0] / "stderr.bin").read_bytes(), b"actual stderr\n")
        self.assertEqual(stdout_bytes.getvalue(), b"binary\x00stdout\xff")
        self.assertNotIn("activeCommand", json.loads((evidence / "state.json").read_bytes()))
        for file in commands[0].iterdir():
            self.assertEqual(file.stat().st_mode & 0o222, 0)


class PreviewTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="author-preview-test-")
        self.root = Path(self.temporary.name)
        self.artifacts = self.root / "01-artifacts"
        self.artifacts.mkdir()
        self.capture = self.artifacts / "canonical.png"
        self.capture.write_bytes(b"surviving native capture")
        self.request = {"lane": "three", "engine": "three", "number": 1, "artifactRoot": str(self.artifacts), "_requestSha256": "b" * 64}
        self.reply = self.root / "01-result.json"
        self.response = {"schema": "aperture.author-preview-result.v1", "lane": "three", "engine": "three", "number": 1, "requestSha256": "b" * 64, "completedAt": "2026-10-11T23:30:00Z", "status": "ok", "capturePaths": [str(self.capture)]}

    def tearDown(self):
        self.temporary.cleanup()

    def publish(self):
        LANE.write_json(self.reply, self.response)

    def test_success_requires_immutable_matching_response_and_own_artifacts(self):
        self.publish()
        result, result_hash = LANE.validate_preview_result(self.reply, self.request)
        self.assertEqual(result["capturePaths"], [str(self.capture)])
        self.assertEqual(result_hash, LANE.digest(self.reply.read_bytes()))

    def test_other_lane_and_outside_capture_are_rejected(self):
        self.response["lane"] = "aperture"
        self.publish()
        with self.assertRaisesRegex(LANE.LaneError, "different request"):
            LANE.validate_preview_result(self.reply, self.request)
        self.reply.unlink()
        self.response["lane"] = "three"
        outside = self.root / "other.png"
        outside.write_bytes(b"other lane")
        self.response["capturePaths"] = [str(outside)]
        self.publish()
        with self.assertRaisesRegex(LANE.LaneError, "only to this author"):
            LANE.validate_preview_result(self.reply, self.request)

    def test_response_request_hash_and_timestamp_are_verified(self):
        self.response["requestSha256"] = "a" * 64
        self.publish()
        with self.assertRaisesRegex(LANE.LaneError, "request hash differs"):
            LANE.validate_preview_result(self.reply, self.request)

    def test_coordinator_wait_credit_leaves_raw_time_unchanged(self):
        self.publish()
        state = {"deadlineMonotonicNs": 7000000000, "startedMonotonicNs": 500, "previewWaitNs": 0}
        with mock.patch.object(LANE.time, "monotonic_ns", side_effect=[1000, 1001, 5000001000, 5000001001, 5000001002]), contextlib.redirect_stdout(io.StringIO()):
            code = LANE.wait_for_preview(self.root, state, self.request, self.reply)
        self.assertEqual(code, 0)
        self.assertEqual(state["previewWaitNs"], 5000000000)
        self.assertEqual(state["deadlineMonotonicNs"], 12000000000)
        self.assertEqual(state["startedMonotonicNs"], 500)
        event = json.loads((self.root / "events.jsonl").read_bytes().splitlines()[0])
        self.assertEqual(event["payload"]["waitSeconds"], 5)
        self.assertEqual(event["payload"]["budgetCreditSeconds"], 5)

    def test_timeout_is_visible_and_has_same_measured_wait_credit(self):
        state = {"deadlineMonotonicNs": 1000, "previewWaitNs": 0}
        with mock.patch.object(LANE, "PREVIEW_WAIT_SECONDS", 1), mock.patch.object(LANE.time, "monotonic_ns", side_effect=[1000, 1000001001, 1000001002, 1000001003]), contextlib.redirect_stdout(io.StringIO()):
            code = LANE.wait_for_preview(self.root, state, self.request, self.reply)
        self.assertEqual(code, 3)
        self.assertEqual(state["previewWaitNs"], 1000000002)
        event = json.loads((self.root / "events.jsonl").read_bytes())
        self.assertEqual(event["payload"]["status"], "timeout")


@unittest.skipUnless(os.name == "posix" and Path("/proc").is_dir(), "Linux process supervision")
class SupervisorTests(unittest.TestCase):
    def run_supervisor(self, script, deadline):
        with tempfile.TemporaryDirectory(prefix="author-supervisor-test-") as directory:
            token = uuid.uuid4().hex
            code = LANE.SUPERVISOR.replace("Path('/tmp/aperture-author-command-' + token)", "Path(" + repr(directory) + ") / ('command-' + token)").replace("cwd='/work'", "cwd=" + repr(directory))
            process = subprocess.run(["python3", "-c", code, script, str(deadline), token], capture_output=True, timeout=15, check=False)
            result = json.loads((Path(directory) / ("command-" + token) / "result.json").read_text())
            return process, result

    def test_captures_actual_exit_and_kills_background_descendants(self):
        process, result = self.run_supervisor("sleep 300 & printf hello; printf error >&2; exit 7", 10)
        self.assertEqual(process.returncode, 7)
        self.assertEqual(process.stdout, b"hello")
        self.assertEqual(process.stderr, b"error")
        self.assertEqual(result["shellExitCode"], 7)
        self.assertTrue(result["terminatedDescendantPids"])
        self.assertEqual(result["remainingDescendantPids"], [])

    def test_deadline_cleans_children_and_reports_timeout(self):
        process, result = self.run_supervisor("sleep 300", 0.1)
        self.assertEqual(process.returncode, 124)
        self.assertTrue(result["timedOut"])
        self.assertEqual(result["shellExitCode"], -15)
        self.assertEqual(result["remainingDescendantPids"], [])


if __name__ == "__main__":
    unittest.main()
