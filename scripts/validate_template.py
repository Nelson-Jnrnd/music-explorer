#!/usr/bin/env python3
"""Dependency-free static validator for template or bootstrapped project copies."""
from __future__ import annotations

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = [
    "README.md", "PROJECT.md", "AGENTS.md", ".gitignore", ".gitattributes",
    "docs/STARTUP_WORKFLOW.md", "docs/product/README.md",
    "docs/architecture/README.md", "docs/specifications/README.md",
    "docs/decisions/README.md",
    "governance/WORKFLOW.md", "governance/DECISION_BOUNDARIES.md",
    "governance/REVIEW_POLICY.md", "governance/USER_INTERACTION.md",
    "governance/HANDOFF_POLICY.md", "governance/ARTIFACT_RECOVERY.md",
    "governance/CONTRACTS.md", "governance/WRITING_STYLE.md", "governance/UI_QUALITY.md",
    "docs/product/GLOSSARY.md", "governance/GENERATED_ASSETS.md", "docs/design/README.md",
    "templates/ART_DIRECTION.md", "templates/ASSET_RECIPE.md",
    "templates/TASK.md", "templates/DECISION.md", "templates/CONTRACT.md",
    ".github/pull_request_template.md",
    ".github/ISSUE_TEMPLATE/task.yml",
    ".github/ISSUE_TEMPLATE/decision-request.yml",
    ".github/ISSUE_TEMPLATE/bug-report.yml",
    ".github/workflows/template-checks.yml",
    "scripts/bootstrap.py", "scripts/validate_template.py", "scripts/setup_github.py", "scripts/publish_private.py",
]
ROLES = ["coordinator", "product-analyst", "architect", "implementer", "reviewer", "verification"]


def main() -> int:
    issues: list[str] = []
    for rel in REQUIRED + [f".github/agents/{x}.agent.md" for x in ROLES]:
        p = ROOT / rel
        if not p.is_file():
            issues.append(f"Missing {rel}")
            continue
        try:
            txt = p.read_text(encoding="utf-8")
        except UnicodeError:
            issues.append(f"Not valid UTF-8: {rel}")
            continue
        if not txt.strip():
            issues.append(f"Empty {rel}")
        if rel.endswith(".agent.md"):
            if not txt.startswith("---\n") or f"name: {p.name.removesuffix('.agent.md')}" not in txt:
                issues.append(f"Invalid agent frontmatter: {rel}")
        if rel.startswith(".github/ISSUE_TEMPLATE/"):
            for key in ("name:", "description:", "title:", "body:"):
                if key not in txt:
                    issues.append(f"Missing YAML key {key} in {rel}")
    # Ensure every governance file linked by AGENTS exists.
    if (ROOT / "AGENTS.md").is_file():
        agents_txt = (ROOT / "AGENTS.md").read_text(encoding="utf-8")
        for name in [Path(x).name for x in REQUIRED if x.startswith("governance/")]:
            if name != "CONTRACTS.md" and name not in agents_txt:
                issues.append(f"AGENTS.md does not reference {name}")
    for file in ROOT.rglob("*"):
        if not file.is_file() or file.resolve() == Path(__file__).resolve() or ".git" in file.parts or "__pycache__" in file.parts:
            continue
        if file.suffix in {".md", ".yml", ".py"}:
            try:
                text = file.read_text(encoding="utf-8")
            except UnicodeError:
                continue
            if "data:image/" in text or "base64," in text:
                # Prohibition text can mention these markers, but full data URLs cannot.
                if "data:image/png;base64," in text or "data:image/jpeg;base64," in text:
                    issues.append(f"Embedded image data URL in {file.relative_to(ROOT)}")
    if issues:
        print("FAIL — template checks:\n" + "\n".join(f"  - {x}" for x in issues))
        return 1
    print(f"PASS — {len(REQUIRED)} core files and {len(ROLES)} agent roles present")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
