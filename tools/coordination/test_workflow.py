import fcntl
import json
import multiprocessing
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

from workflow import Closed, Coordinator, decode, encoded, sha, verify_publication

EMPTY = dict(version=1, epoch="0" * 64, revision=0, barrier=True, admission=None, claims={})
PROOF = dict(workers=True, descendants=True, tools=True, effects=True, evidence="1" * 64)
ADMISSION = dict(single_vm=True, evidence="2" * 64)


def race(path, authority, name, queue):
    try:
        Coordinator(path).claim(authority, name, name, ["integration-publication"])
        queue.put(True)
    except (Closed, OSError):
        queue.put(False)


class WorkflowTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(dir="/tmp")
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.co, self.auth = Coordinator.bootstrap(self.root / "private", EMPTY)
        self.auth = self.co.reconcile_recovery(self.auth, PROOF, ADMISSION)["authority"]
        self.repo = self.root / "repo"
        self.repo.mkdir()
        self.git("init", "-q")
        self.git("config", "user.name", "Test")
        self.git("config", "user.email", "test@example.invalid")
        self.remote = self.root / "remote.git"
        subprocess.run(["git", "init", "--bare", "-q", str(self.remote)], check=True)
        self.git("remote", "add", "origin", str(self.remote))

    def git(self, *args):
        return subprocess.check_output(["git", "-C", str(self.repo), *args], stderr=subprocess.DEVNULL).decode().strip()

    def publish(self):
        # Tests use a disposable local bare repository; production code never pushes.
        (self.repo / "snapshot.json").write_bytes(encoded(self.co.tick()))
        self.git("add", "snapshot.json")
        self.git("commit", "-qm", "checkpoint")
        self.git("push", "-q", "origin", "HEAD:refs/heads/checkpoints")
        return dict(repo=str(self.repo), remote="origin", ref="refs/heads/checkpoints",
                    commit=self.git("rev-parse", "HEAD"), tree=self.git("rev-parse", "HEAD^{tree}"),
                    snapshot_path="snapshot.json")

    def claim(self, cid="c", domain="integration-publication"):
        return self.co.claim(self.auth, cid, "/root/worker", [domain])["token"]

    def spawn(self):
        token = self.claim()
        self.co.prepare("c", token, "spawn", "spawn", "/root/worker", "inc-1", "3" * 64)
        receipt = self.publish()
        self.assertTrue(self.co.begin("c", token, "spawn", receipt)["dispatch_authorized"])
        return self.co.bind("c", token, "spawn", "/root/worker", "inc-1")["token"]

    def test_lifecycle_and_at_most_once_issuance(self):
        old = self.claim()
        self.co.prepare("c", old, "spawn", "spawn", "worker", "inc-1", "3" * 64)
        pub = self.publish()
        self.assertTrue(self.co.begin("c", old, "spawn", pub)["dispatch_authorized"])
        self.assertFalse(self.co.begin("c", old, "spawn", pub)["dispatch_authorized"])
        with self.assertRaises(Closed):
            self.co.bind("c", old, "spawn", "worker", "wrong")
        token = self.co.bind("c", old, "spawn", "worker", "inc-1")["token"]
        with self.assertRaises(Closed):
            self.co.prepare("c", old, "write", "write", "worker", "inc-1", "4" * 64)
        self.co.prepare("c", token, "write", "write", "worker", "inc-1", "4" * 64)
        self.assertTrue(self.co.begin("c", token, "write", self.publish())["dispatch_authorized"])
        self.co.resolve("c", token, "write", PROOF)
        self.co.release("c", token, PROOF)
        with self.assertRaises(Closed):
            self.co.release("c", token, PROOF)
        self.claim("next")

    def test_unknown_effect_retains_reservations(self):
        token = self.spawn()
        self.co.prepare("c", token, "write", "write", "/root/worker", "inc-1", "4" * 64)
        self.co.begin("c", token, "write", self.publish())
        self.co.resolve("c", token, "write")
        for action in (lambda: self.claim("other"), lambda: self.co.release("c", token, PROOF),
                       lambda: self.co.prepare("c", token, "next", "write", "/root/worker", "inc-1", "4" * 64)):
            with self.assertRaises(Closed):
                action()
        bad = dict(PROOF, descendants=False)
        with self.assertRaises(Closed):
            self.co.resolve("c", token, "write", bad)
        self.co.resolve("c", token, "write", PROOF)
        self.co.release("c", token, PROOF)

    def test_restore_prepared_is_quarantined_and_rotates_authority(self):
        token = self.claim()
        self.co.prepare("c", token, "spawn", "spawn", "worker", "inc", "3" * 64)
        restored, auth = Coordinator.bootstrap(self.root / "restored", self.co.tick())
        self.assertEqual(restored.tick()["claims"]["c"]["status"], "quarantined")
        with self.assertRaises(Closed):
            restored.claim(auth, "new", "worker", ["other"])
        with self.assertRaises(Closed):
            restored.reconcile_recovery(auth, PROOF, dict(ADMISSION, single_vm=False))
        new = restored.reconcile_recovery(auth, PROOF, ADMISSION)["authority"]
        with self.assertRaises(Closed):
            restored.claim(auth, "new", "worker", ["other"])
        restored.claim(new, "new", "worker", ["other"])
        self.assertNotEqual(restored.tick()["epoch"], self.co.tick()["epoch"])

    def test_multiprocess_contention_one_owner(self):
        queue = multiprocessing.Queue()
        workers = [multiprocessing.Process(target=race, args=(self.co.path, self.auth, f"c{i}", queue)) for i in range(8)]
        for worker in workers:
            worker.start()
        for worker in workers:
            worker.join(10)
            self.assertEqual(worker.exitcode, 0)
        self.assertEqual(sum(queue.get(timeout=2) for _ in workers), 1)

    def test_busy_missing_and_symlink_fail_closed(self):
        path = Path(self.co.path)
        with open(path / "lock", "rb") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            with self.assertRaises(Closed):
                self.co.tick()
        original = (path / "state.json").read_bytes()
        (path / "state.json").unlink()
        with self.assertRaises(OSError):
            self.co.tick()
        outside = self.root / "outside"
        outside.write_bytes(original)
        (path / "state.json").symlink_to(outside)
        with self.assertRaises(OSError):
            self.co.tick()
        alias = self.root / "alias"
        alias.symlink_to(path, target_is_directory=True)
        with self.assertRaises(OSError):
            Coordinator(alias).tick()
        with self.assertRaises((Closed, OSError)):
            Coordinator.bootstrap(self.repo / "authority", EMPTY)
        with self.assertRaises((Closed, OSError)):
            Coordinator.bootstrap(alias / "nested", EMPTY)

    def test_malformed_unknown_and_duplicate_json(self):
        for raw in (b"{", b'{"version":1,"version":1}', b'[]',
                    encoded(dict(EMPTY, version=True)), encoded(dict(EMPTY, extra="secret"))):
            with self.assertRaises(Closed):
                decode(raw, False)
        path = Path(self.co.path) / "state.json"
        for mutation in (lambda s: s.update(version=9), lambda s: s.update(barrier="false"),
                         lambda s: s.update(claims=[])):
            original = path.read_bytes()
            s = json.loads(original)
            mutation(s)
            path.write_bytes(encoded(s))
            with self.assertRaises(Closed):
                self.co.tick()
            path.write_bytes(original)

    def test_checkpoint_readonly_and_no_live_secret_leak(self):
        token = self.claim()
        path = Path(self.co.path) / "state.json"
        before = path.read_bytes()
        snapshot = encoded(self.co.checkpoint())
        self.assertEqual(before, path.read_bytes())
        for forbidden in (token, self.auth, sha(token.encode()), sha(self.auth.encode()), '"token"', '"authority"'):
            self.assertNotIn(forbidden.encode(), snapshot)
        self.assertEqual(self.co.checkpoint()["durability"], "local-only")

    def test_remote_ref_tree_blob_must_all_match(self):
        token = self.claim()
        self.co.prepare("c", token, "spawn", "spawn", "worker", "inc", "3" * 64)
        pub = self.publish()
        for wrong in (dict(pub, tree="0" * 40), dict(pub, ref="refs/heads/missing"),
                      dict(pub, snapshot_path="absent.json")):
            with self.assertRaises(Closed):
                self.co.begin("c", token, "spawn", wrong)
        self.assertEqual(verify_publication(**pub, snapshot=self.co.tick())["durability"], "remote-observed")
        self.co.claim(self.auth, "independent", "other", ["independent"])
        with self.assertRaises(Closed):
            self.co.begin("c", token, "spawn", pub)

    def test_crash_after_persist_before_response_denies_replay(self):
        token = self.claim()
        self.co.prepare("c", token, "spawn", "spawn", "worker", "inc", "3" * 64)
        pub = self.publish()
        import workflow
        real_save = workflow.save
        def lost_response(fd, state):
            real_save(fd, state)
            raise OSError("simulated crash after durable local rename")
        with patch("workflow.save", lost_response), self.assertRaises(OSError):
            self.co.begin("c", token, "spawn", pub)
        self.assertFalse(self.co.begin("c", token, "spawn", pub)["dispatch_authorized"])

    def test_domain_claim_is_all_or_nothing(self):
        self.claim("first", "render")
        with self.assertRaises(Closed):
            self.co.claim(self.auth, "second", "owner", ["new-domain", "render"])
        self.assertNotIn("second", self.co.tick()["claims"])
        self.claim("third", "new-domain")

    def test_writes_require_bound_identity_and_duplicate_intents_stay_immutable(self):
        token = self.claim()
        with self.assertRaises(Closed):
            self.co.prepare("c", token, "write", "write", "worker", "inc", "3" * 64)
        self.co.prepare("c", token, "spawn", "spawn", "worker", "inc", "3" * 64)
        result = self.co.prepare("c", token, "spawn", "spawn", "other", "other", "4" * 64)
        self.assertFalse(result["dispatch_authorized"])
        self.assertEqual(self.co.tick()["claims"]["c"]["operations"]["spawn"]["payload"], "3" * 64)
        self.co.resolve("c", token, "spawn")
        with self.assertRaises(Closed):
            self.co.bind("c", token, "spawn", "worker", "inc")
        self.assertFalse(self.co.begin("c", token, "spawn", {})["dispatch_authorized"])

    def test_hardlinks_and_lock_symlinks_fail_closed(self):
        import os
        path = Path(self.co.path)
        os.link(path / "state.json", self.root / "hardlink")
        with self.assertRaises(Closed):
            self.co.tick()
        (self.root / "hardlink").unlink()
        (path / "lock").unlink()
        (path / "lock").symlink_to(path / "state.json")
        with self.assertRaises(OSError):
            self.co.tick()

    def test_interrupted_replace_never_returns_permission(self):
        token = self.claim()
        self.co.prepare("c", token, "spawn", "spawn", "worker", "inc", "3" * 64)
        pub = self.publish()
        with patch("workflow.os.replace", side_effect=OSError("crash")), self.assertRaises(OSError):
            self.co.begin("c", token, "spawn", pub)
        self.assertEqual(self.co.tick()["claims"]["c"]["operations"]["spawn"]["status"], "prepared")

    def test_cli_bad_state_returns_no_authority_or_dispatch(self):
        import sys
        (Path(self.co.path) / "state.json").write_text("corrupt-secret-sentinel")
        result = subprocess.run([sys.executable, "-B", str(Path(__file__).with_name("workflow.py")),
                                 self.co.path, "tick"], capture_output=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout, b"")
        self.assertNotIn(b"sentinel", result.stderr)
        self.assertFalse(json.loads(result.stderr)["dispatch_authorized"])

    def test_historical_snapshot_loads_without_asserting_quiescence(self):
        source = Path(__file__).parent / "checkpoints/recovery-20261002.json"
        snapshot = decode(source.read_bytes(), False)
        self.assertTrue(snapshot["barrier"])
        self.assertEqual(len(snapshot["claims"]), 7)
        self.assertTrue(all(c["status"] == "quarantined" for c in snapshot["claims"].values()))
        restored, auth = Coordinator.bootstrap(self.root / "historical", snapshot)
        restored.reconcile_recovery(auth, PROOF, ADMISSION)
        self.assertTrue(all(c["status"] == "released" for c in restored.tick()["claims"].values()))


if __name__ == "__main__":
    unittest.main()
