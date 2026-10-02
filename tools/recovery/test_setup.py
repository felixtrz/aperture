import json
from pathlib import Path
import tempfile
import unittest
from unittest import mock

import setup


class SetupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="synthetic-recovery-")
        self.root = Path(self.temp.name)
        self.file = self.root / "artifact"
        self.file.write_bytes(b"verified bytes")

    def tearDown(self):
        self.temp.cleanup()

    def state(self, count):
        return {"schema": 1, "boot_id": "boot", "inputs": "input", "stages": {
            name: {"status": "passed", "artifacts": {str(self.file): setup.digest(self.file)}}
            for name in setup.STAGES[:count]}}

    def test_ordered_progress(self):
        for index, name in enumerate(setup.STAGES):
            self.assertEqual(setup.next_stage(self.state(index), "boot", "input"), name)
        self.assertEqual(setup.next_stage(self.state(5), "boot", "input"), "benchmark")

    def test_missing_file_invalidates_stage(self):
        state = self.state(5)
        self.file.unlink()
        self.assertEqual(setup.next_stage(state, "boot", "input"), "pnpm")

    def test_modified_bytes_invalidate_stage(self):
        state = self.state(5)
        self.file.write_bytes(b"modified")
        self.assertEqual(setup.next_stage(state, "boot", "input"), "pnpm")

    def test_vm_loss_restarts_host_validation(self):
        self.assertEqual(setup.next_stage(self.state(5), "new-boot", "input"), "pnpm")

    def test_input_change_restarts_validation(self):
        self.assertEqual(setup.next_stage(self.state(5), "boot", "changed"), "pnpm")

    def test_running_never_retried_on_same_boot_even_if_source_changes(self):
        state = self.state(1)
        state["stages"]["dependencies"] = {"status": "running"}
        self.assertEqual(setup.next_stage(state, "boot", "input"), "reconcile-running-stage")
        self.assertEqual(setup.next_stage(state, "boot", "changed"), "reconcile-running-stage")

    def test_flags_alone_cannot_mark_passed(self):
        state = self.state(1)
        state["stages"]["pnpm"]["artifacts"] = {}
        self.assertEqual(setup.next_stage(state, "boot", "input"), "pnpm")

    def test_unknown_schema_is_not_idle(self):
        state = self.state(0)
        state["schema"] = 99
        with self.assertRaises(ValueError):
            setup.next_stage(state, "boot", "input")

    def test_existing_recovery_store_is_reused(self):
        modules = self.root / "node_modules/.modules.yaml"
        modules.parent.mkdir()
        store = self.root / ".recovery-env/data/pnpm/store/v10"
        modules.write_text("storeDir: " + str(store) + "\n")
        self.assertEqual(setup.environment(self.root)["XDG_DATA_HOME"],
                         str(self.root / ".recovery-env/data"))

    def test_unknown_existing_store_is_preserved(self):
        modules = self.root / "node_modules/.modules.yaml"
        modules.parent.mkdir()
        modules.write_text("storeDir: /unrecognized/store/v10\n")
        with self.assertRaises(RuntimeError):
            setup.environment(self.root)
        self.assertEqual(modules.read_text(), "storeDir: /unrecognized/store/v10\n")

    def test_runtime_install_is_outside_parent_workspace(self):
        source = self.root / "tools/recovery/runtime"
        source.mkdir(parents=True)
        (source / "package.json").write_text("{}")
        (source / "pnpm-lock.yaml").write_text("lockfileVersion: '9.0'")
        with mock.patch("setup.shutil.which", return_value="/approved/corepack"), mock.patch("setup.execute") as execute:
            setup.run_stage("runtime", self.root, {}, None, self.root / "proof")
        self.assertIn("--ignore-workspace", execute.call_args.args[0])

    def test_save_is_complete_json(self):
        target = self.root / "state.json"
        setup.save(target, self.state(3))
        self.assertEqual(json.loads(target.read_text()), self.state(3))
        self.assertEqual(list(self.root.glob("state.json.*")), [])


if __name__ == "__main__":
    unittest.main()
