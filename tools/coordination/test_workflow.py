import fcntl
import json
import multiprocessing
import os
import secrets
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

from workflow import (Closed, Coordinator, MAX_REVISION, MAX_STATE_BYTES, capacity_bytes, decode,
                      encoded, local_incarnation, native_observation, sha, spawn_payload, verify_publication)

EMPTY = dict(version=3, epoch="0" * 64, revision=0, barrier=True, admission=None, native_execution=None, claims={})
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

    def prepare_spawn(self, token, operation="spawn", provider="native", task="/root/worker"):
        # Real integrations hash the exact waiting-only provider request containing this nonce.
        correlation = secrets.token_hex(32)
        specification = dict(provider=provider, parent="/root", requested_task=task if provider == "native" else None,
                             request_sha256=sha(encoded(dict(correlation=correlation, action="fixture-wait"))))
        result = self.co.prepare_spawn("c", token, operation, correlation, specification)
        return dict(correlation=correlation, payload=result.get("payload", self.co.tick()["claims"]["c"]["operations"][operation]["payload"]),
                    observed=dict(provider=provider, task=task, incarnation="inc-1", evidence="5" * 64))

    def spawn(self):
        token = self.claim()
        result = self.prepare_spawn(token)
        receipt = self.publish()
        self.assertTrue(self.co.begin("c", token, "spawn", receipt)["dispatch_authorized"])
        self.co.record_spawn("c", token, "spawn", **result)
        return self.co.bind("c", token, "spawn", **result)["token"]

    def test_lifecycle_and_at_most_once_issuance(self):
        old = self.claim()
        result = self.prepare_spawn(old)
        pub = self.publish()
        self.assertTrue(self.co.begin("c", old, "spawn", pub)["dispatch_authorized"])
        self.assertFalse(self.co.begin("c", old, "spawn", pub)["dispatch_authorized"])
        with self.assertRaises(Closed):
            self.co.bind("c", old, "spawn", **result)
        self.co.record_spawn("c", old, "spawn", **result)
        wrong = dict(result, observed=dict(result["observed"], incarnation="wrong"))
        with self.assertRaises(Closed):
            self.co.bind("c", old, "spawn", **wrong)
        token = self.co.bind("c", old, "spawn", **result)["token"]
        with self.assertRaises(Closed):
            self.co.prepare("c", old, "write", "write", "/root/worker", "inc-1", "4" * 64)
        self.co.prepare("c", token, "write", "write", "/root/worker", "inc-1", "4" * 64)
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
        self.prepare_spawn(token)
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
        self.prepare_spawn(token)
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
        self.prepare_spawn(token)
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
        result = self.prepare_spawn(token)
        original = self.co.tick()
        duplicate = self.prepare_spawn(token)
        self.assertEqual(duplicate["payload"], result["payload"])
        self.assertEqual(original, self.co.tick())
        self.co.resolve("c", token, "spawn")
        with self.assertRaises(Closed):
            self.co.bind("c", token, "spawn", **result)
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
        self.prepare_spawn(token)
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
        self.assertEqual(source.read_bytes(), encoded(snapshot))
        restored, auth = Coordinator.bootstrap(self.root / "historical", snapshot)
        self.assertTrue(restored.tick()["barrier"])
        with self.assertRaises(Closed):
            restored.claim(auth, "new", "owner", ["render"])
        # No mock quiescence attestation is applied to the production recovery artifact.

    def test_replacement_ref_cannot_attest_unpushed_bytes(self):
        pub = self.publish()
        original = self.co.tick()
        self.claim()
        replacement = self.co.tick()
        (self.repo / "snapshot.json").write_bytes(encoded(replacement))
        self.git("add", "snapshot.json")
        self.git("commit", "-qm", "unpushed replacement")
        replacement_commit = self.git("rev-parse", "HEAD")
        replacement_tree = self.git("rev-parse", "HEAD^{tree}")
        self.git("replace", pub["commit"], replacement_commit)
        with self.assertRaises(Closed):
            verify_publication(**dict(pub, tree=replacement_tree), snapshot=replacement)
        self.assertEqual(verify_publication(**pub, snapshot=original)["durability"], "remote-observed")

    def test_git_repository_and_config_environment_cannot_select_attacker_repo(self):
        token = self.claim()
        self.prepare_spawn(token)
        pub = self.publish()
        snapshot = self.co.tick()
        empty_repo = self.root / "empty-repo"
        empty_repo.mkdir()
        subprocess.run(["git", "init", "-q", str(empty_repo)], check=True)
        overrides = dict(GIT_DIR=str(self.repo / ".git"), GIT_WORK_TREE=str(self.repo),
                         GIT_COMMON_DIR=str(self.repo / ".git"),
                         GIT_OBJECT_DIRECTORY=str(self.repo / ".git/objects"),
                         GIT_ALTERNATE_OBJECT_DIRECTORIES=str(self.repo / ".git/objects"),
                         GIT_CONFIG_COUNT="1", GIT_CONFIG_KEY_0="remote.origin.url",
                         GIT_CONFIG_VALUE_0=str(self.remote))
        with patch.dict(os.environ, overrides):
            with self.assertRaises(Closed):
                verify_publication(**dict(pub, repo=str(empty_repo)), snapshot=snapshot)
            self.assertEqual(verify_publication(**pub, snapshot=snapshot)["durability"], "remote-observed")

    def test_git_object_override_and_replacement_environment_are_sanitized(self):
        pub = self.publish()
        snapshot = self.co.tick()
        with patch.dict(os.environ, {"GIT_OBJECT_DIRECTORY": str(self.root / "absent"),
                                     "GIT_REPLACE_REF_BASE": "refs/attacker/",
                                     "GIT_NO_REPLACE_OBJECTS": "0",
                                     "GIT_CONFIG_PARAMETERS": "'remote.origin.url=missing'"}):
            self.assertEqual(verify_publication(**pub, snapshot=snapshot)["durability"], "remote-observed")

    def test_oversize_claim_leaves_all_bytes_and_revision_unchanged(self):
        path = Path(self.co.path) / "state.json"
        before = path.read_bytes()
        domains = [f"domain-{i:05d}-" + "x" * 147 for i in range(24000)]
        with self.assertRaises(Closed), patch("workflow.os.replace") as replace:
            self.co.claim(self.auth, "large", "owner", domains)
        replace.assert_not_called()
        self.assertEqual(before, path.read_bytes())
        self.assertEqual(self.co.tick()["revision"], json.loads(before)["revision"])
        self.assertLessEqual(path.stat().st_size, MAX_STATE_BYTES)

    def test_capacity_reserves_observation_binding_resolve_release(self):
        token = self.claim()
        prepared = self.prepare_spawn(token, provider="cloud", task="t" * 160)
        prepared["observed"]["incarnation"] = "i" * 160
        pub = self.publish()
        state = json.loads((Path(self.co.path) / "state.json").read_bytes())
        limit = capacity_bytes(state)
        with patch("workflow.MAX_STATE_BYTES", limit):
            self.co.begin("c", token, "spawn", pub)
            self.co.record_spawn("c", token, "spawn", **prepared)
            token = self.co.bind("c", token, "spawn", **prepared)["token"]
            self.co.release("c", token, PROOF)
        self.assertEqual(self.co.tick()["claims"]["c"]["status"], "released")

    def test_capacity_blocks_growth_but_all_current_claims_can_close(self):
        token = self.spawn()
        self.co.prepare("c", token, "write", "write", "/root/worker", "inc-1", "4" * 64)
        state = json.loads((Path(self.co.path) / "state.json").read_bytes())
        limit = capacity_bytes(state)
        before = (Path(self.co.path) / "state.json").read_bytes()
        with patch("workflow.MAX_STATE_BYTES", limit):
            with self.assertRaises(Closed):
                self.co.claim(self.auth, "second", "other", ["other"])
            self.assertEqual(before, (Path(self.co.path) / "state.json").read_bytes())
            self.co.resolve("c", token, "write")
            self.co.resolve("c", token, "write", PROOF)
            self.co.release("c", token, PROOF)
        self.assertEqual(self.co.tick()["claims"]["c"]["status"], "released")

    def test_replay_prepare_and_begin_do_not_write_or_invalidate_publication(self):
        token = self.claim()
        self.prepare_spawn(token)
        pub = self.publish()
        path = Path(self.co.path) / "state.json"
        before = path.read_bytes()
        with patch("workflow.save", side_effect=AssertionError("replay saved")):
            self.prepare_spawn(token)
        self.assertEqual(before, path.read_bytes())
        self.assertTrue(self.co.begin("c", token, "spawn", pub)["dispatch_authorized"])
        before = path.read_bytes()
        with patch("workflow.save", side_effect=AssertionError("replay saved")):
            self.assertFalse(self.co.begin("c", token, "spawn", {})["dispatch_authorized"])
        self.assertEqual(before, path.read_bytes())

    def test_replay_write_prepare_is_byte_stable(self):
        token = self.spawn()
        self.co.prepare("c", token, "write", "write", "/root/worker", "inc-1", "4" * 64)
        pub = self.publish()
        before = (Path(self.co.path) / "state.json").read_bytes()
        with patch("workflow.save", side_effect=AssertionError("replay saved")):
            self.assertFalse(self.co.prepare("c", token, "write", "write", "other", "other", "5" * 64)["dispatch_authorized"])
        self.assertEqual(before, (Path(self.co.path) / "state.json").read_bytes())
        self.assertTrue(self.co.begin("c", token, "write", pub)["dispatch_authorized"])

    def test_cloud_provider_identity_is_observed_once_then_bound(self):
        token = self.claim()
        result = self.prepare_spawn(token, provider="cloud", task="provider-thread-42")
        op = self.co.tick()["claims"]["c"]["operations"]["spawn"]
        self.assertIsNone(op["specification"]["requested_task"])
        self.assertIsNone(op["observation"])
        self.co.begin("c", token, "spawn", self.publish())
        for wrong in (dict(result, correlation="0" * 64), dict(result, payload="0" * 64),
                      dict(result, observed=dict(result["observed"], provider="native", task="/root/other"))):
            with self.assertRaises(Closed):
                self.co.record_spawn("c", token, "spawn", **wrong)
        self.co.record_spawn("c", token, "spawn", **result)
        with self.assertRaises(Closed):
            self.co.record_spawn("c", token, "spawn", **result)
        with self.assertRaises(Closed):
            self.co.prepare("c", token, "write", "write", "provider-thread-42", "inc-1", "6" * 64)
        new = self.co.bind("c", token, "spawn", **result)["token"]
        for used in (token, new):
            with self.assertRaises(Closed):
                self.co.bind("c", used, "spawn", **result)
        with self.assertRaises(Closed):
            self.co.prepare("c", new, "wrong-turn", "write", "provider-thread-42", "inc-2", "6" * 64)
        self.co.prepare("c", new, "write", "write", "provider-thread-42", "inc-1", "6" * 64)

    def test_native_spawn_requires_the_observed_canonical_task_path(self):
        token = self.claim()
        result = self.prepare_spawn(token)
        self.co.begin("c", token, "spawn", self.publish())
        with self.assertRaises(Closed):
            self.co.record_spawn("c", token, "spawn", **dict(result,
                observed=dict(result["observed"], task="/root/other")))
        self.co.record_spawn("c", token, "spawn", **result)

    def test_unknown_spawn_never_binds_or_redispatches(self):
        token = self.claim()
        result = self.prepare_spawn(token, provider="cloud", task="possibly-created")
        self.co.begin("c", token, "spawn", self.publish())
        self.co.resolve("c", token, "spawn")
        for action in (lambda: self.co.record_spawn("c", token, "spawn", **result),
                       lambda: self.co.bind("c", token, "spawn", **result),
                       lambda: self.prepare_spawn(token, "second"),
                       lambda: self.co.release("c", token, PROOF)):
            with self.assertRaises(Closed):
                action()
        self.assertFalse(self.co.begin("c", token, "spawn", {})["dispatch_authorized"])
        self.assertEqual(self.co.tick()["claims"]["c"]["operations"]["spawn"]["status"], "unknown")

    def test_adopt_existing_owner_requires_authority_evidence_and_exact_identity(self):
        token = self.co.claim(self.auth, "c", "/root", ["integration-publication"])["token"]
        observed = dict(provider="native", task="/root", incarnation="observed-root-runtime-id", evidence="7" * 64)
        evidence = dict(identity_observed=True, no_ungated_effects=True, evidence="7" * 64)
        for args in (dict(authority="wrong", observed=observed, evidence=evidence),
                     dict(authority=self.auth, observed=dict(observed, task="/root/other"), evidence=evidence),
                     dict(authority=self.auth, observed=observed, evidence=dict(evidence, identity_observed=False))):
            with self.assertRaises(Closed):
                self.co.adopt_existing(claim_id="c", token=token, **args)
        new = self.co.adopt_existing(self.auth, "c", token, observed, evidence)["token"]
        with self.assertRaises(Closed):
            self.co.adopt_existing(self.auth, "c", new, observed, evidence)
        with self.assertRaises(Closed):
            self.co.prepare("c", new, "bad", "write", "/root", "made-up", "8" * 64)
        self.co.prepare("c", new, "write", "write", "/root", "observed-root-runtime-id", "8" * 64)
        self.assertTrue(self.co.begin("c", new, "write", self.publish())["dispatch_authorized"])
        self.assertFalse(any(o["kind"] == "spawn" for o in self.co.tick()["claims"]["c"]["operations"].values()))

    def test_partial_recovery_preserves_quarantine_and_allows_only_proven_disjoint_work(self):
        token = self.claim("old", "render")
        snapshot = self.co.tick()
        # Synthetic fixture models an unresolved unknown scope; never production evidence.
        snapshot["barrier"], snapshot["admission"] = True, None
        snapshot["claims"]["old"]["domains"] = ["historical-unknown-scope"]
        restored, authority = Coordinator.bootstrap(self.root / "partial", snapshot)
        authority = restored.admit_recovery(authority, ADMISSION)["authority"]
        with self.assertRaises(Closed):
            restored.claim(authority, "next", "owner", ["docs"])
        restored.bound_recovery_scope(authority, "old", ["render"], dict(complete_scope=True, evidence="8" * 64))
        self.assertEqual(restored.tick()["claims"]["old"]["status"], "quarantined")
        with self.assertRaises(Closed):
            restored.claim(authority, "conflict", "owner", ["render"])
        restored.claim(authority, "next", "owner", ["docs"])
        with self.assertRaises(Closed):
            restored.bound_recovery_scope(authority, "old", ["other"], dict(complete_scope=True, evidence="8" * 64))
        restored.reconcile_claim(authority, "old", PROOF)
        restored.claim(authority, "new-render", "owner", ["render"])

    def test_oversize_bootstrap_does_not_create_a_destination(self):
        snapshot = self.co.tick()
        snapshot["claims"]["large"] = dict(owner="owner", domains=[
            f"domain-{i:05d}-" + "x" * 147 for i in range(24000)], status="quarantined",
            operations={}, binding=None, proof=None, scope_proof=None)
        snapshot["barrier"], snapshot["admission"] = True, None
        destination = self.root / "oversize"
        with self.assertRaises(Closed):
            Coordinator.bootstrap(destination, snapshot)
        self.assertFalse(destination.exists())

    def test_correlation_cannot_be_reused_for_another_operation(self):
        token = self.claim()
        self.prepare_spawn(token)
        op = self.co.tick()["claims"]["c"]["operations"]["spawn"]
        self.co.resolve("c", token, "spawn", PROOF)
        before = (Path(self.co.path) / "state.json").read_bytes()
        with self.assertRaises(Closed):
            self.co.prepare_spawn("c", token, "second", op["correlation"], op["specification"])
        self.assertEqual(before, (Path(self.co.path) / "state.json").read_bytes())

    def test_spawn_specification_and_observation_are_strict(self):
        token = self.claim()
        correlation = secrets.token_hex(32)
        cloud = dict(provider="cloud", parent="actual-parent", requested_task=None, request_sha256="3" * 64)
        for spec in (dict(cloud, requested_task="invented-id"), dict(cloud, freeform="sensitive"),
                     dict(cloud, provider="native", requested_task="not-a-canonical-path")):
            with self.assertRaises(Closed):
                self.co.prepare_spawn("c", token, "spawn", correlation, spec)
        with self.assertRaises(Closed):
            self.co.prepare("c", token, "spawn", "spawn", "invented", "invented", "3" * 64)
        self.assertFalse(self.co.tick()["claims"]["c"]["operations"])

    def test_recovery_scope_requires_evidence_and_cannot_expand_known_scope(self):
        self.claim("old", "render")
        restored, authority = Coordinator.bootstrap(self.root / "scoped", self.co.tick())
        path = Path(restored.path) / "state.json"
        before = path.read_bytes()
        for domains, evidence in ((["render"], dict(complete_scope=False, evidence="8" * 64)),
                                  (["other"], dict(complete_scope=True, evidence="8" * 64))):
            with self.assertRaises(Closed):
                restored.bound_recovery_scope(authority, "old", domains, evidence)
        self.assertEqual(before, path.read_bytes())
        with self.assertRaises(Closed):
            restored.reconcile_claim(authority, "old", dict(PROOF, effects=False))
        self.assertEqual(before, path.read_bytes())

    def test_admission_does_not_resolve_or_rotate_claims_and_restore_rotates_authority(self):
        token = self.claim()
        self.prepare_spawn(token)
        restored, authority = Coordinator.bootstrap(self.root / "admitted", self.co.tick())
        before = restored.tick()["claims"]
        new = restored.admit_recovery(authority, ADMISSION)["authority"]
        self.assertEqual(before, restored.tick()["claims"])
        with self.assertRaises(Closed):
            restored.claim(authority, "new", "owner", ["unrelated"])
        with self.assertRaises(Closed):
            restored.prepare("c", token, "write", "write", "/root/worker", "inc-1", "3" * 64)
        restored.claim(new, "new", "owner", ["unrelated"])

    def test_max_identity_capacity_is_stable_across_decimal_revision_boundary(self):
        token = self.claim()
        result = self.prepare_spawn(token, task="/" + "t" * 159)
        result["observed"]["incarnation"] = "i" * 160
        with self.co.transaction() as state:
            state["revision"] = 87  # Save produces the reviewer's prepared revision 88.
        self.assertEqual(self.co.tick()["revision"], 88)
        pub = self.publish()
        state = json.loads((Path(self.co.path) / "state.json").read_bytes())
        with patch("workflow.MAX_STATE_BYTES", capacity_bytes(state)):
            self.co.begin("c", token, "spawn", pub)
            self.co.record_spawn("c", token, "spawn", **result)
            token = self.co.bind("c", token, "spawn", **result)["token"]
            self.co.release("c", token, PROOF)
        self.assertEqual(self.co.tick()["claims"]["c"]["status"], "released")

    def test_revision_exhaustion_reserves_resolve_and_release(self):
        token = self.spawn()
        self.co.prepare("c", token, "write", "write", "/root/worker", "inc-1", "4" * 64)
        with self.co.transaction() as state:
            state["revision"] = MAX_REVISION - 3
        path = Path(self.co.path) / "state.json"
        before = path.read_bytes()
        with self.assertRaises(Closed):
            self.co.claim(self.auth, "other", "owner", ["other"])
        self.assertEqual(before, path.read_bytes())
        self.co.resolve("c", token, "write", PROOF)
        self.co.release("c", token, PROOF)
        self.assertEqual(self.co.tick()["revision"], MAX_REVISION)
        self.assertEqual(self.co.tick()["claims"]["c"]["status"], "released")
        with self.assertRaises(Closed):
            self.co.claim(self.auth, "later", "owner", ["other"])

    def test_revision_exhaustion_keeps_quarantined_recovery_closure_available(self):
        token = self.claim()
        self.prepare_spawn(token)
        restored, authority = Coordinator.bootstrap(self.root / "last-revisions", self.co.tick())
        with restored.transaction() as state:
            state["revision"] = MAX_REVISION - 4
        # Admission + per-intent resolve + claim release are numerically reserved.
        authority = restored.admit_recovery(authority, ADMISSION)["authority"]
        self.assertEqual(restored.tick()["revision"], MAX_REVISION - 2)
        with self.assertRaises(Closed):
            restored.claim(authority, "other", "owner", ["other"])
        restored.reconcile_claim(authority, "c", PROOF)
        final = restored.tick()
        self.assertEqual(final["revision"], MAX_REVISION - 1)
        self.assertEqual(final["claims"]["c"]["status"], "released")
        self.assertEqual(final["claims"]["c"]["operations"]["spawn"]["status"], "resolved")
        self.assertEqual(restored.checkpoint()["snapshot"], final)

    def test_exact_capacity_reserves_false_barrier_during_admission(self):
        self.claim()
        restored, authority = Coordinator.bootstrap(self.root / "admission-capacity", self.co.tick())
        state = json.loads((Path(restored.path) / "state.json").read_bytes())
        with patch("workflow.MAX_STATE_BYTES", capacity_bytes(state)):
            authority = restored.admit_recovery(authority, ADMISSION)["authority"]
            restored.reconcile_claim(authority, "c", PROOF)
        self.assertFalse(restored.tick()["barrier"])
        self.assertEqual(restored.tick()["claims"]["c"]["status"], "released")

    def native_scope(self, root_id="observed-root-conversation"):
        evidence = dict(scope_observed=True, unique_task_paths=True, evidence="a" * 64)
        return self.co.register_native_execution(self.auth, root_id, evidence)["scope"]

    def prepare_local_spawn(self, token, scope, task="/root/local_worker", operation="spawn"):
        correlation = secrets.token_hex(32)
        specification = dict(provider="native", parent="/root", requested_task=task,
                             request_sha256="b" * 64, local_execution=scope)
        result = self.co.prepare_spawn("c", token, operation, correlation, specification)
        observed = native_observation(scope, task, "c" * 64)
        return dict(correlation=correlation, payload=result["payload"], observed=observed)

    def test_native_namespace_registration_is_explicit_observed_and_immutable(self):
        before = (Path(self.co.path) / "state.json").read_bytes()
        with self.assertRaises(Closed):
            self.co.register_native_execution(self.auth, "root", dict(
                scope_observed=True, unique_task_paths=False, evidence="a" * 64))
        self.assertEqual(before, (Path(self.co.path) / "state.json").read_bytes())
        scope = self.native_scope()
        self.assertEqual(scope["coordinator_epoch"], self.co.tick()["epoch"])
        self.assertEqual(scope["boot_id"], Path("/proc/sys/kernel/random/boot_id").read_text().strip())
        with self.assertRaises(Closed):
            self.native_scope()
        self.assertEqual(self.co.tick()["native_execution"]["scope"], scope)

    def test_native_local_spawn_uses_only_returned_path_and_exact_receipt(self):
        scope = self.native_scope()
        token = self.claim()
        result = self.prepare_local_spawn(token, scope)
        self.co.begin("c", token, "spawn", self.publish(), root_id=scope["root_id"])
        response = dict(task_name="/root/local_worker")  # Actual supported response shape; no invented agent_id.
        observed = native_observation(scope, response["task_name"], "c" * 64)
        self.assertEqual(result["observed"], observed)
        self.assertTrue(observed["incarnation"].startswith("local:"))
        self.co.record_spawn("c", token, "spawn", **result)
        with self.assertRaises(Closed):
            self.co.bind("c", token, "spawn", **dict(result, observed=dict(observed, evidence="d" * 64)))
        token = self.co.bind("c", token, "spawn", **result)["token"]
        self.co.prepare("c", token, "write", "write", observed["task"], observed["incarnation"], "d" * 64)
        publication = self.publish()
        before = (Path(self.co.path) / "state.json").read_bytes()
        for root in (None, "other-root"):
            with self.assertRaises(Closed):
                self.co.begin("c", token, "write", publication, root_id=root)
        self.assertEqual(before, (Path(self.co.path) / "state.json").read_bytes())
        self.assertTrue(self.co.begin("c", token, "write", publication,
                                    root_id=scope["root_id"])["dispatch_authorized"])
        self.co.resolve("c", token, "write", PROOF)
        self.co.release("c", token, PROOF)
        next_token = self.co.claim(self.auth, "next", "owner", ["next"])["token"]
        spec = dict(provider="native", parent="/root", requested_task=observed["task"],
                    request_sha256="e" * 64, local_execution=scope)
        with self.assertRaises(Closed):
            self.co.prepare_spawn("next", next_token, "different-create", secrets.token_hex(32), spec)

    def test_existing_root_local_adoption_and_sequential_claims_preserve_identity(self):
        scope = self.native_scope()
        observed = native_observation(scope, "/root", "d" * 64)
        evidence = dict(identity_observed=True, no_ungated_effects=True, evidence="d" * 64)
        token = self.co.claim(self.auth, "root-one", "/root", ["root-domain"])["token"]
        new = self.co.adopt_existing(self.auth, "root-one", token, observed, evidence)["token"]
        self.co.release("root-one", new, PROOF)
        token = self.co.claim(self.auth, "root-two", "/root", ["root-domain"])["token"]
        fresh = native_observation(scope, "/root", "e" * 64)
        self.assertEqual(fresh["incarnation"], observed["incarnation"])
        token = self.co.adopt_existing(self.auth, "root-two", token, fresh,
                                      dict(evidence, evidence="e" * 64))["token"]
        self.co.prepare("root-two", token, "write", "write", "/root", fresh["incarnation"], "f" * 64)
        self.assertTrue(self.co.begin("root-two", token, "write", self.publish(),
                                     root_id=scope["root_id"])["dispatch_authorized"])
        other = self.co.claim(self.auth, "root-three", "/root", ["other-domain"])["token"]
        with self.assertRaises(Closed):
            self.co.adopt_existing(self.auth, "root-three", other, fresh, dict(evidence, evidence="e" * 64))

    def test_native_local_identity_and_current_boot_cannot_be_substituted(self):
        scope = self.native_scope()
        token = self.claim()
        result = self.prepare_local_spawn(token, scope)
        publication = self.publish()
        with patch("workflow.current_boot_id", return_value="ffffffff-ffff-ffff-ffff-ffffffffffff"):
            with self.assertRaises(Closed):
                self.co.begin("c", token, "spawn", publication, root_id=scope["root_id"])
        self.co.begin("c", token, "spawn", publication, root_id=scope["root_id"])
        for observed in (dict(result["observed"], incarnation="invented-provider-id"),
                         native_observation(dict(scope, root_id="other-root"), "/root/local_worker", "c" * 64)):
            with self.assertRaises(Closed):
                self.co.record_spawn("c", token, "spawn", **dict(result, observed=observed))
        with patch("workflow.current_boot_id", return_value="ffffffff-ffff-ffff-ffff-ffffffffffff"):
            with self.assertRaises(Closed):
                self.co.record_spawn("c", token, "spawn", **result)
        self.co.record_spawn("c", token, "spawn", **result)
        with patch("workflow.current_boot_id", return_value="ffffffff-ffff-ffff-ffff-ffffffffffff"):
            with self.assertRaises(Closed):
                self.co.bind("c", token, "spawn", **result)

    def test_native_restore_preserves_old_scope_without_reusing_create_path(self):
        scope = self.native_scope()
        token = self.claim()
        result = self.prepare_local_spawn(token, scope)
        self.co.begin("c", token, "spawn", self.publish(), root_id=scope["root_id"])
        self.co.record_spawn("c", token, "spawn", **result)
        self.co.bind("c", token, "spawn", **result)
        restored, authority = Coordinator.bootstrap(self.root / "native-restored", self.co.tick())
        self.assertIsNone(restored.tick()["native_execution"])
        old = restored.tick()["claims"]["c"]
        self.assertEqual(old["status"], "quarantined")
        self.assertEqual(old["binding"]["local_execution"], scope)
        authority = restored.admit_recovery(authority, ADMISSION)["authority"]
        with patch("workflow.current_boot_id", return_value="ffffffff-ffff-ffff-ffff-ffffffffffff"):
            new_scope = restored.register_native_execution(authority, scope["root_id"], dict(
                scope_observed=True, unique_task_paths=True, evidence="a" * 64))["scope"]
            next_token = restored.claim(authority, "next", "owner", ["disjoint"])["token"]
            spec = dict(provider="native", parent="/root", requested_task="/root/local_worker",
                        request_sha256="e" * 64, local_execution=new_scope)
            with self.assertRaises(Closed):
                restored.prepare_spawn("next", next_token, "spawn", secrets.token_hex(32), spec)
        self.assertEqual(restored.tick()["claims"]["c"]["status"], "quarantined")

    def test_native_local_capacity_reserves_complete_scope_observation(self):
        scope = self.native_scope("r" * 160)
        token = self.claim()
        result = self.prepare_local_spawn(token, scope, task="/" + "t" * 159)
        publication = self.publish()
        state = json.loads((Path(self.co.path) / "state.json").read_bytes())
        with patch("workflow.MAX_STATE_BYTES", capacity_bytes(state)):
            self.co.begin("c", token, "spawn", publication, root_id=scope["root_id"])
            self.co.record_spawn("c", token, "spawn", **result)
            token = self.co.bind("c", token, "spawn", **result)["token"]
            self.co.release("c", token, PROOF)
        self.assertEqual(self.co.tick()["claims"]["c"]["status"], "released")

    def test_local_identity_cannot_fall_back_after_scope_field_loss(self):
        scope = self.native_scope()
        observed = native_observation(scope, "/root", "d" * 64)
        del observed["local_execution"]
        token = self.co.claim(self.auth, "root", "/root", ["root-domain"])["token"]
        before = (Path(self.co.path) / "state.json").read_bytes()
        with self.assertRaises(Closed):
            self.co.adopt_existing(self.auth, "root", token, observed, dict(
                identity_observed=True, no_ungated_effects=True, evidence="d" * 64))
        self.assertEqual(before, (Path(self.co.path) / "state.json").read_bytes())



if __name__ == "__main__":
    unittest.main()
