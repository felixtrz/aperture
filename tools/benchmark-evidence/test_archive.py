"""All generated examples are synthetic unit-test data, never benchmark evidence."""

import copy
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import struct
import zlib
import tempfile
import unittest
from unittest.mock import patch

MODULE = Path(__file__).with_name("archive.py")
SPEC = importlib.util.spec_from_file_location("benchmark_archive", MODULE)
archive = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(archive)
TIME = "2026-10-02T00:00:00Z"


def test_png():
    def chunk(kind, payload):
        return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", zlib.crc32(kind + payload))
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(b"\x00\xff\x00\x00")) + chunk(b"IEND", b""))


def fixture():
    artifacts = []
    names = {
        "sources": ("scene.ts", "source-file"),
        "references": ("brief.txt", "reference-file"),
        "settings": ("settings.json", "authored-record"),
        "pins": ("versions.json", "authored-record"),
        "renders": ("primary.png", "render-output"),
        "diagnostics": ("check.json", "tool-output"),
        "editchecks": ("edit.json", "tool-output"),
        "judgments": ("blind.txt", "blind-judge-output"),
        "transcripts": ("visible.txt", "visible-transcript-export"),
        "provenance": ("origin.json", "authored-record"),
    }
    for category, (name, kind) in names.items():
        artifacts.append({
            "path": f"{category}/{name}", "attempts": ["attempt-1"],
            "origin": {"kind": kind, "description": "SYNTHETIC TEST ONLY", "recorded_at": TIME},
        })
    return {
        "schema_version": 1, "run_id": "synthetic-test-only", "mode": "scored", "created_at": TIME,
        "source_revision": "a" * 40, "attempt_inventory_complete": True,
        "review": {"reviewer": "unit-test fixture", "reviewed_at": TIME,
                   "no_secrets_or_private_content": True, "only_authentic_evidence": True,
                   "all_known_attempts_and_available_artifacts_listed": True},
        "transcripts": {"status": "available", "note": "Synthetic test-only export"},
        "attempts": [{"id": "attempt-1", "outcome": "rendered", "note": "Synthetic fixture"}],
        "artifacts": artifacts, "gaps": [],
    }


class ArchiveTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="aperture-evidence-test-")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.source = self.root / "inputs"
        self.output = self.root / "runs"
        self.spec_path = self.root / "run.json"
        self.spec = fixture()
        for artifact in self.spec["artifacts"]:
            target = self.source / artifact["path"]
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(test_png() if target.suffix == ".png" else b"SYNTHETIC UNIT TEST BYTES: not a recovered benchmark\n")
        self.write_spec()

    def write_spec(self):
        self.spec_path.write_text(json.dumps(self.spec), encoding="utf-8")

    def seal(self):
        self.write_spec()
        return archive.seal(self.spec_path, self.source, self.output)

    def assert_rejected(self, phrase=None):
        self.write_spec()
        with self.assertRaisesRegex(archive.EvidenceError, phrase or "."):
            archive.seal(self.spec_path, self.source, self.output)
        self.assertFalse(self.output.exists(), "preflight failure must not leave a partial archive")

    def test_roundtrip_recovers_exact_bytes_without_originals(self):
        run, checksum = self.seal()
        before = {a["path"]: (self.source / a["path"]).read_bytes() for a in self.spec["artifacts"]}
        for path in self.source.rglob("*"):
            if path.is_file():
                path.unlink()
        result = archive.verify(run, require_scored=True, expected_sha256=checksum)
        self.assertEqual(result["spec"], self.spec)
        self.assertEqual({name: (run / name).read_bytes() for name in before}, before)
        self.assertEqual(result["total_bytes"], sum(map(len, before.values())))

    def test_existing_run_is_never_overwritten(self):
        run, checksum = self.seal()
        with self.assertRaisesRegex(archive.EvidenceError, "immutable run already exists"):
            self.seal()
        archive.verify(run, expected_sha256=checksum)

    def test_modified_file_is_rejected(self):
        run, _ = self.seal()
        (run / "sources/scene.ts").write_text("changed")
        with self.assertRaisesRegex(archive.EvidenceError, "artifact modified"):
            archive.verify(run)

    def test_modified_manifest_is_rejected(self):
        run, _ = self.seal()
        with (run / "manifest.json").open("ab") as stream:
            stream.write(b" ")
        with self.assertRaisesRegex(archive.EvidenceError, "manifest modified"):
            archive.verify(run)

    def test_external_hash_catches_rewritten_manifest_and_checksum(self):
        run, checksum = self.seal()
        manifest = json.loads((run / "manifest.json").read_text())
        manifest["spec"]["review"]["reviewer"] = "changed"
        data = archive.canonical(manifest)
        (run / "manifest.json").write_bytes(data)
        (run / "manifest.sha256").write_text(archive.digest(data) + "\n")
        with self.assertRaisesRegex(archive.EvidenceError, "externally anchored"):
            archive.verify(run, expected_sha256=checksum)

    def test_missing_source_fails(self):
        (self.source / "renders/primary.png").unlink()
        self.assert_rejected()

    def test_missing_archived_bytes_fail(self):
        run, _ = self.seal()
        (run / "renders/primary.png").unlink()
        with self.assertRaises(archive.EvidenceError):
            archive.verify(run)

    def test_unlisted_source_is_rejected(self):
        (self.source / "sources/unlisted.ts").write_text("unlisted")
        self.assert_rejected("inventory differs")

    def test_unlisted_archive_file_is_rejected(self):
        run, _ = self.seal()
        (run / "sources/unlisted.ts").write_text("unlisted")
        with self.assertRaisesRegex(archive.EvidenceError, "inventory differs"):
            archive.verify(run)

    def test_bad_paths_are_rejected(self):
        for path in ("../outside.txt", "/tmp/source.txt", "sources/../outside.txt",
                     "sources//x.ts", "sources/./x.ts", "sources\\evil.ts", "sources/.env",
                     "sources/con.txt", "sources/SOURCE.", "sources/credentials/value.json",
                     "sessions/chat.json", "transcripts/chain-of-thought/private.txt", "sources/archive.zip"):
            with self.subTest(path=path):
                candidate = copy.deepcopy(self.spec)
                candidate["artifacts"][0]["path"] = path
                with self.assertRaises(archive.EvidenceError):
                    archive.validate_spec(candidate)

    def test_duplicate_and_case_collision_rejected(self):
        for path in ("sources/scene.ts", "sources/Scene.ts", "sources/scene.ts/child.ts"):
            with self.subTest(path=path):
                candidate = copy.deepcopy(self.spec)
                item = copy.deepcopy(candidate["artifacts"][0])
                item["path"] = path
                candidate["artifacts"].append(item)
                with self.assertRaisesRegex(archive.EvidenceError, "colli"):
                    archive.validate_spec(candidate)

    def test_case_colliding_directory_inventory_rejected(self):
        path = self.source / "sources/Folder/a.ts"
        path.parent.mkdir()
        path.write_text("one")
        path = self.source / "sources/folder/b.ts"
        path.parent.mkdir()
        path.write_text("two")
        self.assert_rejected("case-colliding")

    def test_hardlinked_source_file_rejected(self):
        import os
        os.link(self.source / "sources/scene.ts", self.root / "external-alias.ts")
        self.assert_rejected("hardlinked file")

    def test_hardlinked_archive_file_and_metadata_rejected(self):
        import os
        run, _ = self.seal()
        for relative in ("sources/scene.ts", "manifest.json", "manifest.sha256"):
            with self.subTest(path=relative):
                alias = self.root / "external-alias"
                os.link(run / relative, alias)
                try:
                    with self.assertRaisesRegex(archive.EvidenceError, "hardlinked file"):
                        archive.verify(run)
                finally:
                    alias.unlink()
        archive.verify(run)

    def test_empty_scored_artifacts_rejected_in_every_category(self):
        for item in self.spec["artifacts"]:
            path = self.source / item["path"]
            original = path.read_bytes()
            with self.subTest(category=item["path"].split("/")[0]):
                path.write_bytes(b"")
                try:
                    self.assert_rejected("scored gate: empty evidence artifact")
                finally:
                    path.write_bytes(original)

    def test_self_consistent_empty_scored_archive_is_rejected(self):
        run, _ = self.seal()
        path = "sources/scene.ts"
        (run / path).write_bytes(b"")
        manifest = json.loads((run / "manifest.json").read_text())
        entry = next(item for item in manifest["files"] if item["path"] == path)
        manifest["total_bytes"] -= entry["bytes"]
        entry["bytes"], entry["sha256"] = 0, archive.digest(b"")
        data = archive.canonical(manifest)
        (run / "manifest.json").write_bytes(data)
        (run / "manifest.sha256").write_text(archive.digest(data) + "\n")
        with self.assertRaisesRegex(archive.EvidenceError, "scored gate: empty evidence artifact"):
            archive.verify(run, require_scored=True)

    def test_nonrender_empty_bytes_preserved_only_as_exploratory(self):
        self.spec["mode"] = "exploratory"
        (self.source / "diagnostics/check.json").write_bytes(b"")
        self.spec["gaps"] = [{"scope": "attempt-1", "category": "diagnostics", "reason": "Original diagnostic file empty"}]
        run, _ = self.seal()
        self.assertEqual((run / "diagnostics/check.json").read_bytes(), b"")
        archive.verify(run)
        with self.assertRaisesRegex(archive.EvidenceError, "exploratory run"):
            archive.verify(run, require_scored=True)

    def test_symlink_source_rejected(self):
        path = self.source / "sources/scene.ts"
        path.unlink()
        path.symlink_to(self.spec_path)
        self.assert_rejected("symlink")

    def test_symlink_directory_and_root_rejected(self):
        linked = self.root / "linked"
        linked.symlink_to(self.source, target_is_directory=True)
        with self.assertRaisesRegex(archive.EvidenceError, "symlink"):
            archive.seal(self.spec_path, linked, self.output)
        (self.source / "sources/linked").symlink_to(self.root, target_is_directory=True)
        self.assert_rejected("symlink")

    def test_archived_symlink_rejected(self):
        run, _ = self.seal()
        path = run / "sources/scene.ts"
        path.unlink()
        path.symlink_to(self.source / "sources/scene.ts")
        with self.assertRaisesRegex(archive.EvidenceError, "symlink"):
            archive.verify(run)

    def test_special_file_rejected_without_reading_it(self):
        import os
        os.mkfifo(self.source / "sources/pipe.txt")
        self.assert_rejected("special file")

    def test_oversized_file_disclosed_and_not_written(self):
        with patch.object(archive, "MAX_FILE_BYTES", 10):
            self.assert_rejected("oversized artifact.*nothing omitted")

    def test_invalid_and_truncated_image_containers_rejected(self):
        for data in (b"text pretending to be an image", test_png()[:-1], test_png() + b"trailing"):
            with self.subTest(data=data[:10]):
                (self.source / "renders/primary.png").write_bytes(data)
                self.assert_rejected("PNG")
        for name, data in (("renders/frame.jpg", b"not jpeg"), ("renders/frame.webp", b"not webp")):
            with self.assertRaises(archive.EvidenceError):
                archive.validate_image(name, data)

    def test_total_size_limit_disclosed(self):
        with patch.object(archive, "MAX_TOTAL_BYTES", 60):
            self.assert_rejected("oversized run.*nothing omitted")

    def test_review_required(self):
        for name in ("no_secrets_or_private_content", "only_authentic_evidence",
                     "all_known_attempts_and_available_artifacts_listed"):
            candidate = copy.deepcopy(self.spec)
            candidate["review"][name] = False
            with self.assertRaisesRegex(archive.EvidenceError, "review not attested"):
                archive.validate_spec(candidate)

    def test_no_summary_substitute_for_transcript(self):
        item = next(a for a in self.spec["artifacts"] if a["path"].startswith("transcripts/"))
        item["origin"]["kind"] = "authored-record"
        self.assert_rejected("origin kind")

    def test_available_transcripts_require_files(self):
        self.spec["artifacts"] = [a for a in self.spec["artifacts"] if not a["path"].startswith("transcripts/")]
        self.assert_rejected("authentic export bytes")

    def test_explicit_unavailable_transcripts_allowed(self):
        self.spec["artifacts"] = [a for a in self.spec["artifacts"] if not a["path"].startswith("transcripts/")]
        self.spec["transcripts"] = {"status": "unavailable", "note": "No authentic export accessible; never reconstructed"}
        (self.source / "transcripts/visible.txt").unlink()
        (self.source / "transcripts").rmdir()
        run, _ = self.seal()
        archive.verify(run, require_scored=True)

    def test_all_attempts_need_evidence_not_just_final_attempt(self):
        self.spec["attempts"].append({"id": "attempt-2", "outcome": "rendered", "note": "Synthetic second attempt"})
        self.assert_rejected("missing evidence needs explicit gaps")

    def test_exploratory_gaps_preserved_but_never_pass_scored_gate(self):
        self.spec["mode"] = "exploratory"
        self.spec["attempt_inventory_complete"] = False
        self.spec["gaps"] = [{"scope": "run", "category": "attempts", "reason": "Attempt count unknown"}]
        run, _ = self.seal()
        self.assertEqual(archive.verify(run)["spec"]["gaps"], self.spec["gaps"])
        with self.assertRaisesRegex(archive.EvidenceError, "exploratory run"):
            archive.verify(run, require_scored=True)

    def test_unknown_attempt_inventory_cannot_be_scored(self):
        self.spec["attempt_inventory_complete"] = False
        self.spec["gaps"] = [{"scope": "run", "category": "attempts", "reason": "Unknown"}]
        self.assert_rejected("scored gate")

    def test_nonblind_judgment_cannot_be_scored(self):
        next(a for a in self.spec["artifacts"] if a["path"].startswith("judgments/"))["origin"]["kind"] = "judge-output"
        self.assert_rejected("blind-judge")

    def test_partial_category_gap_cannot_be_scored(self):
        self.spec["gaps"] = [{"scope": "attempt-1", "category": "renders", "reason": "One camera render was lost"}]
        self.assert_rejected("scored gate")

    def test_failed_before_render_needs_no_invented_images(self):
        self.spec["attempts"].append({"id": "attempt-2", "outcome": "failed-before-render", "note": "Synthetic failure"})
        for item in self.spec["artifacts"]:
            if item["path"].split("/")[0] in {"sources", "settings", "diagnostics", "editchecks"}:
                item["attempts"].append("attempt-2")
        run, _ = self.seal()
        archive.verify(run, require_scored=True)

    def test_duplicate_json_keys_and_nonfinite_numbers_rejected(self):
        for content in (b'{"schema_version":1,"schema_version":1}', b'{"x":NaN}', b'{"x":Infinity}'):
            with self.assertRaises(archive.EvidenceError):
                archive.parse_json(content)

    def test_unknown_fields_and_invalid_time_rejected(self):
        self.spec["created_at"] = "2026-99-99T00:00:00Z"
        self.assert_rejected("invalid date")
        self.spec["created_at"] = TIME
        self.spec["surprise"] = "not allowed"
        self.assert_rejected("expected fields")

    def test_archive_cannot_live_inside_source(self):
        with self.assertRaisesRegex(archive.EvidenceError, "must not be inside"):
            archive.seal(self.spec_path, self.source, self.source / "runs")

    def test_cli_exit_status_and_roundtrip(self):
        seal = subprocess.run([sys.executable, str(MODULE), "seal", "--spec", str(self.spec_path),
                               "--source", str(self.source), "--archive-root", str(self.output)],
                              capture_output=True, text=True)
        self.assertEqual(seal.returncode, 0, seal.stderr)
        run = self.output / self.spec["run_id"]
        verify = subprocess.run([sys.executable, str(MODULE), "verify", str(run), "--require-scored"], capture_output=True, text=True)
        self.assertEqual(verify.returncode, 0, verify.stderr)
        (run / "sources/scene.ts").write_text("changed")
        bad = subprocess.run([sys.executable, str(MODULE), "verify", str(run)], capture_output=True, text=True)
        self.assertEqual(bad.returncode, 1)
        self.assertIn("artifact modified", bad.stderr)


if __name__ == "__main__":
    unittest.main()
