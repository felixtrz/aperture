"""Pure v2 preparation tests: temporary inputs, no Docker or browser launches."""

import importlib.util
import json
from pathlib import Path
import shutil
import struct
import tempfile
import unittest
import zlib
from unittest.mock import patch


SPEC = importlib.util.spec_from_file_location("prepare_fair_round", Path(__file__).with_name("prepare-fair-round.py"))
FAIR = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(FAIR)
LANE_SPEC = importlib.util.spec_from_file_location("explicit_config_author_lane", Path(__file__).with_name("author-lane.py"))
LANE = importlib.util.module_from_spec(LANE_SPEC)
LANE_SPEC.loader.exec_module(LANE)


class FairRoundPreparationTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="fair-round-preparation-")
        self.root = Path(self.temporary.name)
        self.evidence = FAIR.suite_paths(self.root)["evidence"]
        self.evidence.mkdir(parents=True)
        helper = self.root / "tools/agent-benchmark/prepare-round.py"
        helper.parent.mkdir(parents=True)
        shutil.copyfile(Path(__file__).with_name("prepare-round.py"), helper)
        source_suite = FAIR.suite_paths()["evidence"]
        self.contract = json.loads((source_suite / "fairness-contract.json").read_bytes())
        for name in ("method.json", "fairness-contract.json", "reference-policy.json"):
            shutil.copyfile(source_suite / name, self.evidence / name)
        self.contract_patch = patch.object(FAIR, "exported_contract", return_value=self.contract)
        self.contract_patch.start()
        self.method = json.loads((self.evidence / "method.json").read_bytes())
        self.method["fairnessContract"] = FAIR.pin(self.evidence / "fairness-contract.json", self.evidence)
        self.write_method()
        self.historical = self.root / "benchmarks/agent-house-race-20261011/method.json"
        self.historical.parent.mkdir(parents=True)
        self.historical.write_bytes(b"historical method evidence must survive")

    def tearDown(self):
        self.contract_patch.stop()
        self.temporary.cleanup()

    def write_method(self):
        path = self.evidence / "method.json"
        path.chmod(0o644)
        path.write_bytes(FAIR.json_bytes(self.method))

    def freeze(self):
        FAIR.freeze_inputs(self.root, contract=self.contract)
        return FAIR.load_inputs(self.root, contract=self.contract)

    def image(self, round_number=6, color=10):
        image = self.root / f"generated-{round_number}-{color}.png"
        def chunk(kind, data):
            return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))
        data = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 6, 0, 0, 0))
        data += chunk(b"IDAT", zlib.compress(bytes((0, color, color, color, 255)))) + chunk(b"IEND", b"")
        image.write_bytes(data)
        receipt = image.with_suffix(".json")
        receipt.write_bytes(FAIR.json_bytes({"schema": "aperture.house-race-generated-reference.v2", "generator": "image_gen",
                                           "generatedAt": "2026-10-13T00:00:00Z", "imageSha256": FAIR.digest(data),
                                           "prompt": "unit fixture generation attestation; no actual generator call"}))
        return image, receipt

    def select(self, round_number=6, color=10, task_brief=None):
        if not (self.evidence / "input-freeze.json").exists():
            self.freeze()
        image, receipt = self.image(round_number, color)
        return FAIR.select_reference(round_number, image, receipt, task_brief, self.root)

    def test_plan_is_mutation_free_and_uses_explicit_isolated_configuration(self):
        before = sorted(str(path) for path in self.root.rglob("*"))
        plan = FAIR.plan(6, self.root)
        self.assertEqual(before, sorted(str(path) for path in self.root.rglob("*")))
        self.assertIn(FAIR.SUITE, plan["public"])
        self.assertIn(FAIR.PRIVATE_NAME, plan["pending"])
        self.assertIn("--config " + plan["pending"], plan["authorCommand"])
        self.assertIn("--config " + plan["pending"], plan["previewCommand"])
        self.assertEqual(plan["scratchRoot"], "/workspace/shared/aperture-tmp")
        self.assertEqual(plan["referencePolicy"], FAIR.REFERENCE_POLICY_V2)
        self.assertFalse(plan["createsAuthors"])
        self.assertFalse(plan["activatesConfiguration"])
        self.assertEqual(self.historical.read_bytes(), b"historical method evidence must survive")

    def test_freeze_is_create_only_pre_author_and_rejects_changed_pins(self):
        inputs = self.freeze()
        self.assertEqual(inputs["freeze"]["inputs"], inputs["pins"])
        self.assertEqual((self.evidence / "method.json").stat().st_mode & 0o222, 0)
        self.assertNotIn("reference", inputs["pins"])
        self.assertIn("referencePolicy", inputs["pins"])
        with self.assertRaisesRegex(FAIR.FairPreparationError, "already exists"):
            FAIR.freeze_inputs(self.root, contract=self.contract)
        self.method["comparisonLimits"] += " changed after freeze"
        self.write_method()
        with self.assertRaisesRegex(FAIR.FairPreparationError, "Frozen input hash/size"):
            FAIR.load_inputs(self.root, contract=self.contract)
        self.assertEqual(self.historical.read_bytes(), b"historical method evidence must survive")

    def test_freeze_refuses_existing_round_or_author_workspace(self):
        (self.evidence / "round-006").mkdir()
        with self.assertRaisesRegex(FAIR.FairPreparationError, "precede all v2 author-round"):
            FAIR.freeze_inputs(self.root, contract=self.contract)
        (self.evidence / "round-006").rmdir()
        FAIR.suite_paths(self.root)["private"].joinpath("lanes").mkdir(parents=True)
        with self.assertRaisesRegex(FAIR.FairPreparationError, "precede all v2 author workspaces"):
            FAIR.freeze_inputs(self.root, contract=self.contract)

    def test_method_contract_version_and_meaningful_edge_cannot_drift(self):
        self.method["benchmarkVersion"] = "1.0.0"
        self.write_method()
        with self.assertRaisesRegex(FAIR.FairPreparationError, "predeclared v2 method"):
            FAIR.load_inputs(self.root, require_frozen=False, contract=self.contract)
        self.method["benchmarkVersion"] = "2.0.0"
        self.method["meaningfulEdge"]["componentGainMinimumFraction"] = 0
        self.write_method()
        with self.assertRaisesRegex(FAIR.FairPreparationError, "meaningful-edge"):
            FAIR.load_inputs(self.root, require_frozen=False, contract=self.contract)

    def test_contract_requires_exact_bytes_and_current_semantics(self):
        path = self.evidence / "fairness-contract.json"
        path.write_bytes(path.read_bytes() + b" ")
        with self.assertRaisesRegex(FAIR.FairPreparationError, "hash or size differs"):
            FAIR.load_inputs(self.root, require_frozen=False, contract=self.contract)
        changed = {**self.contract, "version": "2.1.0"}
        path.write_bytes(FAIR.json_bytes(changed))
        self.method["fairnessContract"] = FAIR.pin(path, self.evidence)
        self.write_method()
        with self.assertRaisesRegex(FAIR.FairPreparationError, "current version"):
            FAIR.load_inputs(self.root, require_frozen=False, contract=self.contract)

    def test_configured_helper_preserves_old_context_and_snapshots_all_frozen_inputs(self):
        inputs = self.freeze()
        self.select()
        helper = FAIR.configured_helper(6, self.root, inputs=inputs)
        independent = FAIR.load_base(self.root)
        self.assertEqual(independent.PRIVATE.name, "agent-house-race")
        self.assertEqual(independent.EVIDENCE.name, "agent-house-race-20261011")
        self.assertEqual(helper.PRIVATE.name, FAIR.PRIVATE_NAME)
        self.assertEqual(helper.EVIDENCE.name, FAIR.SUITE)
        self.assertIn("tools/agent-benchmark/lifecycle-roots.mjs", helper.SETUP_INPUTS)
        self.assertIn("tools/agent-benchmark/fairness-v2.mjs", helper.SETUP_INPUTS)
        setup = helper.paths(6)["public"] / "setup"
        origins = []
        helper.copy_file(self.evidence / "method.json", setup / "method.json", origins)
        self.assertEqual({path.name for path in setup.iterdir()}, {"method.json", "fairness-contract.json", "input-freeze.json",
                                                                 "reference-policy.json", "reference-selection.json",
                                                                 "reference-generation.json", "task-brief.txt"})
        self.assertEqual(len(origins), 7)
        for record in origins:
            self.assertEqual(FAIR.digest(Path(record["destination"]).read_bytes()), record["sha256"])
        self.assertEqual(self.historical.read_bytes(), b"historical method evidence must survive")

    def test_both_prompts_and_starters_use_frozen_contract_and_new_config(self):
        inputs = self.freeze()
        self.select()
        helper = FAIR.configured_helper(6, self.root, inputs=inputs)
        self.assertNotIn("distant landscape is optional", helper.COMMON_PROMPT)
        for engine in ("three", "aperture"):
            public = helper.paths(6)["lanes"] / engine / "public"
            public.mkdir(parents=True)
            prompt = helper.prompt(engine, f"{engine}-r006", public, "Common interface fixture")
            self.assertIn(helper.COMMON_PROMPT, prompt)
            self.assertIn("--config " + str(helper.paths(6)["pending"]), prompt)
            self.assertIn(inputs["pins"]["contract"]["sha256"], prompt)
            self.assertIn("newly generated", prompt)
            self.assertIn(FAIR.DEFAULT_TASK_BRIEF, prompt)
            declaration = json.loads(helper.starter(engine, {})[FAIR.DECLARATION_FILE])
            self.assertEqual(declaration["authorId"], f"{engine}-r006")
            self.assertEqual(declaration["contractSha256"], inputs["pins"]["contract"]["sha256"])
            self.assertEqual(declaration["settings"], self.contract["settings"])
            self.assertEqual(declaration["inventory"]["geometries"], [])
            self.assertFalse(all(declaration["requiredFeatures"].values()))
            self.assertEqual(json.loads((public / "fairness-declaration-template.json").read_bytes()), declaration)

    def test_pending_config_and_preparation_record_bind_the_fairness_gate(self):
        inputs = self.freeze()
        selected = self.select()
        helper = FAIR.configured_helper(6, self.root, inputs=inputs)
        pending = helper.paths(6)["pending"]
        helper.create_file(pending, FAIR.json_bytes({"schema": "aperture.author-lanes.v1", "lanes": {}}))
        value = json.loads(pending.read_bytes())
        self.assertEqual(value["benchmarkSuite"], FAIR.SUITE)
        self.assertEqual(value["scratchRoot"], FAIR.SCRATCH_ROOT)
        self.assertEqual(value["authorDeclarationFile"], FAIR.DECLARATION_FILE)
        self.assertEqual(value["fairnessContract"]["sha256"], inputs["pins"]["contract"]["sha256"])
        self.assertIn("legacy summary alone is insufficient", value["fairnessGate"])
        self.assertEqual(value["referenceSelection"]["sha256"], FAIR.pin(FAIR.round_reference_directory(6, self.root) / "reference-selection.json", self.root)["sha256"])
        self.assertEqual(selected["reference"]["sha256"], FAIR.load_reference(6, self.root)["reference"]["sha256"])
        self.assertFalse(FAIR.suite_paths(self.root)["private"].joinpath("control/lanes.json").exists())
        with self.assertRaises(FileExistsError):
            helper.create_file(pending, FAIR.json_bytes({"schema": "aperture.author-lanes.v1"}))

    def test_new_suite_rejects_historical_round_numbers(self):
        with self.assertRaisesRegex(FAIR.FairPreparationError, "round 006"):
            FAIR.plan(5, self.root)

    def test_mutated_freeze_refuses_preparation_before_any_docker_operation(self):
        inputs = self.freeze()
        self.select()
        helper = FAIR.configured_helper(6, self.root, inputs=inputs)
        self.method["comparisonLimits"] += " changed during preparation"
        self.write_method()
        with patch.object(helper, "docker") as docker:
            with self.assertRaisesRegex(FAIR.FairPreparationError, "Frozen input hash/size"):
                helper.prepare(6, self.root / "validation.json", self.root / "producer.json")
        docker.assert_not_called()
        self.assertFalse(helper.paths(6)["public"].exists())

    def test_docker_image_verification_requires_the_exact_reviewed_id(self):
        inputs = self.freeze()
        self.select()
        helper = FAIR.configured_helper(6, self.root, inputs=inputs)
        with patch.object(helper, "run", return_value=(("sha256:" + "0" * 64).encode(), 0)):
            with self.assertRaisesRegex(FAIR.FairPreparationError, "root-reviewed pinned image"):
                helper.docker(["image", "inspect", "--format", "{{.Id}}", helper.IMAGE])
        with patch.object(helper, "run", return_value=(FAIR.EXPECTED_IMAGE_ID.encode(), 0)):
            raw, _ = helper.docker(["image", "inspect", "--format", "{{.Id}}", helper.IMAGE])
            self.assertEqual(raw.decode(), FAIR.EXPECTED_IMAGE_ID)

    def test_reference_policy_rejects_a_fixed_reference_in_the_method(self):
        self.method["referenceSha256"] = "0" * 64
        self.write_method()
        with self.assertRaisesRegex(FAIR.FairPreparationError, "not one fixed reference"):
            FAIR.load_inputs(self.root, require_frozen=False, contract=self.contract)

    def test_round_selection_is_create_only_and_rejects_any_reused_image(self):
        first = self.select(6)
        image, receipt = self.image(7, 10)
        with self.assertRaisesRegex(FAIR.FairPreparationError, "already selected"):
            FAIR.select_reference(7, image, receipt, root=self.root)
        with self.assertRaisesRegex(FAIR.FairPreparationError, "selection already exists"):
            FAIR.select_reference(6, image, receipt, root=self.root)
        second = self.select(7, 20)
        self.assertNotEqual(first["reference"]["sha256"], second["reference"]["sha256"])
        self.assertEqual(FAIR.load_inputs(self.root)["method"], self.method)

    def test_reference_selection_checks_generation_hash_and_actual_retained_source(self):
        self.freeze()
        image, receipt = self.image()
        data = json.loads(receipt.read_bytes())
        data["imageSha256"] = "0" * 64
        receipt.write_bytes(FAIR.json_bytes(data))
        with self.assertRaisesRegex(FAIR.FairPreparationError, "generation receipt"):
            FAIR.select_reference(6, image, receipt, root=self.root)
        image, receipt = self.image()
        FAIR.select_reference(6, image, receipt, root=self.root)
        image.write_bytes(image.read_bytes() + b"changed original")
        with self.assertRaisesRegex(FAIR.FairPreparationError, "Actual original returned PNG"):
            FAIR.load_reference(6, self.root)

    def test_reference_and_optional_task_brief_are_identical_for_both_lanes(self):
        self.freeze()
        brief = self.root / "task.txt"
        brief.write_text("Low-poly cream house, red gable roof, blue hatchback; match the image layout.\n")
        selection = self.select(6, 10, brief)
        helper = FAIR.configured_helper(6, self.root)
        self.assertEqual(selection["taskBrief"]["sha256"], FAIR.digest(brief.read_bytes()))
        for engine in ("three", "aperture"):
            public = helper.paths(6)["lanes"] / engine / "public"
            public.mkdir(parents=True)
            prompt = helper.prompt(engine, f"{engine}-r006", public, "Interface fixture")
            self.assertIn(brief.read_text(), prompt)
            self.assertEqual((public / "task-brief.txt").read_bytes(), brief.read_bytes())

    def test_preparation_consumes_exact_preselection_without_overwriting_or_regenerating(self):
        self.select()
        image = self.root / "generated-6-10.png"
        receipt = image.with_suffix(".json")
        selection_path = FAIR.round_reference_directory(6, self.root) / "reference-selection.json"
        before = selection_path.read_bytes()
        selection = FAIR.reference_for_preparation(6, image, receipt, root=self.root)
        self.assertEqual(selection_path.read_bytes(), before)
        self.assertEqual(selection["reference"]["sha256"], FAIR.digest(image.read_bytes()))
        changed_image, changed_receipt = self.image(6, 20)
        with self.assertRaisesRegex(FAIR.FairPreparationError, "already selected reference"):
            FAIR.reference_for_preparation(6, changed_image, changed_receipt, root=self.root)


class ExplicitAuthorConfigTests(unittest.TestCase):
    def test_cli_passes_explicit_config_and_keeps_the_old_default(self):
        with patch.object(LANE, "run", return_value=0) as run:
            self.assertEqual(LANE.main(["--config", "/unit/new-lanes.json", "three-r006", "start"]), 0)
            run.assert_called_once_with("three-r006", "start", None, config_path=Path("/unit/new-lanes.json"))
        with patch.object(LANE, "run", return_value=0) as run:
            self.assertEqual(LANE.main(["three-r006", "start"]), 0)
            run.assert_called_once_with("three-r006", "start", None, config_path=LANE.CONFIG)


if __name__ == "__main__":
    unittest.main()
