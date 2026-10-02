import contextlib
import hashlib
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock

import cleanup as c
import runtime_pressure as r


class RuntimeTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="synthetic-runtime-")
        self.base = Path(self.tmp.name)
        self.root = self.base / "root"
        self.cfg = c.Config(str(self.root), str(self.base / "audit"), frozenset([str(self.root)]))
        c.initialize(self.cfg)
        self.runtime = self.base / "runtime"
        package = self.runtime / "node_modules/@sparticuz/chromium"
        (package / "bin").mkdir(parents=True)
        (package / "package.json").write_text('{"version":"153.0.0"}')
        (package / "bin/chromium.br").write_bytes(b"pinned compressed fixture")
        self.source = package / "bin/chromium.br"
        with c.Store(self.cfg) as store, store.locked():
            self.run = c.new_run(store, "test", "Synthetic runtime fixture")
        self.path = self.root / self.run

    def tearDown(self):
        self.tmp.cleanup()

    def pins(self):
        stack = contextlib.ExitStack()
        stack.enter_context(mock.patch.object(r, "RUNTIME_SIZE", 7))
        stack.enter_context(mock.patch.object(r, "RUNTIME_SHA256", hashlib.sha256(b"fixture").hexdigest()))
        stack.enter_context(mock.patch.object(r, "SOURCE_SHA256", hashlib.sha256(self.source.read_bytes()).hexdigest()))
        return stack

    def test_registers_exact_runtime_only(self):
        (self.path / "chromium").write_bytes(b"fixture")
        (self.path / "unknown").mkdir()
        with self.pins():
            r.register_runtime(self.cfg, self.run, str(self.path), str(self.runtime))
        m = json.loads((self.path / c.MANIFEST).read_text())
        self.assertEqual(list(m["files"]), ["chromium"])
        self.assertTrue((self.path / "unknown").is_dir())

    def test_missing_runtime_is_preserved_no_registration(self):
        r.register_runtime(self.cfg, self.run, str(self.path), str(self.runtime))
        self.assertEqual(json.loads((self.path / c.MANIFEST).read_text())["files"], {})

    def test_wrong_bytes_fail_closed(self):
        (self.path / "chromium").write_bytes(b"changed")
        with self.pins(), self.assertRaises(c.Unsafe):
            r.register_runtime(self.cfg, self.run, str(self.path), str(self.runtime))

    def test_wrong_source_fails_closed(self):
        (self.path / "chromium").write_bytes(b"fixture")
        with self.pins(), mock.patch.object(r, "SOURCE_SHA256", "0" * 64), self.assertRaises(c.Unsafe):
            r.register_runtime(self.cfg, self.run, str(self.path), str(self.runtime))

    def test_symlink_rejected(self):
        (self.path / "chromium").symlink_to(self.source)
        with self.pins(), self.assertRaises(OSError):
            r.register_runtime(self.cfg, self.run, str(self.path), str(self.runtime))

    def test_hardlink_rejected(self):
        target = self.base / "external"
        target.write_bytes(b"fixture")
        os.link(target, self.path / "chromium")
        with self.pins(), self.assertRaises(c.Unsafe):
            r.register_runtime(self.cfg, self.run, str(self.path), str(self.runtime))

    def test_callback_runs_after_detached_descendant_before_completion(self):
        script = "import subprocess,sys;subprocess.Popen([sys.executable,'-c',\"import os,time,pathlib;time.sleep(.1);pathlib.Path(os.environ['APERTURE_TMP_RUN'],'descendant.done').write_text('done')\"],start_new_session=True,close_fds=True)"
        seen = []
        def callback(cfg, run, path):
            seen.append(run)
            self.assertTrue((Path(path) / "descendant.done").exists())
            self.assertEqual(json.loads((Path(path) / c.MANIFEST).read_text())["state"], "active")
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(c.run_command(self.cfg, "descendants", "Synthetic descendant check", [sys.executable, "-c", script], callback), 0)
        self.assertEqual(len(seen), 1)
        self.assertEqual(json.loads((self.root / seen[0] / c.MANIFEST).read_text())["state"], "completed")

    def test_callback_failure_never_marks_complete(self):
        seen = []
        def callback(cfg, run, path):
            seen.append(run)
            raise c.Unsafe("pin verification failed")
        with contextlib.redirect_stdout(io.StringIO()), self.assertRaises(c.Unsafe):
            c.run_command(self.cfg, "failure", "Synthetic failed registration", [sys.executable, "-c", "pass"], callback)
        self.assertEqual(json.loads((self.root / seen[0] / c.MANIFEST).read_text())["state"], "active")

    def test_cli_parses_route_and_low_disk_stops_before_launch(self):
        with mock.patch.dict(os.environ, {"APERTURE_WEBGPU_RUNTIME": str(self.runtime)}), mock.patch.object(r.shutil, "disk_usage", return_value=type('D', (), {'free':1})()), mock.patch.object(c, "run_command") as launch, self.assertRaises(c.Unsafe):
            r.main(["--root", str(self.root), "run", "--job", "x", "--recreation", "Regenerate approved render", "--", "pnpm", "run", "render:cloud"])
        launch.assert_not_called()


if __name__ == "__main__":
    unittest.main()
