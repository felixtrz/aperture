"""Synthetic CPU lifecycles only; never scans/retires the actual scratch root."""
import dataclasses
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

import capacity as cap


class CapacitySessionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="capacity-unit-")
        self.base = Path(self.temp.name)
        self.root = self.base / "root"
        self.cfg = cap.c.Config(str(self.root), str(self.base / "audit"), frozenset([str(self.root)]))
        cap.c.initialize(self.cfg)
        self.stack = __import__("contextlib").ExitStack()
        self.stack.enter_context(patch.object(cap.c, "ALLOWED_ROOTS", frozenset([str(self.root)])))
        self.stack.enter_context(patch.object(cap.pressure, "disk_free", return_value=3 * 1024**3))
        marker=json.loads((self.root/cap.c.MARKER).read_bytes())
        self.policy=cap.Policy({"root":str(self.root),"rootMarker":marker,"runtimeRoot":str(self.base/"runtime"),
            "filesystemDevice":self.root.stat().st_dev,"stateDirectory":str(self.base/"state"),
            "createdNs":1,"expiresNs":2**63-1,"externalGrowthReserveBytes":0,"cacheLifetime":"retained",
            "slots":[{"id":"first","jobPattern":"unit","retainedReserveBytes":0,"peakReserveBytes":0},
                     {"id":"second","jobPattern":"unit","retainedReserveBytes":0,"peakReserveBytes":0}],
            "maintenance":{"enabled":False,"maximumPasses":2,"maximumRetirements":2,"initialKnownRuns":[]}},"1"*64)

    def tearDown(self):
        self.stack.close()
        self.temp.cleanup()

    def run(self, result=None):
        # unittest's run entry point, not a native runtime.
        return super().run(result)

    def closed_cpu(self, session, callback=None):
        code=cap.c.run_command(self.cfg,"unit","Synthetic CPU lifecycle; no browser",[sys.executable,"-B","-c","pass"],callback)
        session.complete(self.cfg,code)

    def resolved_interruption(self):
        # Reuse the complete synthetic root-reviewed no-launch graph. This calls
        # the real helper against private fixture data, never an actual incident.
        from test_interruption_resolution import NoLaunchTests
        fixture=NoLaunchTests();fixture.setUp()
        self.stack.callback(fixture.tearDown)
        self.root,self.cfg=fixture.root,fixture.cfg
        self.policy.value.update(root=str(self.root),rootMarker=json.loads((self.root/cap.c.MARKER).read_bytes()),filesystemDevice=self.root.stat().st_dev)
        receipt=cap.interruption.resolve(fixture.auth_pin,fixture.output)
        self.policy.value["resolvedInterruptionReceipts"]=[receipt]
        return fixture,receipt

    def test_serialized_sessions_cannot_spend_same_slot(self):
        with self.policy.session("first","unit") as first:
            with self.assertRaises(cap.c.Busy):
                with self.policy.session("first","unit"): pass
            self.closed_cpu(first)

    def test_completed_runtime_manifest_is_checkpointed_before_actual_synthetic_retirement(self):
        fixture=b"fixture"
        source=b"compressed fixture"
        runtime=self.base/"runtime/node_modules/@sparticuz/chromium"
        (runtime/"bin").mkdir(parents=True)
        (runtime/"package.json").write_text('{"version":"153.0.0"}')
        (runtime/"bin/chromium.br").write_bytes(source)
        pin=cap.pressure.Pin(len(fixture),hashlib.sha256(fixture).hexdigest(),hashlib.sha256(source).hexdigest())
        self.stack.enter_context(patch.object(cap.pressure,"SIZE",len(fixture)))
        self.stack.enter_context(patch.object(cap.pressure,"SHA256",pin.sha256))
        self.policy.value["maintenance"]["enabled"]=True
        self.policy.value["cacheLifetime"]="controlled-post-close"
        def register(cfg,run,path):
            (Path(path)/"chromium").write_bytes(fixture)
            (Path(path)/"unknown-evidence").write_bytes(b"preserved unknown")
            cap.c.register(cfg,run,"chromium","download-cache","Synthetic regenerable cache")
        with self.policy.session("first","unit") as session:
            def helper(action,output,extra=()):
                checkpoint=json.loads((Path(session.operation.path)/"checkpoint.json").read_bytes())
                before=Path(session.operation.path)/checkpoint["manifest"]["path"]
                self.assertIn("chromium",json.loads(before.read_bytes())["files"])
                cfg=cap.c.Config(str(self.root),str(Path(output)/"audits"))
                if action=="plan":cap.pressure.prepare(cfg,self.policy.value["runtimeRoot"],output,pin)
                else:cap.pressure.apply(cfg,self.policy.value["runtimeRoot"],extra[1],extra[3],output,pin)
            session.helper=helper
            self.closed_cpu(session,register)
            checkpoint=json.loads((Path(session.operation.path)/"checkpoint.json").read_bytes())
            current=json.loads((self.root/checkpoint["run"]/cap.c.MANIFEST).read_bytes())
            original=json.loads((Path(session.operation.path)/checkpoint["manifest"]["path"]).read_bytes())
            self.assertIn("chromium",original["files"])
            self.assertNotIn("chromium",current["files"])
            for field in ("state","created_ns","completed_ns","exitcode","job"):
                self.assertEqual(original[field],current[field])
            self.assertEqual((self.root/checkpoint["run"]/"unknown-evidence").read_bytes(),b"preserved unknown")
            self.assertEqual(session.state["retiredCount"],1)

    def test_failed_maintenance_is_sticky_and_original_checkpoint_survives(self):
        self.policy.value["maintenance"]["enabled"]=True
        with self.assertRaisesRegex(RuntimeError,"held synthetic failure"):
            with self.policy.session("first","unit") as session:
                def failed():raise RuntimeError("held synthetic failure")
                session.maintain=failed
                self.closed_cpu(session)
        state=json.loads((self.base/"state/state.json").read_bytes())
        self.assertEqual(state["status"],"blocked-reconciliation-required")
        self.assertTrue((self.base/"state/slot-first/completed-lifecycle-manifest.json").exists())
        for slot in ("first","second"):
            with self.assertRaises(cap.c.Unsafe):
                with self.policy.session(slot,"unit"):pass

    def test_fresh_actual_input_size_can_raise_reserve_and_block_before_cpu_launch(self):
        with self.assertRaisesRegex(cap.c.Unsafe,"Insufficient actual capacity"):
            with self.policy.session("first","unit",2*1024**3):pass
        self.assertFalse(any(cap.c.RUN_RE.fullmatch(path.name) for path in self.root.iterdir()))
        receipt=json.loads((self.base/"state/slot-first/admission.json").read_bytes())
        self.assertEqual(receipt["actualRetainedMinimumBytes"],2*1024**3)
        self.assertEqual(receipt["prospectiveRetirementCreditBytes"],0)

    def test_unresolved_known_lifecycle_blocks_even_without_live_lock(self):
        with cap.c.Store(self.cfg) as store,store.locked():
            cap.c.new_run(store,"unfinished","Synthetic ambiguous lifecycle")
        with self.assertRaisesRegex(cap.c.Unsafe,"Unresolved"):
            with self.policy.session("first","unit"):pass

    def test_out_of_order_and_repeat_slots_never_launch(self):
        with self.assertRaises(cap.c.Unsafe):
            with self.policy.session("second","unit"):pass
        with self.policy.session("first","unit") as session:self.closed_cpu(session)
        with self.assertRaises(cap.c.Unsafe):
            with self.policy.session("first","unit"):pass

    def test_controlled_cache_peak_counts_later_native_after_cpu_only_slot(self):
        value={"cacheLifetime":"controlled-post-close"}
        slots=[{"id":"cpu","retainedReserveBytes":0,"peakReserveBytes":0,"createsPinnedChromium":False},
               {"id":"native-one","retainedReserveBytes":0,"peakReserveBytes":0,"createsPinnedChromium":True},
               {"id":"native-two","retainedReserveBytes":0,"peakReserveBytes":0,"createsPinnedChromium":True}]
        jobs=cap.capacity_jobs(value,slots)
        self.assertEqual([job.creates_pinned_chromium for job in jobs],[False,True,False])
        result=cap.budget(cap.FLOOR_BYTES,1,jobs,(),True)
        self.assertEqual(result["status"],"blocked-insufficient-capacity")
        self.assertEqual(result["newChromiumCacheCount"],1)
        self.assertEqual(result["deficitBytes"],cap.CHROMIUM_BYTES)

    def test_early_checkpoint_joins_cache_retirement_owned_by_later_slot(self):
        interrupted,_=self.resolved_interruption()
        interrupted_original=interrupted.manifest.read_bytes()
        fixture=b"fixture"
        compressed=b"compressed fixture"
        package=self.base/"runtime/node_modules/@sparticuz/chromium"
        (package/"bin").mkdir(parents=True)
        (package/"package.json").write_text('{"version":"153.0.0"}')
        (package/"bin/chromium.br").write_bytes(compressed)
        pin=cap.pressure.Pin(7,hashlib.sha256(fixture).hexdigest(),hashlib.sha256(compressed).hexdigest())
        self.stack.enter_context(patch.object(cap.pressure,"SIZE",7))
        self.stack.enter_context(patch.object(cap.pressure,"SHA256",pin.sha256))
        self.policy.value["maintenance"]["enabled"]=True
        self.policy.value["cacheLifetime"]="controlled-post-close"
        def register(cfg,run,path):
            (Path(path)/"chromium").write_bytes(fixture)
            cap.c.register(cfg,run,"chromium","download-cache","Synthetic cache")
        with patch.object(cap.pressure,"disk_free",return_value=10*1024**3):
            with self.policy.session("first","unit") as first:self.closed_cpu(first,register)
        first_checkpoint=json.loads((self.base/"state/slot-first/checkpoint.json").read_bytes())
        first_original=(self.base/"state/slot-first/completed-lifecycle-manifest.json").read_bytes()
        self.assertTrue((self.root/first_checkpoint["run"]/"chromium").exists())
        self.cfg=dataclasses.replace(self.cfg,audit_dir=str(self.base/"second-audit"))
        with self.policy.session("second","unit") as second:
            def helper(action,output,extra=()):
                cfg=cap.c.Config(str(self.root),str(Path(output)/"audits"))
                if action=="plan":cap.pressure.prepare(cfg,self.policy.value["runtimeRoot"],output,pin)
                else:cap.pressure.apply(cfg,self.policy.value["runtimeRoot"],extra[1],extra[3],output,pin)
            second.helper=helper
            self.closed_cpu(second,register)
        with patch.object(cap.Policy,"load",return_value=self.policy):
            original,join=cap.checkpoint_manifest({"path":"synthetic-readonly-policy","sha256":self.policy.sha256},"first",first_checkpoint["run"],"unit")
        self.assertEqual(original,first_original)
        self.assertIn("slot-second/pressure-apply",join["cacheRetirementBridge"]["outcome"]["path"])
        self.assertNotEqual(join["originalManifestSha256"],join["currentManifestSha256"])
        self.assertFalse((self.root/first_checkpoint["run"]/"chromium").exists())
        self.assertEqual(interrupted.manifest.read_bytes(),interrupted_original)

    def test_explicit_resolution_allows_completed_checkpoint_but_never_active_checkpoint(self):
        interrupted,receipt=self.resolved_interruption()
        with self.policy.session("first","unit") as session:self.closed_cpu(session)
        operation=self.base/"state/slot-first"
        checkpoint=json.loads((operation/"checkpoint.json").read_bytes())
        original=(operation/"completed-lifecycle-manifest.json").read_bytes()
        record={"path":"synthetic-readonly-policy","sha256":self.policy.sha256}
        with patch.object(cap.Policy,"load",return_value=self.policy):
            actual,join=cap.checkpoint_manifest(record,"first",checkpoint["run"],"unit")
            self.assertEqual(actual,original);self.assertIsNone(join["cacheRetirementBridge"])
            self.policy.value.pop("resolvedInterruptionReceipts")
            with self.assertRaisesRegex(cap.c.Unsafe,"Unresolved ACTIVE"):
                cap.checkpoint_manifest(record,"first",checkpoint["run"],"unit")
            self.policy.value["resolvedInterruptionReceipts"]=[receipt]
            # A valid quiescence receipt for this ACTIVE run must still never
            # turn its original manifest into completed-checkpoint evidence.
            path=operation/"completed-lifecycle-manifest.json";path.chmod(0o600)
            path.write_bytes(interrupted.original);path.chmod(0o444)
            checkpoint.update(run=interrupted.run,job="interrupted-unit",manifest={"path":path.name,"bytes":len(interrupted.original),"sha256":hashlib.sha256(interrupted.original).hexdigest()})
            path=operation/"checkpoint.json";path.chmod(0o600)
            path.write_text(json.dumps(checkpoint));path.chmod(0o444)
            with self.assertRaisesRegex(cap.c.Unsafe,"Original completed job differs"):
                cap.checkpoint_manifest(record,"first",interrupted.run,"interrupted-unit")
        self.assertEqual(interrupted.manifest.read_bytes(),interrupted.original)


if __name__=="__main__":unittest.main()
