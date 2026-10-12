"""Private focused regression sources, intentionally NOT executed during R004."""
import unittest
from capacity_budget import CHROMIUM_BYTES, FLOOR_BYTES, PRESSURE_TARGET_BYTES, Growth, Job, budget, retirement_projection


def growth(label, size, basis="enforced-upper-bound", files=0):
    return Growth(label, size, files, basis, "Synthetic pure arithmetic fixture")


class CapacityBudgetTests(unittest.TestCase):
    def test_floor_only_is_not_capacity_for_one_browser(self):
        value = budget(FLOOR_BYTES, 4096, [Job("preview", (), ())], ())
        self.assertEqual(value["status"], "blocked-insufficient-capacity")
        self.assertEqual(value["deficitBytes"], CHROMIUM_BYTES + 4095)

    def test_exact_boundary_includes_all_future_retention_and_serial_peak(self):
        jobs = [Job("first", (growth("first output", 100),), (growth("first peak", 70),)),
                Job("second", (growth("second output", 200),), (growth("second peak", 80),))]
        required = FLOOR_BYTES + 300 + 80 + 2 * CHROMIUM_BYTES
        value = budget(required, 1, jobs, ())
        self.assertEqual(value["status"], "admissible-for-bounded-scheduled-growth")
        self.assertEqual(value["requiredFreeBytes"], required)
        self.assertEqual(value["serializedPeakOnlyBytes"], 80)
        self.assertEqual(budget(required - 1, 1, jobs, ())["status"], "blocked-insufficient-capacity")

    def test_already_occupied_bytes_are_not_reintroduced(self):
        value = budget(FLOOR_BYTES + 13, 1, [Job("already-built", (growth("future copy", 13),), (), False)], ())
        self.assertEqual(value["requiredFreeBytes"], FLOOR_BYTES + 13)

    def test_unknown_author_growth_cannot_be_zero(self):
        value = budget(100 * 1024**3, 4096, [Job("preview", (), ())],
                       [growth("future author writes", None, "unbudgeted")], True)
        self.assertEqual(value["status"], "blocked-unbudgeted-growth")
        self.assertIsNone(value["requiredFreeBytes"])

    def test_declared_workspace_reserve_requires_acknowledgement_and_keeps_limit_explicit(self):
        args = (20 * 1024**3, 4096, [Job("preview", (), ())], [growth("author workspace growth", 1024**3, "declared-reserve")])
        self.assertEqual(budget(*args)["status"], "blocked-unacknowledged-reserves")
        self.assertEqual(budget(*args, True)["status"], "admissible-under-declared-reserves")
        self.assertIn("ungoverned", budget(*args, True)["scope"])

    def test_eight_gib_is_not_a_hardcoded_admission_threshold(self):
        value = budget(PRESSURE_TARGET_BYTES, 1, [Job("large-evidence", (growth("permanent evidence", 7 * 1024**3),), (), False)], ())
        self.assertEqual(value["status"], "blocked-insufficient-capacity")
        self.assertEqual(value["requiredFreeBytes"], 9 * 1024**3)

    def test_proposed_cache_reclaim_is_never_credited(self):
        proposal = retirement_projection(FLOOR_BYTES, 14)
        self.assertFalse(proposal["targetAttainableByLogicalSize"])
        self.assertEqual(proposal["maximumRetirementsToTarget"], 14)
        value = budget(FLOOR_BYTES, 1, [Job("preview", (), ())], ())
        self.assertEqual(value["prospectiveRetirementCreditBytes"], 0)
        self.assertEqual(value["status"], "blocked-insufficient-capacity")

    def test_retirement_stops_at_fixed_target_not_all_candidates(self):
        value = retirement_projection(PRESSURE_TARGET_BYTES - 2 * CHROMIUM_BYTES + 1, 40)
        self.assertEqual(value["maximumRetirementsToTarget"], 2)
        self.assertEqual(retirement_projection(PRESSURE_TARGET_BYTES, 40)["maximumRetirementsToTarget"], 0)

    def test_rounding_pads_each_file(self):
        value = budget(20 * 1024**3, 4096, [Job("small-files", (growth("files", 2, files=2),), (), False)], ())
        self.assertEqual(value["retainedGrowthBytes"], 8192)

    def test_bool_negative_float_and_overflow_are_rejected(self):
        for size in (True, -1, 1.5, 2**63):
            with self.subTest(size=size), self.assertRaises(ValueError):
                budget(20 * 1024**3, 1, [Job("bad", (growth("bad", size),), (), False)], ())
        with self.assertRaises(ValueError):
            budget(20 * 1024**3, 1, [Job("overflow", (growth("first", 2**63 - 1), growth("second", 1)), (), False)], ())

    def test_duplicate_job_ids_and_unbounded_retirement_counts_rejected(self):
        with self.assertRaises(ValueError):
            budget(20 * 1024**3, 1, [Job("same", (), ()), Job("same", (), ())], ())
        for count in (-1, 41, True):
            with self.subTest(count=count), self.assertRaises(ValueError):
                retirement_projection(FLOOR_BYTES, count)


if __name__ == "__main__":
    unittest.main()
