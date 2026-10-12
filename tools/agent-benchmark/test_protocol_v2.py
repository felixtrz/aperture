"""CPU-only protocol preparation/completion classification; no native jobs."""
import importlib.util
from pathlib import Path
import unittest


def load(name):
    spec = importlib.util.spec_from_file_location(name.replace("-", "_"), Path(__file__).with_name(name + ".py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


DRIVER = load("official-trials-v2")
PREPARE = load("prepare-round")


class ProtocolPreparationTests(unittest.TestCase):
    def summary(self, invalid=False):
        return {"schema": "aperture.agent-house-summary.v1", "roundRoot": "/round", "artifactProtocol": "aperture.agent-house-artifacts.v2", "status": "incomplete-or-invalid-evidence" if invalid else "validated-components-pending-independent-judging", "validationErrors": [{"error": "capture rejected"}] if invalid else [], "engines": {engine: {"trials": [{"engine": engine, "trial": trial} for trial in (1, 2, 3)]} for engine in ("three", "aperture")}}

    def test_complete_ineligible_sequence_keeps_failure_exit_without_operational_halt(self):
        self.assertEqual(DRIVER.classify_summary(1, self.summary(True), "/round"), "six-preselected-attempts-completed-ineligible")
        self.assertEqual(DRIVER.classify_summary(0, self.summary(), "/round"), "six-preselected-attempts-completed")

    def test_contradictory_missing_partial_or_legacy_summary_requires_reconciliation(self):
        for code, report in [(0, self.summary(True)), (1, self.summary()), (1, None), (2, self.summary(True))]:
            with self.assertRaises(RuntimeError):
                DRIVER.classify_summary(code, report, "/round")
        for field, value in [("schema", "unknown"), ("roundRoot", "/other"), ("artifactProtocol", "aperture.agent-house-artifacts.v1"), ("engines", {})]:
            report = self.summary()
            report[field] = value
            with self.assertRaises(RuntimeError):
                DRIVER.classify_summary(0, report, "/round")

    def test_fresh_round_order_alternates_without_replacing_historical_round(self):
        self.assertEqual(DRIVER.trial_order("round-003"), [("three", 1), ("aperture", 1), ("aperture", 2), ("three", 2), ("three", 3), ("aperture", 3)])
        self.assertEqual(DRIVER.trial_order("round-004")[0], ("aperture", 1))
        with self.assertRaises(RuntimeError):
            DRIVER.trial_order("round-002")

    def test_both_prompts_share_protocol_rules_and_include_only_generic_public_docs(self):
        self.assertIn("RENDERED_GEOMETRY_INSPECTION.md", PREPARE.DOCS)
        self.assertIn("HEADLESS_SOURCE_REALMS.md", PREPARE.DOCS)
        self.assertNotIn("AGENT_ARCHITECTURE_AUDIT.md", PREPARE.DOCS)
        for engine in ("three", "aperture"):
            prompt = PREPARE.prompt(engine, engine + "-r003", Path("/own-reference"), "common contract")
            self.assertIn(PREPARE.COMMON_PROMPT, prompt)
            self.assertIn("1800000 ms verifier readiness/navigation", prompt)
            self.assertIn("Float64LE", prompt)
            self.assertNotIn("303238", prompt)
            self.assertNotIn("64 MiB geometry.json", prompt)
        self.assertIn("tools/agent-benchmark/run-v2.mjs", PREPARE.SETUP_INPUTS)


if __name__ == "__main__":
    unittest.main()
