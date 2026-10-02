"""Only synthetic fixtures created under this directory may be deleted by tests."""
import contextlib
import fcntl
import hashlib
import io
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import tempfile
import time
import unittest
from unittest import mock

import cleanup as c

HERE = Path(__file__).absolute().parent
FIXTURES = HERE / ".test-fixtures"
FIXTURES.mkdir(exist_ok=True)


class CleanupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="synthetic-", dir=FIXTURES)
        self.base = Path(self.temp.name)
        self.root = self.base / "aperture-tmp"
        self.audit = self.base / "audit"
        self.cfg = c.Config(str(self.root), str(self.audit), frozenset((str(self.root),)))
        c.initialize(self.cfg)
        self.run = self.make_run()
        self.path = self.root / self.run
        self.add("render.bin", b"reproducible pixels")
        self.complete()
        self.future = time.time_ns() + 25 * 3600 * 1_000_000_000

    def tearDown(self):
        # This randomly named directory was created in setUp by this test only.
        self.temp.cleanup()

    def make_run(self):
        with c.Store(self.cfg) as store, store.locked():
            return c.new_run(store, "synthetic-test", "Run the synthetic fixture generator")

    def add(self, name, data, run=None):
        run = run or self.run
        (self.root / run / name).write_bytes(data)
        c.register(self.cfg, run, name, "render-intermediate", "Regenerate these synthetic pixels")

    def complete(self, run=None):
        with c.Store(self.cfg) as store, store.locked():
            c.complete_run(store, run or self.run, 0)

    def manifest(self):
        return json.loads((self.path / c.MANIFEST).read_text())

    def write_manifest(self, m):
        (self.path / c.MANIFEST).write_text(json.dumps(m))

    def scan(self, apply=False):
        return c.scan(self.cfg, apply=apply, now_ns=self.future)

    def preserved(self):
        result = self.scan(apply=True)
        self.assertEqual(result[0]["status"], "preserved", result)
        self.assertTrue((self.path / "render.bin").exists())
        return result

    def test_default_allowlist_has_only_two_explicit_roots(self):
        self.assertEqual(c.ALLOWED_ROOTS, {c.DEFAULT_ROOT, c.RECOVERY_ROOT})
        self.assertNotIn("/tmp", c.ALLOWED_ROOTS)

    def test_cli_rejects_arbitrary_root(self):
        self.assertEqual(c.main(["--root", str(self.root), "scan"]), 2)

    def test_init_never_adopts_existing_root(self):
        with self.assertRaises(FileExistsError):
            c.initialize(self.cfg)

    def test_init_does_not_create_missing_parent(self):
        path = str(self.base / "absent" / "aperture-tmp")
        cfg = c.Config(path, str(self.audit), frozenset((path,)))
        with self.assertRaises(FileNotFoundError):
            c.initialize(cfg)
        self.assertFalse((self.base / "absent").exists())

    def test_dry_run_default_leaves_all_run_bytes_unchanged(self):
        before = {p.name: p.read_bytes() for p in self.path.iterdir()}
        r = self.scan()
        self.assertEqual(r[0]["status"], "would-delete")
        self.assertEqual(before, {p.name: p.read_bytes() for p in self.path.iterdir()})

    def test_explicit_apply_removes_only_registered_artifact(self):
        result = self.scan(apply=True)
        self.assertEqual(result[0]["status"], "deleted", result)
        self.assertEqual(set(p.name for p in self.path.iterdir()), set(c.META))
        self.assertEqual(self.manifest()["state"], "retired")
        self.assertTrue((self.root / c.MARKER).exists())
        self.assertTrue((self.root / c.LOCK).exists())

    def test_retired_runs_are_preserved_on_second_scan(self):
        self.scan(apply=True)
        self.assertEqual(self.scan(apply=True)[0]["status"], "preserved")

    def test_fresh_run_is_not_eligible(self):
        self.future = time.time_ns()
        self.preserved()

    def test_under_24_hours_is_not_eligible(self):
        self.future = time.time_ns() + 23 * 3600 * 1_000_000_000
        self.preserved()

    def test_future_completion_is_not_eligible(self):
        m = self.manifest()
        m["completed_ns"] = self.future + 1
        self.write_manifest(m)
        self.preserved()

    def test_active_run_never_force_expires(self):
        m = self.manifest()
        m.update(state="active", created_ns=1)
        m.pop("completed_ns")
        self.write_manifest(m)
        self.future += 3650 * 24 * 3600 * 1_000_000_000
        self.preserved()

    def test_unknown_file_preserves_entire_run(self):
        (self.path / "important.txt").write_text("not registered")
        self.preserved()
        self.assertTrue((self.path / "important.txt").exists())

    def test_nested_directory_preserves_entire_run(self):
        (self.path / "nested").mkdir()
        (self.path / "nested" / "anything").write_text("preserve")
        self.preserved()

    def test_unregistered_symlink_preserves_entire_run(self):
        outside = self.base / "outside.bin"
        outside.write_text("outside")
        (self.path / "escape").symlink_to(outside)
        self.preserved()
        self.assertEqual(outside.read_text(), "outside")

    def test_registered_symlink_replacement_preserves_target(self):
        outside = self.base / "outside.bin"
        outside.write_text("outside")
        (self.path / "render.bin").unlink()
        (self.path / "render.bin").symlink_to(outside)
        self.preserved()
        self.assertEqual(outside.read_text(), "outside")

    def test_registered_hardlink_replacement_preserves_both_links(self):
        outside = self.base / "outside.bin"
        outside.write_text("outside")
        (self.path / "render.bin").unlink()
        os.link(outside, self.path / "render.bin")
        self.preserved()
        self.assertTrue(outside.exists())

    def test_new_hardlink_after_registration_preserves_run(self):
        outside = self.base / "linked.bin"
        os.link(self.path / "render.bin", outside)
        self.preserved()
        self.assertTrue(outside.exists())

    def test_changed_hash_preserves_run(self):
        (self.path / "render.bin").write_bytes(b"different pixels!!")
        self.preserved()

    def test_same_bytes_new_inode_preserves_run(self):
        replacement = self.base / "replacement.bin"
        replacement.write_bytes((self.path / "render.bin").read_bytes())
        os.replace(replacement, self.path / "render.bin")
        self.preserved()

    def test_missing_registered_file_preserves_other_files(self):
        run = self.make_run()
        self.add("one.bin", b"1", run)
        self.add("two.bin", b"2", run)
        self.complete(run)
        (self.root / run / "one.bin").unlink()
        result = self.scan(apply=True)
        self.assertEqual(next(r for r in result if r["run"] == run)["status"], "preserved")
        self.assertTrue((self.root / run / "two.bin").exists())

    def test_symlink_root_rejected(self):
        displaced = self.base / "displaced"
        self.root.rename(displaced)
        self.root.symlink_to(displaced, target_is_directory=True)
        with self.assertRaises(OSError):
            self.scan(apply=True)
        self.assertTrue((displaced / self.run / "render.bin").exists())

    def test_symlink_parent_rejected(self):
        alias = self.base / "alias"
        alias.symlink_to(self.base, target_is_directory=True)
        path = str(alias / "aperture-tmp")
        cfg = c.Config(path, str(self.audit), frozenset((path,)))
        with self.assertRaises(OSError):
            c.scan(cfg, apply=True, now_ns=self.future)

    def test_root_relocation_marker_mismatch_rejected(self):
        new = self.base / "new-root"
        self.root.rename(new)
        cfg = c.Config(str(new), str(self.audit), frozenset((str(new),)))
        with self.assertRaises(c.Unsafe):
            c.scan(cfg, apply=True, now_ns=self.future)

    def test_run_symlink_is_never_followed(self):
        displaced = self.base / "displaced"
        self.path.rename(displaced)
        self.path.symlink_to(displaced, target_is_directory=True)
        result = self.scan(apply=True)
        self.assertEqual(result[0]["status"], "preserved")
        self.assertTrue((displaced / "render.bin").exists())

    def test_manifest_symlink_is_not_followed(self):
        other = self.base / "other.json"
        (self.path / c.MANIFEST).rename(other)
        (self.path / c.MANIFEST).symlink_to(other)
        self.preserved()
        self.assertTrue(other.exists())

    def test_manifest_hardlink_rejected(self):
        os.link(self.path / c.MANIFEST, self.base / "copy.json")
        self.preserved()

    def test_lock_symlink_rejected(self):
        outside = self.base / "lock"
        outside.write_text("")
        (self.root / c.LOCK).unlink()
        (self.root / c.LOCK).symlink_to(outside)
        with self.assertRaises(OSError):
            self.scan(apply=True)

    def test_lock_inode_replacement_detected_on_acquire(self):
        with c.Store(self.cfg) as store:
            (self.root / c.LOCK).rename(self.base / "old-lock")
            (self.root / c.LOCK).write_text("")
            with self.assertRaises(c.Unsafe):
                with store.locked(exclusive=True):
                    self.fail("must never enter critical section")

    def test_unknown_root_entry_is_preserved_without_recursion(self):
        directory = self.root / "unrecognized"
        directory.mkdir()
        (directory / "unique.txt").write_text("preserve")
        self.scan(apply=True)
        self.assertEqual((directory / "unique.txt").read_text(), "preserve")

    def test_group_writable_run_is_preserved(self):
        self.path.chmod(0o770)
        self.preserved()

    def test_group_writable_artifact_is_preserved(self):
        (self.path / "render.bin").chmod(0o660)
        self.preserved()

    def test_duplicate_json_keys_rejected(self):
        old = (self.path / c.MANIFEST).read_text()
        (self.path / c.MANIFEST).write_text('{"state":"active",' + old[1:])
        self.preserved()

    def test_large_metadata_rejected(self):
        (self.path / c.MANIFEST).write_bytes(b" " * (c.MAX_JSON + 1))
        self.preserved()

    def test_invalid_manifest_fields_preserve(self):
        for mutate in [lambda m: m.update(state="unknown"),
                       lambda m: m.update(completed_ns=True),
                       lambda m: m.update(created_ns=0),
                       lambda m: m.update(recreation=""),
                       lambda m: m.update(completed_ns=1),
                       lambda m: m["files"]["render.bin"].update(inode=True),
                       lambda m: m["files"]["render.bin"].update(sha256="x"),
                       lambda m: m["files"]["render.bin"].update(kind="source")]:
            with self.subTest(mutate=mutate):
                old = self.manifest()
                changed = json.loads(json.dumps(old))
                mutate(changed)
                self.write_manifest(changed)
                self.preserved()
                self.write_manifest(old)

    def test_unregistered_pending_metadata_preserves(self):
        (self.path / ".pending-interrupted").write_text("partial metadata")
        self.preserved()

    def test_nonempty_registry_lock_preserves(self):
        (self.path / c.REGISTER_LOCK).write_text("unexpected")
        self.preserved()

    def test_protected_and_nonflat_names_cannot_register(self):
        run = self.make_run()
        for name in ["../escape", "dir/file", "/absolute", ".hidden", "source.ts", "fix.patch", "ledger.json", "full-transcript.txt", "judge-evidence.png", "deliverable.png", "reference.png", "backlog.md"]:
            with self.subTest(name=name), self.assertRaises(c.Unsafe):
                c.register(self.cfg, run, name, "scratch", "regenerate")

    def test_symlink_cannot_register(self):
        run = self.make_run()
        (self.root / run / "link.bin").symlink_to(self.path / "render.bin")
        with self.assertRaises(OSError):
            c.register(self.cfg, run, "link.bin", "scratch", "regenerate")

    def test_completed_run_cannot_register(self):
        with self.assertRaises(c.Unsafe):
            c.register(self.cfg, self.run, "render.bin", "scratch", "regenerate")

    def test_registration_does_not_implicitly_register_neighbors(self):
        run = self.make_run()
        (self.root / run / "unknown.bin").write_text("unregistered")
        self.add("one.bin", b"1", run)
        self.complete(run)
        r = next(r for r in self.scan(apply=True) if r["run"] == run)
        self.assertEqual(r["status"], "preserved")
        self.assertTrue((self.root / run / "one.bin").exists())

    def test_duplicate_registration_rejected(self):
        run = self.make_run()
        self.add("one.bin", b"1", run)
        with self.assertRaises(c.Unsafe):
            c.register(self.cfg, run, "one.bin", "scratch", "regenerate")

    def test_shared_lifecycle_lock_makes_cleaner_nonblocking_busy(self):
        with c.Store(self.cfg) as store, store.locked():
            start = time.monotonic()
            result = self.scan(apply=True)
            self.assertEqual(result[0]["status"], "busy")
            self.assertLess(time.monotonic() - start, 1)
            self.assertTrue((self.path / "render.bin").exists())

    def test_exclusive_lock_blocks_registration(self):
        run = self.make_run()
        (self.root / run / "one.bin").write_text("1")
        with c.Store(self.cfg) as store, store.locked(exclusive=True), self.assertRaises(c.Busy):
            c.register(self.cfg, run, "one.bin", "scratch", "regenerate")

    def test_audit_directory_inside_root_rejected(self):
        cfg = c.Config(str(self.root), str(self.root / "audit"), frozenset((str(self.root),)))
        with self.assertRaises(c.Unsafe):
            c.scan(cfg, apply=True, now_ns=self.future)

    def test_audit_symlink_rejected_before_delete(self):
        outside = self.base / "audit-target"
        outside.mkdir()
        self.audit.symlink_to(outside, target_is_directory=True)
        with self.assertRaises(OSError):
            self.scan(apply=True)
        self.assertTrue((self.path / "render.bin").exists())

    def test_audit_failure_prevents_deletion(self):
        with mock.patch.object(c.Audit, "emit", side_effect=OSError("audit unavailable")):
            with self.assertRaises(OSError):
                self.scan(apply=True)
        self.assertTrue((self.path / "render.bin").exists())

    def test_audit_is_external_and_contains_full_hash_registry(self):
        self.scan(apply=True)
        events = [json.loads(line) for p in self.audit.iterdir() for line in p.read_text().splitlines()]
        intent = next(e for e in events if e["event"] == "delete-intent")
        self.assertEqual(intent["manifest"]["files"]["render.bin"]["sha256"], hashlib.sha256(b"reproducible pixels").hexdigest())
        self.assertTrue(any(e["event"] == "retired-run" for e in events))

    def test_inventory_race_after_planning_preserves_entire_run(self):
        original = c.apply_plan
        def race(store, fd, plan, audit, now_ns):
            (self.path / "arrived.bin").write_text("preserve")
            return original(store, fd, plan, audit, now_ns)
        with mock.patch.object(c, "apply_plan", side_effect=race):
            self.preserved()
        self.assertTrue((self.path / "arrived.bin").exists())

    def test_inode_race_after_planning_preserves_entire_run(self):
        original = c.apply_plan
        def race(store, fd, plan, audit, now_ns):
            replacement = self.base / "replacement.bin"
            replacement.write_bytes((self.path / "render.bin").read_bytes())
            os.replace(replacement, self.path / "render.bin")
            return original(store, fd, plan, audit, now_ns)
        with mock.patch.object(c, "apply_plan", side_effect=race):
            self.preserved()

    def test_symlink_race_after_audit_intent_preserves_target_and_run(self):
        outside = self.base / "outside.bin"
        outside.write_text("preserve")
        original = c.Audit.emit
        def race(audit, event, **fields):
            original(audit, event, **fields)
            if event == "delete-intent":
                (self.path / "render.bin").unlink()
                (self.path / "render.bin").symlink_to(outside)
        with mock.patch.object(c.Audit, "emit", new=race):
            self.preserved()
        self.assertEqual(outside.read_text(), "preserve")

    def test_root_path_swap_after_audit_intent_prevents_deletion(self):
        original = c.Audit.emit
        displaced = self.base / "displaced"
        def race(audit, event, **fields):
            original(audit, event, **fields)
            if event == "delete-intent":
                self.root.rename(displaced)
                self.root.mkdir()
        with mock.patch.object(c.Audit, "emit", new=race):
            self.assertEqual(self.scan(apply=True)[0]["status"], "preserved")
        self.assertTrue((displaced / self.run / "render.bin").exists())

    def test_directory_inode_swap_after_planning_prevents_deletion(self):
        original = c.apply_plan
        displaced = self.base / "displaced"
        def race(store, fd, plan, audit, now_ns):
            self.path.rename(displaced)
            self.path.mkdir()
            return original(store, fd, plan, audit, now_ns)
        with mock.patch.object(c, "apply_plan", side_effect=race):
            self.assertEqual(self.scan(apply=True)[0]["status"], "preserved")
        self.assertTrue((displaced / "render.bin").exists())

    def test_atomic_capture_replacement_race_preserves_unregistered_inode(self):
        original = c.rename_noreplace
        replacement = self.base / "replacement.bin"
        replacement.write_bytes((self.path / "render.bin").read_bytes())
        replacement_inode = replacement.stat().st_ino
        fired = False
        def race(src_fd, src, dst_fd, dst):
            nonlocal fired
            if src == "render.bin" and not fired:
                fired = True
                os.replace(replacement, self.path / "render.bin")
            return original(src_fd, src, dst_fd, dst)
        with mock.patch.object(c, "rename_noreplace", side_effect=race):
            result = self.preserved()
        self.assertEqual((self.path / "render.bin").stat().st_ino, replacement_inode)
        self.assertEqual(result[0].get("deleted_files"), [])

    def test_atomic_capture_symlink_race_restores_symlink_without_following(self):
        original = c.rename_noreplace
        outside = self.base / "outside.bin"
        outside.write_text("preserve")
        fired = False
        def race(src_fd, src, dst_fd, dst):
            nonlocal fired
            if src == "render.bin" and not fired:
                fired = True
                (self.path / "render.bin").unlink()
                (self.path / "render.bin").symlink_to(outside)
            return original(src_fd, src, dst_fd, dst)
        with mock.patch.object(c, "rename_noreplace", side_effect=race):
            self.preserved()
        self.assertTrue((self.path / "render.bin").is_symlink())
        self.assertEqual(outside.read_text(), "preserve")

    def test_late_original_path_replacement_preserves_both_versions(self):
        original = c.Audit.emit
        def race(audit, event, **fields):
            original(audit, event, **fields)
            if event == "captured-files":
                (self.path / "render.bin").write_text("new unregistered arrival")
        with mock.patch.object(c.Audit, "emit", new=race):
            result = self.preserved()
        self.assertEqual((self.path / "render.bin").read_text(), "new unregistered arrival")
        staging = self.root / result[0]["staging"]
        self.assertEqual((staging / "render.bin").read_bytes(), b"reproducible pixels")
        self.assertEqual(result[0]["deleted_files"], [])
        # Unknown interrupted retirement folders are never automatically adopted.
        self.assertTrue(any(r["run"] == staging.name and r["status"] == "preserved" for r in self.scan(apply=True)))

    def test_unknown_file_arriving_after_capture_preserves_all_bytes(self):
        original = c.Audit.emit
        def race(audit, event, **fields):
            original(audit, event, **fields)
            if event == "captured-files":
                (self.path / "late.bin").write_text("preserve")
        with mock.patch.object(c.Audit, "emit", new=race):
            self.preserved()
        self.assertTrue((self.path / "late.bin").exists())

    def test_failed_second_capture_restores_first_without_deletion(self):
        run = self.make_run()
        self.add("one.bin", b"one", run)
        self.add("two.bin", b"two", run)
        self.complete(run)
        original = c.rename_noreplace
        def failure(src_fd, src, dst_fd, dst):
            if src == "two.bin":
                raise OSError("synthetic capture failure")
            return original(src_fd, src, dst_fd, dst)
        with mock.patch.object(c, "rename_noreplace", side_effect=failure):
            result = next(r for r in self.scan(apply=True) if r["run"] == run)
        self.assertEqual(result["status"], "preserved")
        self.assertEqual((self.root / run / "one.bin").read_bytes(), b"one")
        self.assertEqual((self.root / run / "two.bin").read_bytes(), b"two")

    def test_disk_error_after_first_unlink_is_reported_as_partial(self):
        run = self.make_run()
        self.add("one.bin", b"one", run)
        self.add("two.bin", b"two", run)
        self.complete(run)
        original = os.unlink
        def failure(name, *args, **kwargs):
            if name == "two.bin":
                raise OSError("synthetic disk error")
            return original(name, *args, **kwargs)
        with mock.patch.object(c.os, "unlink", side_effect=failure):
            result = next(r for r in self.scan(apply=True) if r["run"] == run)
        self.assertEqual(result["status"], "stopped-partial")
        self.assertEqual(result["deleted_files"], ["one.bin"])
        self.assertEqual((self.root / run / "two.bin").read_bytes(), b"two")

    def test_fsync_error_after_unlink_reports_actual_partial_deletion(self):
        original_unlink = os.unlink
        original_fsync = os.fsync
        removed = False
        failed = False
        def unlink(name, *args, **kwargs):
            nonlocal removed
            original_unlink(name, *args, **kwargs)
            if name == "render.bin":
                removed = True
        def fsync(fd):
            nonlocal failed
            if removed and not failed:
                failed = True
                raise OSError("synthetic flush error")
            return original_fsync(fd)
        with mock.patch.object(c.os, "unlink", side_effect=unlink), mock.patch.object(c.os, "fsync", side_effect=fsync):
            result = self.scan(apply=True)
        self.assertEqual(result[0]["status"], "stopped-partial")
        self.assertEqual(result[0]["deleted_files"], ["render.bin"])

    def test_wrapper_routes_standard_temp_environment_to_run(self):
        command = "import os; assert all(os.environ[k] == os.environ['APERTURE_TMP_RUN'] for k in ('TMPDIR','TEMP','TMP'))"
        out, err, rc = self.wrapper([sys.executable, "-c", command])
        self.assertEqual(rc, 0, err)

    def test_partial_failure_stops_scan_before_other_runs(self):
        run = self.make_run()
        self.add("second.bin", b"second", run)
        self.complete(run)
        with mock.patch.object(c, "apply_plan", side_effect=c.RetirementInterrupted("synthetic error", ["fake.bin"], ".retiring-synthetic")) as apply:
            result = self.scan(apply=True)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["status"], "stopped-partial")
        self.assertEqual(apply.call_count, 1)
        self.assertTrue((self.path / "render.bin").exists())
        self.assertTrue((self.root / run / "second.bin").exists())

    def test_cli_partial_result_has_failure_exit_code(self):
        with mock.patch.object(c, "scan", return_value=[{"status": "stopped-partial", "deleted_files": ["synthetic.bin"]}]):
            with open(os.devnull, "w") as sink, contextlib.redirect_stdout(sink):
                self.assertEqual(c.main(["scan", "--apply"]), 3)

    def test_fifo_artifact_replacement_is_rejected_without_blocking(self):
        (self.path / "render.bin").unlink()
        os.mkfifo(self.path / "render.bin", 0o600)
        start = time.monotonic()
        self.preserved()
        self.assertLess(time.monotonic() - start, 1)

    def test_unknown_staging_entry_preserves_registered_and_unknown_bytes(self):
        original = c.Audit.emit
        staging = None
        def race(audit, event, **fields):
            nonlocal staging
            original(audit, event, **fields)
            if event == "captured-files":
                staging = self.root / fields["staging"]
                (staging / "unknown.bin").write_text("preserve")
        with mock.patch.object(c.Audit, "emit", new=race):
            self.preserved()
        self.assertEqual((staging / "unknown.bin").read_text(), "preserve")
        self.assertTrue((self.path / "render.bin").exists())

    def test_wrapper_and_registration_complete_end_to_end(self):
        command = "import os, pathlib, cleanup as c; root=os.environ['APERTURE_TMP_ROOT']; c.ALLOWED_ROOTS=frozenset((root,)); pathlib.Path(os.environ['APERTURE_TMP_RUN'],'cache.bin').write_bytes(b'regenerate'); raise SystemExit(c.main(['--root',root,'register','--run',os.environ['APERTURE_TMP_RUN_ID'],'--file','cache.bin','--kind','scratch','--recreation','Regenerate synthetic bytes']))"
        out, err, rc = self.wrapper([sys.executable, "-c", command])
        self.assertEqual(rc, 0, err)
        run = json.loads(out.splitlines()[0])["run"]
        manifest = json.loads((self.root / run / c.MANIFEST).read_text())
        self.assertEqual(manifest["state"], "completed")
        self.assertEqual(set(manifest["files"]), {"cache.bin"})
        dry = next(r for r in self.scan() if r["run"] == run)
        self.assertEqual(dry["status"], "would-delete")
        result = next(r for r in self.scan(apply=True) if r["run"] == run)
        self.assertEqual(result["status"], "deleted")

    def test_audit_parent_fsync_precedes_first_record_write(self):
        events = []
        parent_inode = c.identity(self.base.stat())
        original_mkdir, original_fsync, original_write = os.mkdir, os.fsync, os.write
        def mkdir(name, *args, **kwargs):
            result = original_mkdir(name, *args, **kwargs)
            if name == self.audit.name:
                events.append("audit-directory-created")
            return result
        def fsync(fd):
            if c.identity(os.fstat(fd)) == parent_inode:
                events.append("audit-parent-fsynced")
            return original_fsync(fd)
        def write(fd, raw):
            events.append("audit-record-write")
            return original_write(fd, raw)
        with mock.patch.object(c.os, "mkdir", side_effect=mkdir), mock.patch.object(c.os, "fsync", side_effect=fsync), mock.patch.object(c.os, "write", side_effect=write):
            with c.Audit(self.cfg) as audit:
                audit.emit("synthetic-order-check")
        self.assertLess(events.index("audit-directory-created"), events.index("audit-parent-fsynced"))
        self.assertLess(events.index("audit-parent-fsynced"), events.index("audit-record-write"))

    def test_staging_parent_fsync_precedes_first_atomic_capture(self):
        events = []
        root_inode = c.identity(self.root.stat())
        original_mkdir, original_fsync, original_rename = os.mkdir, os.fsync, c.rename_noreplace
        def mkdir(name, *args, **kwargs):
            result = original_mkdir(name, *args, **kwargs)
            if str(name).startswith(".retiring-"):
                events.append("staging-created")
            return result
        def fsync(fd):
            if c.identity(os.fstat(fd)) == root_inode:
                events.append("root-fsynced")
            return original_fsync(fd)
        def rename(*args):
            events.append("capture")
            return original_rename(*args)
        with mock.patch.object(c.os, "mkdir", side_effect=mkdir), mock.patch.object(c.os, "fsync", side_effect=fsync), mock.patch.object(c, "rename_noreplace", side_effect=rename):
            self.assertEqual(self.scan(apply=True)[0]["status"], "deleted")
        self.assertLess(events.index("staging-created"), events.index("root-fsynced"))
        self.assertLess(events.index("root-fsynced"), events.index("capture"))

    def test_audit_parent_fsync_failure_prevents_capture_and_delete(self):
        original = os.fsync
        parent_inode = c.identity(self.base.stat())
        def fsync(fd):
            if c.identity(os.fstat(fd)) == parent_inode:
                raise OSError("synthetic audit-parent durability failure")
            return original(fd)
        with mock.patch.object(c.os, "fsync", side_effect=fsync), mock.patch.object(c, "rename_noreplace") as capture:
            with self.assertRaises(OSError):
                self.scan(apply=True)
        capture.assert_not_called()
        self.assertEqual((self.path / "render.bin").read_bytes(), b"reproducible pixels")

    def test_staging_parent_fsync_failure_prevents_capture_and_delete(self):
        original = os.fsync
        root_inode = c.identity(self.root.stat())
        def fsync(fd):
            if c.identity(os.fstat(fd)) == root_inode:
                raise OSError("synthetic staging-parent durability failure")
            return original(fd)
        with mock.patch.object(c.os, "fsync", side_effect=fsync), mock.patch.object(c, "rename_noreplace") as capture:
            self.preserved()
        capture.assert_not_called()
        self.assertEqual((self.path / "render.bin").read_bytes(), b"reproducible pixels")

    def test_run_directory_recent_mtime_blocks_retirement(self):
        recent = self.future - 1_000_000_000
        os.utime(self.path, ns=(recent, recent))
        self.preserved()

    def test_run_directory_recent_ctime_blocks_retirement(self):
        # Inject only the run-directory ctime so old files cannot hide activity.
        original = os.fstat
        run_inode = c.identity(self.path.stat())
        def fstat(fd):
            st = original(fd)
            if c.identity(st) != run_inode:
                return st
            fake = mock.Mock(wraps=st)
            for field in ("st_dev", "st_ino", "st_size", "st_mode", "st_uid", "st_nlink", "st_mtime_ns"):
                setattr(fake, field, getattr(st, field))
            fake.st_ctime_ns = self.future - 1_000_000_000
            return fake
        with mock.patch.object(c.os, "fstat", side_effect=fstat):
            self.preserved()

    def test_run_permission_change_after_audit_intent_prevents_deletion(self):
        original = c.Audit.emit
        def race(audit, event, **fields):
            original(audit, event, **fields)
            if event == "delete-intent":
                self.path.chmod(0o777)
        with mock.patch.object(c.Audit, "emit", new=race):
            self.preserved()

    def test_run_permission_change_after_capture_preserves_captured_bytes(self):
        original = c.Audit.emit
        staging = None
        def race(audit, event, **fields):
            nonlocal staging
            original(audit, event, **fields)
            if event == "captured-files":
                staging = self.root / fields["staging"]
                self.path.chmod(0o777)
        with mock.patch.object(c.Audit, "emit", new=race):
            result = self.scan(apply=True)
        self.assertEqual(result[0]["status"], "preserved")
        self.assertEqual(result[0]["deleted_files"], [])
        self.assertEqual((staging / "render.bin").read_bytes(), b"reproducible pixels")

    def test_run_directory_activity_between_plan_and_capture_is_detected(self):
        original = c.Audit.emit
        def race(audit, event, **fields):
            original(audit, event, **fields)
            if event == "delete-intent":
                # A transient unknown file must still invalidate the plan.
                arrived = self.path / "temporary-arrival.bin"
                arrived.write_text("synthetic")
                arrived.unlink()
        with mock.patch.object(c.Audit, "emit", new=race):
            self.preserved()

    def test_existing_audit_directory_parent_is_fsynced(self):
        self.audit.mkdir()
        parent_inode = c.identity(self.base.stat())
        original = os.fsync
        parents = []
        def fsync(fd):
            if c.identity(os.fstat(fd)) == parent_inode:
                parents.append(True)
            return original(fd)
        with mock.patch.object(c.os, "fsync", side_effect=fsync):
            with c.Audit(self.cfg) as audit:
                audit.emit("synthetic-existing-parent-check")
        self.assertEqual(parents, [True])

    def test_completion_audit_failure_does_not_claim_completed_run_is_active(self):
        original = c.Audit.emit
        def failure(audit, event, **fields):
            if event == "run-completed":
                raise OSError("synthetic final audit failure")
            return original(audit, event, **fields)
        output = io.StringIO()
        with mock.patch.object(c.Audit, "emit", new=failure), contextlib.redirect_stdout(output):
            with self.assertRaises(OSError):
                c.run_command(self.cfg, "synthetic-test", "Regenerate fixture", [sys.executable, "-c", "pass"])
        run = json.loads(output.getvalue().splitlines()[0])["run"]
        self.assertEqual(json.loads((self.root / run / c.MANIFEST).read_text())["state"], "completed")
        events = [json.loads(line) for p in self.audit.iterdir() for line in p.read_text().splitlines()]
        relevant = [e for e in events if e.get("run") == run]
        self.assertNotIn("run-left-active", [e["event"] for e in relevant])
        event = next(e for e in relevant if e["event"] == "run-completion-audit-failed")
        self.assertTrue(event["completion_persisted"])
        self.assertEqual(event["phase"], "completion-audit")

    def wrapper(self, command, wait=True):
        # Tests do not expose an arbitrary-root CLI switch: this separate Python
        # process imports the helper and supplies a fixture-only Config directly.
        code = "import cleanup as c; import sys; cfg=c.Config(sys.argv[1],sys.argv[2],frozenset((sys.argv[1],))); sys.exit(c.run_command(cfg,'fixture','Recreate fixture',sys.argv[3:]))"
        p = subprocess.Popen([sys.executable, "-c", code, str(self.root), str(self.audit), *command], cwd=HERE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        return p.communicate(timeout=10) + (p.returncode,) if wait else p

    def test_wrapper_returns_command_status_and_marks_completed(self):
        out, err, rc = self.wrapper([sys.executable, "-c", "raise SystemExit(7)"])
        self.assertEqual(rc, 7, err)
        run = json.loads(out.splitlines()[0])["run"]
        m = json.loads((self.root / run / c.MANIFEST).read_text())
        self.assertEqual(m["state"], "completed")
        self.assertEqual(m["exitcode"], 7)
        self.assertEqual(m["files"], {})

    def test_wrapper_waits_detached_grandchild_that_closes_lock(self):
        code = "import os,time; p=os.fork();\nif p==0:\n os.setsid(); p=os.fork();\n if p==0:\n  os.close(int(os.environ['APERTURE_TMP_LOCK_FD'])); time.sleep(.7); open(os.path.join(os.environ['APERTURE_TMP_RUN'],'child.bin'),'w').write('done')\n os._exit(0)\nos._exit(0)"
        start = time.monotonic()
        out, err, rc = self.wrapper([sys.executable, "-c", code])
        self.assertEqual(rc, 0, err)
        self.assertGreaterEqual(time.monotonic() - start, .65)
        run = json.loads(out.splitlines()[0])["run"]
        self.assertEqual((self.root / run / "child.bin").read_text(), "done")
        self.assertEqual(json.loads((self.root / run / c.MANIFEST).read_text())["state"], "completed")

    def test_running_wrapper_blocks_cleaner_until_descendants_exit(self):
        code = "import os,time; p=os.fork();\nif p==0:\n os.close(int(os.environ['APERTURE_TMP_LOCK_FD'])); time.sleep(.8); os._exit(0)\nos._exit(0)"
        p = self.wrapper([sys.executable, "-c", code], wait=False)
        try:
            line = p.stdout.readline()
            self.assertIn("temporary_directory", line)
            self.assertEqual(self.scan(apply=True)[0]["status"], "busy")
            _, err = p.communicate(timeout=10)
            self.assertEqual(p.returncode, 0, err)
        finally:
            if p.poll() is None:
                p.wait(timeout=10)

    def test_wrapper_spawn_failure_leaves_run_permanently_active(self):
        out, err, rc = self.wrapper(["/nonexistent/synthetic-command"])
        self.assertNotEqual(rc, 0)
        run = json.loads(out.splitlines()[0])["run"]
        self.assertEqual(json.loads((self.root / run / c.MANIFEST).read_text())["state"], "active")
        result = next(r for r in self.scan(apply=True) if r["run"] == run)
        self.assertEqual(result["status"], "preserved")

    def test_wrapper_interruption_leaves_active_even_after_child_exit(self):
        p = self.wrapper([sys.executable, "-c", "import time;time.sleep(.4)"], wait=False)
        line = p.stdout.readline()
        run = json.loads(line)["run"]
        p.terminate()
        p.communicate(timeout=10)
        time.sleep(.5)
        self.assertEqual(json.loads((self.root / run / c.MANIFEST).read_text())["state"], "active")
        result = next(r for r in self.scan(apply=True) if r["run"] == run)
        self.assertEqual(result["status"], "preserved")


if __name__ == "__main__":
    unittest.main(verbosity=2)
