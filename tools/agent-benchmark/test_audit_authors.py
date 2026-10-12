"""Offline author audit tests with temporary inputs and fake container transport."""

import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest import mock


SPEC = importlib.util.spec_from_file_location("audit_authors", Path(__file__).with_name("audit-authors.py"))
AUDIT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(AUDIT)
LANE = AUDIT.LANE


class AuditTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="audit-authors-test-")
        self.root = Path(self.temporary.name)
        self.workspace = self.root / "work-three"
        self.workspace.mkdir()
        other = self.root / "work-aperture"
        other.mkdir()
        prompt = self.root / "prompt.txt"
        prompt.write_text("Public author prompt.\n")
        reference = self.root / "reference.png"
        reference.write_bytes(b"public reference bytes")
        self.config = {"schema": LANE.SCHEMA, "transcriptRoot": str(self.root / "evidence"), "lanes": {name: {"engine": name, "container": "private-" + name, "workspace": str(workspace), "budgetSeconds": 1800, "commandDeadlineSeconds": 600, "promptPath": str(prompt), "referencePath": str(reference)} for name, workspace in (("three", self.workspace), ("aperture", other))}}
        if getattr(self, "frozen_preview_protocol", False):
            for lane in self.config["lanes"].values():
                lane["previewProtocol"] = LANE.FROZEN_PREVIEW_PROTOCOL
        self.config_path = self.root / "control" / "lanes.json"
        self.config_path.parent.mkdir()
        self.config_path.write_text(json.dumps(self.config))
        self.evidence = self.root / "evidence/three"
        self.output = self.root / "audits/first"
        self.identity = "a" * 64
        self.run_lane("start")
        (self.workspace / "scene.ts").write_text("const house = true;\n")
        dist = self.workspace / "dist"
        dist.mkdir()
        (dist / "index.html").write_text("<html><head></head><body>public app</body></html>\n")
        dependencies = self.workspace / "node_modules"
        dependencies.mkdir()
        (dependencies / "dependency.js").write_text("Excluded assigned SDK")

    def tearDown(self):
        self.temporary.cleanup()

    def run_lane(self, action, text=None):
        with mock.patch.object(LANE, "inspect_container", return_value=self.identity), mock.patch.object(LANE, "running_processes", return_value=[]), contextlib.redirect_stdout(io.StringIO()):
            return LANE.run("three", action, text, config_path=self.config_path)

    def finish(self):
        self.run_lane("finish")

    def finalize(self):
        return AUDIT.finalize("three", self.output, config_path=self.config_path)

    def execute_fake(self, script, exit_code):
        state = json.loads((self.evidence / "state.json").read_bytes())

        class FakeDockerProcess:
            def __init__(process_self, args, stdout, stderr, start_new_session):
                stdout.write(b"public stdout\xff\n")
                stderr.write(b"public error\n" if exit_code else b"")

            def wait(process_self, timeout):
                return exit_code

        stdout, stderr = io.TextIOWrapper(io.BytesIO()), io.TextIOWrapper(io.BytesIO())
        supervision = {"shellExitCode": exit_code, "timedOut": False, "remainingDescendantPids": []}
        with mock.patch.object(LANE.subprocess, "Popen", FakeDockerProcess), mock.patch.object(LANE, "read_remote_result", return_value=supervision), contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
            LANE.execute(self.evidence, state, self.config["lanes"]["three"], script)

    def test_retains_exact_full_source_build_and_public_records(self):
        self.run_lane("note", "Public note with ``` and no private reasoning.")
        self.finish()
        before = {path.relative_to(self.workspace): path.read_bytes() for path in self.workspace.rglob("*") if path.is_file()}
        summary = self.finalize()
        self.assertEqual(summary["status"], "verified")
        self.assertEqual(summary["sourceFileCount"], 2)
        self.assertEqual(summary["commandCount"], 0)
        self.assertEqual((self.output / "source/scene.ts").read_bytes(), before[Path("scene.ts")])
        self.assertEqual((self.output / "source/dist/index.html").read_bytes(), before[Path("dist/index.html")])
        self.assertFalse((self.output / "source/node_modules").exists())
        self.assertEqual((self.output / "public-records/reference.png").read_bytes(), b"public reference bytes")
        self.assertIn("Public note with ```", (self.output / "transcript.md").read_text())
        self.assertEqual(summary["retainedBuiltAppRoot"], str(self.output / "source/dist"))
        self.assertTrue(all(summary["verificationChecks"].values()))
        for relative, pin in summary["retainedFiles"].items():
            self.assertEqual(AUDIT.file_pin((self.output / relative).read_bytes()), pin)
            self.assertEqual((self.output / relative).stat().st_mode & 0o222, 0)
        self.assertEqual({path.relative_to(self.workspace): path.read_bytes() for path in self.workspace.rglob("*") if path.is_file()}, before)

    def test_actual_command_outputs_and_identical_failed_retry_summary(self):
        self.execute_fake("build public app", 7)
        self.execute_fake("build public app", 0)
        self.execute_fake("inspect public app", 0)
        self.finish()
        summary = self.finalize()
        self.assertEqual(summary["commandCount"], 3)
        self.assertEqual(summary["failedCommandCount"], 1)
        self.assertEqual(summary["repeatedExactCommandCount"], 1)
        self.assertEqual(summary["sameExactCommandRetriesAfterFailure"], 1)
        transcript = (self.output / "transcript.md").read_text()
        self.assertIn("build public app", transcript)
        self.assertIn("public stdout\\xff", transcript)
        self.assertIn("public error", transcript)
        self.assertEqual(len(list((self.output / "public-records/commands").iterdir())), 3)

    def test_refuses_modified_source_and_preserves_failed_attempt(self):
        self.finish()
        (self.workspace / "scene.ts").write_text("changed after finish\n")
        with self.assertRaisesRegex(LANE.LaneError, "finished source manifest"):
            self.finalize()
        self.assertTrue((self.output / "audit-failure.json").is_file())
        self.assertFalse((self.output / "audit.json").exists())

    def test_refuses_tampered_exact_command_output(self):
        self.execute_fake("public command", 0)
        self.finish()
        path = next((self.evidence / "commands").glob("*/stdout.bin"))
        path.chmod(0o644)
        path.write_bytes(b"tampered stdout")
        path.chmod(0o444)
        with self.assertRaisesRegex(LANE.LaneError, "stdout bytes differ"):
            self.finalize()

    def test_refuses_corrupt_event_chain(self):
        self.run_lane("note", "public note")
        self.finish()
        path = self.evidence / "events.jsonl"
        path.write_bytes(path.read_bytes().replace(b"public note", b"PUBLIC NOTE"))
        with self.assertRaisesRegex(LANE.LaneError, "hash-chain"):
            self.finalize()

    def test_refuses_changed_prompt_reference_pin(self):
        self.finish()
        path = self.evidence / "reference.png"
        path.chmod(0o644)
        path.write_bytes(b"changed reference")
        path.chmod(0o444)
        with self.assertRaisesRegex(LANE.LaneError, "prompt/reference bytes"):
            self.finalize()

    def test_refuses_forged_final_budget_or_preview_counters(self):
        self.finish()
        path = self.evidence / "state.json"
        state = json.loads(path.read_bytes())
        state["previewWaitNs"] = 1000000000
        path.write_bytes(LANE.canonical(state) + b"\n")
        with self.assertRaisesRegex(LANE.LaneError, "preview counters"):
            self.finalize()

    def test_existing_output_cannot_be_reused_or_overwritten(self):
        self.finish()
        self.finalize()
        before = (self.output / "audit.json").read_bytes()
        with self.assertRaises(FileExistsError):
            self.finalize()
        self.assertEqual((self.output / "audit.json").read_bytes(), before)
        self.assertFalse((self.output / "audit-failure.json").exists())

    def test_unfinished_author_and_mounted_output_are_refused(self):
        with self.assertRaises(FileNotFoundError):
            self.finalize()
        self.assertTrue((self.output / "audit-failure.json").is_file())
        with self.assertRaisesRegex(LANE.LaneError, "outside both author"):
            AUDIT.finalize("three", self.workspace / "bad-audit", config_path=self.config_path)

    def test_completed_preview_wait_and_capture_are_verified_and_retained(self):
        original_wait = LANE.wait_for_preview

        def coordinator(root, state, request, reply):
            capture = Path(request["artifactRoot"]) / "canonical.png"
            capture.parent.mkdir()
            capture.write_bytes(b"public native capture")
            LANE.write_json(reply, {"schema": "aperture.author-preview-result.v1", "lane": "three", "engine": "three", "number": request["number"], "requestSha256": request["_requestSha256"], "completedAt": LANE.utc_now(), "status": "ok", "capturePaths": [str(capture)]})
            return original_wait(root, state, request, reply)

        with mock.patch.object(LANE, "wait_for_preview", coordinator):
            self.run_lane("preview")
        self.finish()
        summary = self.finalize()
        self.assertEqual(summary["previews"][0]["status"], "ok")
        self.assertGreaterEqual(summary["previewWaitSeconds"], 0)
        self.assertAlmostEqual(summary["elapsedSeconds"], summary["previewWaitSeconds"] + summary["activeBudgetElapsedSeconds"], places=6)
        self.assertEqual((self.output / "public-records/previews/01-artifacts/canonical.png").read_bytes(), b"public native capture")


class FrozenPreviewAuditTests(AuditTests):
    frozen_preview_protocol = True

    def test_completed_preview_wait_and_capture_are_verified_and_retained(self):
        original_wait = LANE.wait_for_preview
        requested_bytes = (self.workspace / "dist/index.html").read_bytes()

        def coordinator(root, state, request, reply):
            # The author rebuilds after the queued request; audit must retain
            # both the earlier frozen preview and the final newer source.
            (self.workspace / "dist/index.html").write_bytes(b"later final app bytes")
            capture = Path(request["artifactRoot"]) / "canonical.png"
            capture.parent.mkdir()
            capture.write_bytes(b"public native capture")
            LANE.write_json(reply, {"schema": "aperture.author-preview-result.v1", "previewProtocol": LANE.FROZEN_PREVIEW_PROTOCOL, "frozenBuildManifestSha256": request["frozenBuildManifest"]["sha256"], "lane": "three", "engine": "three", "number": request["number"], "requestSha256": request["_requestSha256"], "completedAt": LANE.utc_now(), "status": "ok", "capturePaths": [str(capture)]})
            return original_wait(root, state, request, reply)

        with mock.patch.object(LANE, "wait_for_preview", coordinator):
            self.run_lane("preview")
        self.finish()
        summary = self.finalize()
        self.assertEqual(summary["status"], "verified")
        self.assertEqual((self.output / "public-records/previews/01-frozen-build/index.html").read_bytes(), requested_bytes)
        self.assertEqual((self.output / "source/dist/index.html").read_bytes(), b"later final app bytes")
        self.assertIn("public-records/previews/01-frozen-build-manifest.json", summary["retainedFiles"])

    def test_refuses_tampered_request_time_frozen_preview(self):
        with mock.patch.object(LANE, "wait_for_preview", return_value=0):
            self.run_lane("preview")
        target = self.evidence / "previews/01-frozen-build/index.html"
        target.chmod(0o644)
        target.write_bytes(b"tampered frozen preview")
        target.chmod(0o444)
        self.finish()
        with self.assertRaisesRegex(LANE.LaneError, "hashes/inventory"):
            self.finalize()


if __name__ == "__main__":
    unittest.main()
