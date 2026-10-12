#!/usr/bin/env python3
"""After separate root approval, seal known controls with final author/readiness pins; never launch a trial."""
import argparse
import hashlib
import json
from pathlib import Path

def require(value, message):
    if not value: raise RuntimeError(message)
def read(path):
    path = Path(path)
    require(path.is_absolute() and path.resolve(strict=True) == path and path.is_file() and not path.is_symlink() and path.stat().st_mode & 0o222 == 0, "Readonly canonical regular input required")
    return path.read_bytes()
def pin(path):
    raw = read(path); return {"path": str(path), "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}
def verify(record):
    require(pin(record["path"]) == {key: record[key] for key in ("path", "bytes", "sha256")}, "Known frozen control pin changed: " + record["path"])

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--template", required=True, type=Path)
    parser.add_argument("--template-sha256", required=True)
    parser.add_argument("--post-author-review", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--post-author-review-sha256", required=True)
    args = parser.parse_args()
    raw = read(args.template)
    require(hashlib.sha256(raw).hexdigest() == args.template_sha256, "Exact reviewed template SHA differs")
    template = json.loads(raw)
    require(template["schema"] == "aperture.official-trial-control-template.v1" and template["round"] == "round-004", "Unexpected private template")
    plan = template["knownControlPlan"]
    require([(step["engine"], step["trial"]) for step in plan["steps"]] == [("aperture",1),("three",1),("three",2),("aperture",2),("aperture",3),("three",3)], "Exact even-round six-attempt order differs")
    for key in ("driver", "dispatchFreeze", "method", "preparation", "authorDispatch"): verify(plan[key])
    for source in plan["sourcePins"]:
        current = Path(source["path"]).read_bytes()
        require(len(current) == source["bytes"] and hashlib.sha256(current).hexdigest() == source["sha256"], "Active frozen control source changed")
        verify(source["survivingFrozenCopy"])
    review_pin = pin(args.post_author_review)
    require(review_pin["sha256"] == args.post_author_review_sha256, "Exact actual root post-author review hash differs")
    review = json.loads(read(args.post_author_review))
    require(review["schema"] == "aperture.root-post-author-readiness.v1" and review["round"] == "round-004" and review["reviewedBy"] == "/root" and review["status"] == "reviewed", "Actual root post-author readiness review missing")
    for key in ("finalAuthorAuditsReviewed", "noFurtherAuthorEdits", "previewCoordinatorExited", "lifecycleQuiescenceReviewed"): require(review.get(key) is True, "Unresolved post-author requirement: " + key)
    coordinator_pin = review["coordinatorResult"]; verify(coordinator_pin)
    coordinator = json.loads(read(coordinator_pin["path"]))
    require(coordinator.get("coordinatorExitCode") == 0, "Preview coordinator did not exit successfully")
    audits = {}; builds = {}
    checks = ("publicEventHashChain", "commandRecordAndOutputParity", "publicPromptAndReferencePins", "monotonicBudgetWaitAccounting", "finishedWorkspaceSourceHashes", "retainedCopiesReadBack")
    for engine, path in template["unresolved"]["authorAuditPaths"].items():
        audit_pin = pin(path); require(audit_pin == review["authorAudits"][engine], "Root reviewed a different final author audit")
        audit = json.loads(read(path))
        require(audit["schema"] == "aperture.author-audit.v1" and audit["status"] == "verified" and audit["engine"] == engine and audit["lane"] == engine + "-r004" and all(audit["verificationChecks"].get(key) is True for key in checks), "Final author audit incomplete")
        expected = Path(plan["roundRoot"]) / "author-audits" / (engine + "-r004")
        require(audit["retainedSourceRoot"] == str(expected / "source") and audit["retainedBuiltAppRoot"] == str(expected / "source/dist"), "Retained final build path differs")
        finish_raw = read(expected / "public-records/finish.json")
        require(hashlib.sha256(finish_raw).hexdigest() == audit["finishSha256"] and json.loads(finish_raw)["files"] == audit["sourceFiles"], "Final finish/source inventory join differs")
        audits[engine] = audit_pin
        builds[engine] = {"appRoot": audit["retainedBuiltAppRoot"], "finishSha256": audit["finishSha256"], "sourceFiles": audit["sourceFiles"], "validationScope": "Auditor copied/read-back exact bytes; official driver independently rechecks every retained source/dist byte before each trial."}
    plan["postAuthorReadiness"] = {"rootReview": review_pin, "coordinatorResult": coordinator_pin, "authorAudits": audits, "finalBuilds": builds}
    plan["templateProvenance"] = pin(args.template)
    plan["trialAuthorization"] = "Unresolved: a separate exact root aperture.official-trial-authorization.v1 and exclusive window are required. This materializer launches no jobs."
    require(args.output.is_absolute() and not args.output.exists(), "New absolute private plan output required")
    with args.output.open("xb") as stream: stream.write((json.dumps(plan, indent=2) + "\n").encode())
    args.output.chmod(0o444)
    print(json.dumps({"actualPrivateControlPlan": pin(args.output), "nativeLaunched": False, "rootTrialAuthorizationStillRequired": True}))
    return 0

if __name__ == "__main__": raise SystemExit(main())
