#!/usr/bin/env python3
"""Initialize a copy of this template without generating speculative product requirements."""
from __future__ import annotations

import argparse
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]


def require_plain(value: str, name: str) -> str:
    value = value.strip()
    if not value or "\n" in value or "\r" in value:
        raise ValueError(f"{name} must be one non-empty line")
    return value


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--name", required=True, help="Project name")
    parser.add_argument("--description", required=True, help="One-line purpose")
    parser.add_argument("--mode", choices=("lightweight", "standard", "rigorous"), default="standard")
    parser.add_argument("--stack", default="Undecided", help="Approved stack, or Undecided")
    parser.add_argument("--owner", default="To assign", help="Human Product Owner name or team")
    args = parser.parse_args()
    try:
        name, description, stack, owner = (
            require_plain(x, label) for x, label in (
                (args.name, "name"), (args.description, "description"),
                (args.stack, "stack"), (args.owner, "owner"),
            )
        )
    except ValueError as exc:
        parser.error(str(exc))

    project_path = ROOT / "PROJECT.md"
    if "<!-- TEMPLATE-UNINITIALIZED -->" not in project_path.read_text(encoding="utf-8"):
        print("PROJECT.md has already been initialized. Refusing to overwrite it.", file=sys.stderr)
        return 2

    project_doc = f"""# {name} — Project identity

## Purpose and outcome

- **Description:** {description}
- **Intended users:** TBD — Product Owner decision
- **Problem and expected value:** TBD — discovery
- **First useful release / measurable success:** TBD — Product Owner decision
- **Explicit non-goals:** TBD
- **Constraints (platform, legal, privacy, budget, accessibility):** TBD — confirm as relevant
- **Voice and visual identity (tone of text, look and feel, any brand assets):** TBD — Product Owner decision; until set, agents use neutral plain wording and the existing/minimal design tokens (`governance/WRITING_STYLE.md`, `governance/UI_QUALITY.md`)

## Execution defaults

- **Workflow mode:** `{args.mode}`
- **Selected stack:** {stack}
- **Product Owner:** {owner}
- **Coordinator:** To assign
- **Current phase:** Discovery
- **Next human gate/decision:** Approve product boundary and delegated technical choices
- **Status source of truth:** GitHub Issues, PRs, labels, milestones
- **Agent entry point:** `AGENTS.md`

## Owner-approved direction

No unreviewed proposals are approved by this generated file. Record accepted choices
in this section and, where they constrain later work, `docs/decisions/`.

## Initial execution plan

Follow `docs/STARTUP_WORKFLOW.md` and create bounded Issues for product
boundary, technical foundation, and first vertical feature. Work begins only
when the relevant issue satisfies `governance/WORKFLOW.md`'s ready check.
"""

    readme = f"""# {name}

{description}

This project uses an agent coordination framework with durable GitHub issues,
explicit owner decisions, separate implementation and review, and restart-safe PR handoffs.

## Current project state

- **Workflow mode:** `{args.mode}`
- **Stack:** {stack}
- **Phase:** Discovery (not a claim that development has started)

Read `PROJECT.md` for the authoritative product identity, `AGENTS.md` for agent
instructions, and `docs/STARTUP_WORKFLOW.md` for initial task sequencing.
Project requirements and acceptance criteria must be established before claiming
that the first release is specified.

## Development

Document the real install/build/test commands after BOOT-02 establishes the
technical foundation. Do not run guessed commands against an unknown stack.
"""

    # Last-moment checks before either write; this is intentionally one-shot.
    if not (ROOT / "AGENTS.md").exists():
        print("Not a recognizable template copy (AGENTS.md missing)", file=sys.stderr)
        return 2
    project_path.write_text(project_doc, encoding="utf-8")
    (ROOT / "README.md").write_text(readme, encoding="utf-8")
    print(f"Initialized {name!r} in {ROOT}")
    print("Next: review PROJECT.md, then follow docs/STARTUP_WORKFLOW.md")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
