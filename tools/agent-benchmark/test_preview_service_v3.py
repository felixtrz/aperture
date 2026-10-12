"""CPU coordinator tests. Fakes never launch Docker or a browser."""
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location("preview_service_v3", Path(__file__).with_name("preview-service-v3.py"))
SERVICE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SERVICE)
LANE = SERVICE.LANE

class PreviewV3Tests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="preview-v3-private-test-")
        self.root = Path(self.temporary.name)
        self.workspace = self.root / "work"
        self.build = self.workspace / "dist"
        self.build.mkdir(parents=True)
        (self.build / "index.html").write_bytes(b"unit-only request-time build")
        self.evidence = self.root / "authors/three"
        self.evidence.mkdir(parents=True)
        self.lane = {"engine": "three", "workspace": str(self.workspace), "previewProtocol": LANE.FROZEN_PREVIEW_PROTOCOL, "previewDiagnosticSchema": "aperture.agent-house-diagnostic-preview.v3"}
        self.config = {"transcriptRoot": str(self.evidence.parent), "lanes": {"three": self.lane}}
        frozen = LANE.freeze_preview_build(self.evidence, "three", self.lane, 1)
        self.path = self.evidence / "previews/01-request.json"
        self.request = {"schema": "aperture.author-preview-request.v1", "lane": "three", "engine": "three", "number": 1, "artifactRoot": str(self.path.with_name("01-artifacts")), "replyPath": str(self.path.with_name("01-result.json")), **frozen}
        LANE.write_json(self.path, self.request)

    def tearDown(self):
        self.temporary.cleanup()

    def fake_run(self, status="passed", error=None, code=0, oversized=False):
        def run(command, **options):
            self.assertIn("tools/recovery/runtime_pressure.py", command)
            self.assertIn("tools/agent-benchmark/preview-run-v3.mjs", command)
            output = Path(self.request["artifactRoot"]) / "attempt"
            output.mkdir()
            for view in ("canonical", "left-orbit", "rear-orbit"):
                (output / (view + ".png")).write_bytes(b"unit double, not native PNG")
            if status is not None:
                record = {"schema":"aperture.agent-house-preview-geometry-preflight.v3","status":status,"counts":{"meshes":1}}
                (output / "geometry-preflight.json").write_bytes(b"x" * (64*1024+1) if oversized else json.dumps(record).encode())
            if error is not None:
                (output / "geometry-preflight-error.json").write_text(json.dumps({"message":error}))
            return subprocess.CompletedProcess(command, code)
        return run

    def test_frozen_request_uses_new_runner_without_mutating_v2_build_protocol(self):
        (self.build / "index.html").write_bytes(b"later build")
        request, _ = SERVICE.validate_request(self.config, self.path)
        self.assertEqual((Path(request["appRoot"]) / "index.html").read_bytes(), b"unit-only request-time build")
        self.assertEqual(request["previewProtocol"], "frozen-build-v2")
        command = SERVICE.preview_command(request, Path(request["artifactRoot"]))
        self.assertEqual(command[command.index("--app")+1], request["appRoot"])
        self.assertNotIn("--no-sandbox", command)

    def test_pass_requires_numeric_pass_and_retains_only_summary_hash_reference(self):
        with patch.object(SERVICE.subprocess, "run", self.fake_run()):
            response = SERVICE.process_request(self.config, self.path)
        self.assertEqual(response["status"], "ok")
        artifact = response["geometryPreflightArtifact"]
        self.assertEqual(LANE.digest(Path(artifact["path"]).read_bytes()), artifact["sha256"])
        self.assertEqual(Path(artifact["path"]).stat().st_size, artifact["bytes"])
        self.assertFalse(any(Path(self.request["artifactRoot"]).rglob("*.bin")))
        self.assertEqual(json.loads(Path(self.request["replyPath"]).read_bytes()), response)

    def test_actual_error_wins_and_existing_feedback_delivery_keeps_inline_text(self):
        with patch.object(SERVICE.subprocess, "run", self.fake_run("failed", "original inspectGeometry error", 1)):
            response = SERVICE.process_request(self.config, self.path)
        self.assertEqual(response["status"], "error")
        self.assertIn("original inspectGeometry error", Path(response["errorPath"]).read_text())
        self.assertNotIn("suggestedFix", Path(response["errorPath"]).read_text())

    def test_missing_numeric_pass_does_not_become_success_despite_child_exit_and_pngs(self):
        with patch.object(SERVICE.subprocess, "run", self.fake_run(None)):
            response = SERVICE.process_request(self.config, self.path)
        self.assertEqual(response["status"], "error")

    def test_oversized_summary_is_not_read_or_accepted(self):
        with patch.object(SERVICE.subprocess, "run", self.fake_run(oversized=True)):
            response = SERVICE.process_request(self.config, self.path)
        self.assertEqual(response["status"], "error")
        self.assertNotIn("geometryPreflightArtifact", response)

    def test_requires_both_lanes_to_freeze_same_new_disclosure(self):
        config={**self.config,"lanes":{"three":self.lane,"aperture":{**self.lane,"previewDiagnosticSchema":None}}}
        with patch.object(LANE,"load_config",return_value=config):
            with self.assertRaisesRegex(LANE.LaneError,"Both lanes must disclose"):
                SERVICE.main(["--config","/unit/config"])

if __name__ == "__main__":
    unittest.main()
