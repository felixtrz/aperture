"""Private unintegrated capacity arithmetic. No filesystem/process/retirement I/O.

All byte figures are additional growth after a separately pinned observation.
This is an operational admission budget, never benchmark scoring or a guarantee
against writers that do not honor the frozen cooperative capacity policy.
"""
from dataclasses import dataclass
from typing import Optional

SCHEMA = "aperture.runtime-capacity-admission.v1"
FLOOR_BYTES = 2 * 1024**3
CHROMIUM_BYTES = 209022176
PRESSURE_TARGET_BYTES = 8 * 1024**3
MAX_RETIREMENTS_PER_OPERATION = 40
MAX_BYTES = 2**63 - 1
KNOWN_BASES = frozenset(("verified-exact", "enforced-upper-bound", "declared-reserve"))


def require(ok, message):
    if not ok:
        raise ValueError(message)


def nonnegative(value, field):
    require(type(value) is int and 0 <= value <= MAX_BYTES, field + " must be a bounded nonnegative integer")
    return value


def add(left, right):
    value = nonnegative(left, "left") + nonnegative(right, "right")
    return nonnegative(value, "byte sum")


@dataclass(frozen=True)
class Growth:
    label: str
    bytes: Optional[int]
    files: int
    basis: str
    reference: str

    def validate(self):
        require(isinstance(self.label, str) and 0 < len(self.label) <= 160, "growth label required")
        require(self.basis in KNOWN_BASES or self.basis == "unbudgeted", "unknown growth basis")
        require(isinstance(self.reference, str) and 0 < len(self.reference) <= 4096, "source/assumption reference required")
        nonnegative(self.files, "file count")
        if self.basis == "unbudgeted":
            require(self.bytes is None, "unbudgeted growth must have unknown bytes")
        else:
            nonnegative(self.bytes, self.label)

    def allocated(self, block_bytes):
        self.validate()
        require(self.bytes is not None, "unknown growth cannot be treated as zero")
        nonnegative(block_bytes, "filesystem block bytes")
        require(block_bytes > 0, "positive allocation unit required")
        # Sum of per-file rounded allocations is bounded by aggregate bytes plus
        # one allocation unit less one for each file. Metadata is a separate term.
        return add(self.bytes, nonnegative(self.files * (block_bytes - 1), "allocation padding"))


@dataclass(frozen=True)
class Job:
    job_id: str
    retained: tuple[Growth, ...]
    peak_only: tuple[Growth, ...]
    creates_pinned_chromium: bool = True

    def validate(self):
        require(isinstance(self.job_id, str) and 0 < len(self.job_id) <= 200, "job identity required")
        require(type(self.creates_pinned_chromium) is bool, "explicit Chromium allocation flag required")
        for value in (*self.retained, *self.peak_only):
            value.validate()


def budget(free_bytes, block_bytes, jobs, phase_growth, acknowledge_declared_reserves=False):
    """Conservative complete-phase admission. Credit NO prospective reclamation.

Per-job transient peaks use max because the policy must serialize jobs. Retained
growth accumulates. All newly created Chromium caches are budgeted even with an
automatic pressure policy, because a dry-run proposal is not actual freed space.
Recompute after observed retirement; exhausted 8-GiB targets are ordinary inputs.
"""
    nonnegative(free_bytes, "observed free bytes")
    nonnegative(block_bytes, "filesystem allocation unit")
    require(block_bytes > 0, "positive allocation unit required")
    require(type(acknowledge_declared_reserves) is bool, "explicit reserve acknowledgement required")
    require(0 < len(jobs) <= 4096, "bounded nonempty serialized job schedule required")
    require(len({job.job_id for job in jobs}) == len(jobs), "duplicate scheduled job identity")
    terms = list(phase_growth)
    for job in jobs:
        job.validate()
        terms.extend(job.retained)
        terms.extend(job.peak_only)
    for value in terms:
        value.validate()
    unbudgeted = sorted({value.label for value in terms if value.bytes is None})
    reserves = sorted({value.label for value in terms if value.basis == "declared-reserve"})
    result = {"schema": SCHEMA, "floorBytes": FLOOR_BYTES, "observedFreeBytes": free_bytes,
              "pressureTargetBytes": PRESSURE_TARGET_BYTES, "scheduledJobs": len(jobs),
              "prospectiveRetirementCreditBytes": 0, "unbudgetedGrowth": unbudgeted,
              "declaredReserves": reserves, "requiredFreeBytes": None,
              "scope": "Cooperative serialized scheduled writers; ungoverned writes can invalidate admission."}
    if unbudgeted:
        return {**result, "status": "blocked-unbudgeted-growth"}
    retained = 0
    for value in phase_growth:
        retained = add(retained, value.allocated(block_bytes))
    peak = 0
    cache_count = 0
    for job in jobs:
        for value in job.retained:
            retained = add(retained, value.allocated(block_bytes))
        job_peak = 0
        for value in job.peak_only:
            job_peak = add(job_peak, value.allocated(block_bytes))
        peak = max(peak, job_peak)
        cache_count += int(job.creates_pinned_chromium)
    cache_growth = Growth("new pinned Chromium caches", cache_count * CHROMIUM_BYTES,
                          cache_count, "verified-exact", "Approved decompressed runtime pin; actual allocation may be lower.").allocated(block_bytes)
    required = add(add(add(FLOOR_BYTES, retained), peak), cache_growth)
    result.update(requiredFreeBytes=required, retainedGrowthBytes=retained,
                  serializedPeakOnlyBytes=peak, newChromiumCacheCount=cache_count,
                  newChromiumCacheGrowthBytes=cache_growth,
                  deficitBytes=max(0, required - free_bytes))
    if reserves and not acknowledge_declared_reserves:
        return {**result, "status": "blocked-unacknowledged-reserves"}
    if free_bytes < required:
        return {**result, "status": "blocked-insufficient-capacity"}
    return {**result, "status": "admissible-under-declared-reserves" if reserves else "admissible-for-bounded-scheduled-growth"}


def retirement_projection(free_bytes, validated_candidate_count):
    """A read-only logical upper bound, NEVER an admission/reclamation receipt."""
    nonnegative(free_bytes, "free bytes")
    require(type(validated_candidate_count) is int and 0 <= validated_candidate_count <= MAX_RETIREMENTS_PER_OPERATION,
            "only an exact bounded validated plan count is accepted")
    bytes_selected = validated_candidate_count * CHROMIUM_BYTES
    # The helper stops after the first cache that makes observed free >=8 GiB.
    # This arithmetic ignores open-file/filesystem effects; only apply's subsequent
    # statvfs plus independent receipts can establish actual reclaim/free bytes.
    needed = max(0, PRESSURE_TARGET_BYTES - free_bytes)
    maximum_selected = min(validated_candidate_count, (needed + CHROMIUM_BYTES - 1) // CHROMIUM_BYTES)
    return {"status": "proposal-only-not-freed-space", "selectedCandidates": validated_candidate_count,
            "selectedLogicalBytes": bytes_selected, "maximumRetirementsToTarget": maximum_selected,
            "targetAttainableByLogicalSize": free_bytes + bytes_selected >= PRESSURE_TARGET_BYTES,
            "logicalFreeUpperBoundAfterApply": free_bytes + maximum_selected * CHROMIUM_BYTES}
