"""Fake packing only: guide copies and provenance, no install/build/container."""
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch


SOURCE = Path(__file__).with_name("prepare-round.py")
SPEC = importlib.util.spec_from_file_location("prepare_round_guides", SOURCE)
PREPARE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PREPARE)
ORIGINAL_ROOT = PREPARE.ROOT


class GuideCopyTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="guide-copy-unit-")
        self.root = Path(self.temp.name)
        package = self.root / "packages/app"
        (package / "dist").mkdir(parents=True)
        (package / "package.json").write_text(json.dumps({"name": "@aperture-engine/app", "version": "0.0.0", "exports": {"./browser": "./dist/browser.js"}}))
        (package / "dist/browser.js").write_text("export const startGeneratedBrowserApp = () => {};\n")
        (self.root / "docs-site/src").mkdir(parents=True)
        (self.root / "examples").mkdir()
        (self.root / "docs").mkdir()
        (self.root / "docs/DIAGNOSTICS_CATALOG.md").write_bytes((ORIGINAL_ROOT / "docs/DIAGNOSTICS_CATALOG.md").read_bytes())
        for name in PREPARE.GUIDE_EXAMPLES:
            (self.root / "examples" / name).write_bytes((ORIGINAL_ROOT / "examples" / name).read_bytes())
        self.evidence = self.root / "evidence"; self.evidence.mkdir()
        (self.evidence / "method.json").write_text("{}")
        self.reference = self.evidence / "reference.png"; self.reference.write_bytes(b"synthetic reference")
        self.sdk = self.root / "sdk"; self.sdk.mkdir()
        self.logs = self.root / "logs"; self.logs.mkdir()
        self.origins = []
        self.patches = [patch.object(PREPARE, "ROOT", self.root), patch.object(PREPARE, "EVIDENCE", self.evidence), patch.object(PREPARE, "REFERENCE", self.reference), patch.object(PREPARE, "PUBLISHABLE", ("app",)), patch.object(PREPARE, "DOCS", ("DIAGNOSTICS_CATALOG.md",)), patch.object(PREPARE, "SETUP_INPUTS", ()), patch.object(PREPARE, "run", side_effect=self.fake_pack)]
        for item in self.patches: item.start()

    def tearDown(self):
        for item in reversed(self.patches): item.stop()
        self.temp.cleanup()

    def fake_pack(self, argv, **options):
        self.assertIn("--config.ignore-scripts=true", argv)
        destination = Path(argv[-1]) / "aperture-engine-app-0.0.0.tgz"
        with tarfile.open(destination, "w:gz") as archive:
            for relative in ["package.json", "dist/browser.js"]:
                raw = (self.root / "packages/app" / relative).read_bytes()
                info = tarfile.TarInfo("package/" + relative); info.size = len(raw)
                archive.addfile(info, io.BytesIO(raw))
        return None, 0

    def test_both_guide_inputs_are_inventoried_and_copied_with_exact_origins(self):
        inventory = PREPARE.repository_inputs()
        dependencies, _ = PREPARE.pack_sdk(self.sdk, self.logs, self.origins)
        self.assertIn("@aperture-engine/app", dependencies)
        catalog = self.root / "docs/DIAGNOSTICS_CATALOG.md"
        self.assertEqual((self.sdk / "docs/DIAGNOSTICS_CATALOG.md").read_bytes(), catalog.read_bytes())
        self.assertEqual(inventory["docs/DIAGNOSTICS_CATALOG.md"]["sha256"], hashlib.sha256(catalog.read_bytes()).hexdigest())
        for name in PREPARE.GUIDE_EXAMPLES:
            relative = "examples/" + name
            source = self.root / relative; destination = self.sdk / relative
            self.assertEqual(destination.read_bytes(), source.read_bytes())
            digest = hashlib.sha256(source.read_bytes()).hexdigest()
            self.assertEqual(inventory[relative]["sha256"], digest)
            origin = next(value for value in self.origins if value["source"] == relative)
            self.assertEqual(origin, {"source": relative, "destination": str(destination), "bytes": source.stat().st_size, "sha256": digest})
        config = json.loads((self.sdk / "examples/tsconfig.checked-browser-embedding.json").read_bytes())
        self.assertEqual(config["include"], ["./checked-browser-embedding.js"])
        self.assertTrue((self.sdk / "examples" / config["include"][0]).is_file())
        self.assertIn('"@aperture-engine/app/browser"', (self.sdk / "examples/checked-browser-embedding.js").read_text())

    def test_missing_or_linked_guide_refuses_instead_of_silently_omitting_it(self):
        guide = self.root / "examples" / PREPARE.GUIDE_EXAMPLES[0]
        guide.unlink()
        with self.assertRaises(PREPARE.PreparationError): PREPARE.pack_sdk(self.sdk, self.logs, self.origins)
        # A separate create-only synthetic SDK verifies the linked-source refusal.
        target = self.root / "external.js"; target.write_text("external")
        guide.symlink_to(target)
        other = self.root / "sdk-linked"; other.mkdir()
        with self.assertRaises(PREPARE.PreparationError): PREPARE.pack_sdk(other, self.logs, [])


if __name__ == "__main__": unittest.main()
