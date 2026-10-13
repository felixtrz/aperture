"""Real isolated CPU subprocess waits; no browser, benchmark or production root."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time
import unittest


SOURCE = Path(__file__).with_name("durable-official-driver.py")
SPEC = importlib.util.spec_from_file_location("durable_official_driver", SOURCE)
DURABLE = importlib.util.module_from_spec(SPEC); SPEC.loader.exec_module(DURABLE)


class DurableTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="durable-unit-")
        self.root = Path(self.temp.name)
        driver = self.root / "tools/agent-benchmark/official-trials-v2.py"
        driver.parent.mkdir(parents=True)
        driver.write_text("import sys,time\ntime.sleep(.25)\nprint('actual CPU child output')\nsys.exit(3)\n")
        driver.chmod(0o444)
        self.plan = self.root / "plan.json"
        self.save(self.plan, {"schema": "aperture.official-trial-plan.v1", "round": "round-099", "cwd": str(self.root), "runtimeRoot": str(self.root / "unused-runtime"), "driver": DURABLE.pin(driver)})
        self.auth = self.root / "auth.json"
        self.save(self.auth, {"schema": "aperture.official-trial-authorization.v1", "authorizedBy": "/root", "status": "authorized", "round": "round-099", "planSha256": DURABLE.pin(self.plan)["sha256"]})
        self.output = self.root / "capture"
        self.spec_path = self.root / "spec.json"
        self.save(self.spec_path, {"schema": DURABLE.SCHEMA, "plan": DURABLE.pin(self.plan), "authorization": DURABLE.pin(self.auth), "outputRoot": str(self.output), "pythonExecutable": str(Path(sys.executable).resolve()), "recorderSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest()})
        self.sha = DURABLE.pin(self.spec_path)["sha256"]

    def save(self, path, value):
        path.write_text(json.dumps(value)); path.chmod(0o444)

    def tearDown(self):
        self.temp.cleanup()

    def wait_result(self):
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            if (self.output / "result.json").exists():
                return json.loads((self.output / "result.json").read_bytes())
            time.sleep(.01)
        self.fail("Actual synthetic CPU recorder did not finish")

    def test_launcher_returns_handshake_and_recorder_waits_actual_exit(self):
        handshake = DURABLE.launch(self.spec_path, self.sha)
        started = json.loads(Path(handshake["path"]).read_bytes())
        self.assertEqual(started["recorder"]["pid"], started["recorder"]["sessionId"])
        self.assertEqual(started["driver"]["sessionId"], started["recorder"]["sessionId"])
        self.assertNotEqual(started["recorder"]["sessionId"], os.getsid(0))
        result = self.wait_result()
        self.assertEqual(result["driverExitCode"], 3)
        self.assertTrue(result["actualChildWaitReturned"])
        self.assertEqual((self.output / "stdout.bin").read_bytes(), b"actual CPU child output\n")
        self.assertEqual((self.output / "stderr.bin").read_bytes(), b"")
        with self.assertRaises(FileExistsError): DURABLE.launch(self.spec_path, self.sha)

    def test_killing_only_synthetic_transport_session_preserves_detached_supervision(self):
        code = "import subprocess,sys,time;subprocess.run(sys.argv[1:],check=True);print('launcher returned',flush=True);time.sleep(30)"
        starter = subprocess.Popen([sys.executable, "-B", "-c", code, sys.executable, "-B", str(SOURCE), "launch", "--spec", str(self.spec_path), "--spec-sha256", self.sha], start_new_session=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        try:
            handshake = json.loads(starter.stdout.readline())
            self.assertEqual(starter.stdout.readline(), b"launcher returned\n")
            started = json.loads(Path(handshake["path"]).read_bytes())
            self.assertNotEqual(started["recorder"]["sessionId"], starter.pid)
            os.killpg(starter.pid, signal.SIGKILL)  # Exact own synthetic transport only.
            self.assertEqual(starter.wait(), -signal.SIGKILL)
            self.assertEqual(self.wait_result()["driverExitCode"], 3)
        finally:
            if starter.poll() is None:
                starter.kill(); starter.wait()
            starter.stdout.close(); starter.stderr.close()

    def test_changed_source_hash_authorization_or_writable_spec_refuses_before_spawn(self):
        self.spec_path.chmod(0o600)
        with self.assertRaisesRegex(RuntimeError, "Readonly"): DURABLE.launch(self.spec_path, self.sha)
        self.assertFalse(self.output.exists())
        self.spec_path.chmod(0o444)
        with self.assertRaisesRegex(RuntimeError, "SHA"): DURABLE.launch(self.spec_path, "0" * 64)
        self.assertFalse(self.output.exists())
        self.auth.chmod(0o600); self.auth.write_text("{}"); self.auth.chmod(0o444)
        with self.assertRaises(RuntimeError): DURABLE.launch(self.spec_path, self.sha)
        self.assertFalse(self.output.exists())

    def test_no_unapproved_driver_path_or_source_can_launch(self):
        plan = json.loads(self.plan.read_bytes()); plan["driver"]["path"] = str(self.root / "other.py")
        self.plan.chmod(0o600); self.save(self.plan, plan)
        with self.assertRaises(RuntimeError): DURABLE.launch(self.spec_path, self.sha)
        self.assertFalse(self.output.exists())


if __name__ == "__main__": unittest.main()
