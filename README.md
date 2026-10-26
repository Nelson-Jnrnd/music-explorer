# Vibe Coding Project Template

A reusable, domain- and stack-agnostic workspace for projects built with AI agents and a human Product Owner.

**Core principles:** bounded GitHub issues; one coordinator; explicit decision authority; durable project and decision records; separate author/reviewer roles; short-lived branches and PRs; reproducible validation; safe recovery after interrupted agent sessions. The workflow scales from a weekend prototype to a complex multi-agent project.

## Create a project

1. On GitHub, create a **private** repository using this repository's **Use this template** action. Alternatively, from an extracted archive with authenticated GitHub CLI run `python3 scripts/publish_private.py --repo OWNER/Vibe-Coding-Project-Template --apply` to create, push and mark a new **private** GitHub template repository automatically. If the source has not yet been marked as a GitHub template, the owner can enable **Settings → General → Template repository** first, or create a private repository and push these files.
2. Clone the new repository, then run:

   ```bash
   python3 scripts/bootstrap.py --name "My Project" --description "What it does" --mode standard --stack "Python, FastAPI"
   python3 scripts/validate_template.py
   ```

3. Read `PROJECT.md` and complete the human-reserved product choices. The bootstrap script fills in the project identity and writes a project-specific `README.md`; it does not generate application code or silently invent requirements.
4. Use `docs/STARTUP_WORKFLOW.md` to prepare the first three bounded issues, appoint a coordinator, and decide when implementation can begin.
5. Optionally run `python3 scripts/setup_github.py --dry-run` and, after inspection, `python3 scripts/setup_github.py --apply` to create standard labels and starter issues. This requires an authenticated `gh` CLI within an existing repository. The script never creates a repository or changes privacy settings.

Use **lightweight** mode for prototypes, **standard** for ordinary apps, **rigorous** for complex/high-risk projects. All modes preserve critical decision and recovery safeguards. See `governance/WORKFLOW.md` for the actual differences.

## Where to start

- `AGENTS.md` — first document for any agent.
- `PROJECT.md` — goals, boundaries, status and project choices.
- `governance/` — rules that apply to *how* agents work, including writing style, UI quality, generated visual assets and plain-language owner reporting.
- `.github/agents/` — six generic, explicitly selectable agent roles.
- `.github/ISSUE_TEMPLATE/` — bounded task, decision and defect issue forms.
- `docs/` — your emerging product, design, specification and decisions.
- `templates/` — reusable task, decision and component-contract formats.

Agent startup prompt:

```text
Work on <owner>/<repo> issue #<N>.
Read AGENTS.md, PROJECT.md, the applicable governance files, and the role file named in the issue.
Work only within the issue's scope and branch; keep the PR handoff current.
Persist meaningful decisions to the repository. Do not self-approve.
```

The `.github/agents/*.agent.md` definitions are **not automatically loaded in all chat environments**. Explicitly read the selected file. The connected GitHub integration or equivalent authorized tools are needed for remote edits; no role definition grants additional tool permissions.

## Maintenance

Governance is deliberately lightweight where practical; avoid copying domain-specific process into the core. If a recurring problem justifies a new rule, add the smallest broadly reusable rule, then update the validator and templates if appropriate. No product requirements, code, tech-stack defaults or secrets belong to this template.
