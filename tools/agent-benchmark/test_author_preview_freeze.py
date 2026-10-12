"""Request-time snapshot/queue validation; no Docker or browser launches."""

import importlib.util
import json
from pathlib import Path
import tempfile
import unittest


SPEC = importlib.util.spec_from_file_location("preview_service_v2", Path(__file__).with_name("preview-service-v2.py"))
SERVICE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SERVICE)
LANE = SERVICE.LANE


class PreviewQueueTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="preview-frozen-queue-test-")
        self.root = Path(self.temporary.name)
        self.workspace = self.root / "work"
        self.build = self.workspace / "dist"
        self.build.mkdir(parents=True)
        (self.build / "index.html").write_bytes(b"requested app")
        self.evidence = self.root / "authors/three"
        self.evidence.mkdir(parents=True)
        self.lane = {"engine": "three", "workspace": str(self.workspace), "previewProtocol": LANE.FROZEN_PREVIEW_PROTOCOL}
        self.config = {"transcriptRoot": str(self.evidence.parent), "lanes": {"three": self.lane}}
        frozen = LANE.freeze_preview_build(self.evidence, "three", self.lane, 1)
        self.path = self.evidence / "previews/01-request.json"
        self.request = {"schema": "aperture.author-preview-request.v1", "lane": "three", "engine": "three", "number": 1, "artifactRoot": str(self.path.with_name("01-artifacts")), "replyPath": str(self.path.with_name("01-result.json")), **frozen}
        LANE.write_json(self.path, self.request)

    def tearDown(self):
        self.temporary.cleanup()

    def test_queue_uses_immutable_requested_build_after_the_original_is_rebuilt(self):
        (self.build / "index.html").write_bytes(b"later app revision")
        request, raw = SERVICE.validate_request(self.config, self.path)
        self.assertEqual(json.loads(raw), self.request)
        self.assertEqual((Path(request["appRoot"]) / "index.html").read_bytes(), b"requested app")
        command = SERVICE.preview_command(request, Path(request["artifactRoot"]))
        self.assertIn("tools/recovery/runtime_pressure.py", command)
        self.assertIn("tools/agent-benchmark/preview-run.mjs", command)
        self.assertEqual(command[command.index("--app") + 1], request["appRoot"])
        self.assertNotEqual(command[command.index("--app") + 1], str(self.build))
        self.assertNotIn("--no-sandbox", command)

    def test_queue_rejects_an_unfrozen_legacy_lane_and_a_foreign_request(self):
        config = {**self.config, "lanes": {"three": {**self.lane, "previewProtocol": None}}}
        with self.assertRaisesRegex(LANE.LaneError, "protocol differs"):
            SERVICE.validate_request(config, self.path)
        foreign = self.root / "foreign/three/previews/01-request.json"
        LANE.write_json(foreign, self.request)
        with self.assertRaisesRegex(LANE.LaneError, "outside its own lane"):
            SERVICE.validate_request(self.config, foreign)

    def test_queue_rejects_symlinked_and_mutated_frozen_inputs(self):
        path = Path(self.request["appRoot"]) / "index.html"
        path.chmod(0o644)
        path.write_bytes(b"changed frozen app")
        path.chmod(0o444)
        with self.assertRaisesRegex(LANE.LaneError, "hashes/inventory"):
            SERVICE.validate_request(self.config, self.path)
        path.parent.chmod(0o755)
        path.unlink()
        path.symlink_to(self.build / "index.html")
        path.parent.chmod(0o555)
        with self.assertRaisesRegex(LANE.LaneError, "symbolic links"):
            SERVICE.validate_request(self.config, self.path)


if __name__ == "__main__":
    unittest.main()
