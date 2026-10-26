#!/usr/bin/env python3
"""Create and push a NEW private GitHub template repo using authenticated gh/git.

This script is intended for the user's computer, not required for project bootstrapping.
No network mutations without --apply; refuses pre-existing local Git repositories.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
VALID = re.compile(r"^[A-Za-z0-9-]+/[A-Za-z0-9_.-]+$")


def run(command: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    p = subprocess.run(command, cwd=ROOT, text=True, capture_output=True, check=False)
    if check and p.returncode:
        raise RuntimeError(f"Command failed: {' '.join(command)}\n{p.stderr.strip()[:500]}")
    return p


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", required=True, help="New owner/repo, e.g. YOURNAME/Vibe-Coding-Project-Template")
    parser.add_argument("--apply", action="store_true", help="Actually create/push and mark as template")
    args = parser.parse_args()
    if not VALID.fullmatch(args.repo):
        parser.error("--repo must be in GitHub owner/name form")
    if not args.apply:
        print(f"DRY RUN: create private GitHub repo {args.repo}, push all template files on main, mark is_template=true")
        print("Requires authenticated gh CLI and git commit identity; will refuse an existing repository.")
        return 0
    if (ROOT / ".git").exists():
        print("Refusing: local .git exists; publish from a fresh extracted archive to avoid altering history.", file=sys.stderr)
        return 2
    for exe in ("gh", "git"):
        if not shutil.which(exe):
            print(f"Missing {exe} executable.", file=sys.stderr)
            return 2
    try:
        run(["gh", "auth", "status"])
        found = run(["gh", "api", f"repos/{args.repo}"], check=False)
        if found.returncode == 0:
            print("Refusing: target GitHub repository already exists; no overwrite attempted.", file=sys.stderr)
            return 2
        run(["python3", "scripts/validate_template.py"])
        run(["git", "init", "-b", "main"])
        run(["git", "add", "--all"])
        run(["git", "commit", "-m", "Initialize reusable AI-agent project template"])
        # gh repo create honors --private, --source and --push. Do not create public repos.
        run(["gh", "repo", "create", args.repo, "--private", "--source", ".", "--remote", "origin", "--push"])
        run(["gh", "api", "--method", "PATCH", f"repos/{args.repo}", "-F", "is_template=true"])
        got = json.loads(run(["gh", "api", f"repos/{args.repo}"]).stdout)
        if got.get("private") is not True or got.get("is_template") is not True:
            print("Repo created, but privacy/template setting was not verified. Check GitHub settings now.", file=sys.stderr)
            return 1
        print(f"SUCCESS: https://github.com/{args.repo} is private and is marked as a GitHub template.")
        return 0
    except (RuntimeError, ValueError, json.JSONDecodeError) as e:
        print(str(e), file=sys.stderr)
        print("If a repository was created, inspect its remote status before retrying; do not repeat blindly.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
