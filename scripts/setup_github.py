#!/usr/bin/env python3
"""Optional, idempotent GitHub labels/milestones/starter-issues setup via gh CLI.

Dry-run by default; does not create a repository or change GitHub privacy.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
LABELS = {
    "type:task": ("0366d6", "Bounded unit of work"),
    "type:decision": ("a371f7", "Product Owner or contract decision"),
    "type:bug": ("d73a4a", "Reproducible defect"),
    "status:backlog": ("ededed", "Work not ready"),
    "status:ready": ("c2e0c6", "Ready to claim"),
    "status:in-progress": ("fbca04", "Agent implementing"),
    "status:in-review": ("bfdadc", "Independent review"),
    "status:blocked": ("e99695", "Awaiting dependency or decision"),
    "tier:routine": ("c2e0c6", "Routine review risk"),
    "tier:full": ("d93f0b", "Thorough review required"),
}
MILESTONES = ["M0 Foundation", "M1 First vertical slice"]
ISSUES = [
    (
        "BOOT-01 Product boundary", "M0 Foundation",
        """**Outcome:** An approved product boundary, target user and minimal useful release.\n\n"""
        "**Role:** product-analyst; **branch:** spec/boot-01-product-boundary.\n"
        "**Scope:** Review PROJECT.md with the Product Owner and create docs/product/BRIEF.md.\n"
        "**Out of scope:** production code, speculative stack choices, unrelated features.\n"
        "**Dependencies:** none.\n"
        "**Acceptance:** users, problem, must-have outcome, non-goals, constraints, unresolved choices, and owner approval/record of reserved decisions.\n"
        "**Review:** different reviewer; routine tier.\n""",
    ),
    (
        "BOOT-02 Technical foundation", "M0 Foundation",
        """**Outcome:** Runnable minimal application/tool skeleton with documented install/build/test and CI.\n\n"""
        "**Role:** architect then implementer; **branch:** infra/boot-02-foundation.\n"
        "**Scope:** approved stack foundation, CI and reproducible smoke test.\n"
        "**Out of scope:** unrelated production features and unapproved stack selection.\n"
        "**Dependencies:** BOOT-01 constraints/platform approval.\n"
        "**Acceptance:** clean checkout builds/tests in documented environment, CI passes, independent reviewer validates.\n"
        "**Review:** full tier if sensitive dependencies or major platform constraints, otherwise routine.\n""",
    ),
    (
        "BOOT-03 First vertical slice", "M1 First vertical slice",
        """**Outcome:** One observable, end-to-end user function works, with tests and demo evidence.\n\n"""
        "**Role:** implementer; **branch:** feat/boot-03-first-slice.\n"
        "**Scope:** One bounded feature from the approved product brief, integrated in runnable skeleton.\n"
        "**Out of scope:** other features, speculative scale features and premature optimization.\n"
        "**Dependencies:** BOOT-01, BOOT-02, and any required product/architecture decisions.\n"
        "**Acceptance:** issue-specific behavior and negative cases defined before claiming; tests/CI and independent review; demo.\n"
        "**Review:** tier set by coordinator after behavior/risk are known.\n""",
    ),
]


def gh(*args: str) -> str:
    command = ["gh", *args]
    p = subprocess.run(command, cwd=ROOT, text=True, capture_output=True, check=False)
    if p.returncode:
        raise RuntimeError(f"{' '.join(command)} failed: {p.stderr.strip()[:400]}")
    return p.stdout.strip()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    exclusive = parser.add_mutually_exclusive_group()
    exclusive.add_argument("--apply", action="store_true", help="Perform changes after reviewing dry-run")
    exclusive.add_argument("--dry-run", action="store_true", help="Print intended setup (default)")
    parser.add_argument("--repo", help="GitHub owner/name (infer from git remote if applying)")
    args = parser.parse_args()
    repo = args.repo or "<current GitHub repository>"
    if not args.apply:
        print(f"DRY RUN — target: {repo}")
        print("Labels:", ", ".join(LABELS))
        print("Milestones:", ", ".join(MILESTONES))
        print("Starter issue titles:", ", ".join(x[0] for x in ISSUES))
        print("No repository, settings, issues or labels have been modified.")
        return 0
    if "<!-- TEMPLATE-UNINITIALIZED -->" in (ROOT / "PROJECT.md").read_text(encoding="utf-8"):
        print("Refusing setup: run scripts/bootstrap.py first, then approve the project identity.", file=sys.stderr)
        return 2
    if not shutil.which("gh"):
        print("Missing GitHub CLI ('gh'). Install and authenticate it first.", file=sys.stderr)
        return 2
    try:
        if not args.repo:
            repo = gh("repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner")
        if "/" not in repo or any(x in repo for x in (" ", "\n")):
            raise RuntimeError("Invalid repo owner/name")
        print(f"Setting up {repo} (no privacy/settings changes)")
        existing_labels = {x["name"] for x in json.loads(gh("label", "list", "--repo", repo, "--json", "name", "--limit", "200"))}
        for name, (color, desc) in LABELS.items():
            if name not in existing_labels:
                gh("label", "create", name, "--repo", repo, "--color", color, "--description", desc)
                print("Created label", name)
        existing_milestones = {x["title"] for x in json.loads(gh("api", f"repos/{repo}/milestones?state=all&per_page=100"))}
        for title in MILESTONES:
            if title not in existing_milestones:
                gh("api", f"repos/{repo}/milestones", "--method", "POST", "-f", f"title={title}")
                print("Created milestone", title)
        existing_titles = {x["title"] for x in json.loads(gh("issue", "list", "--repo", repo, "--state", "all", "--json", "title", "--limit", "500"))}
        for title, milestone, body in ISSUES:
            if title not in existing_titles:
                gh("issue", "create", "--repo", repo, "--title", title, "--body", body,
                   "--label", "type:task", "--label", "status:backlog", "--milestone", milestone)
                print("Created issue", title)
        print("Setup completed; verify issues and fill any missing requirements before task claims.")
        return 0
    except (RuntimeError, ValueError, KeyError, json.JSONDecodeError) as exc:
        print(f"Setup interrupted: {exc}", file=sys.stderr)
        print("Rerun after resolving; existing labels/milestones/issues are detected and skipped.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
