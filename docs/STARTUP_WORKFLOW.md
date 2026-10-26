# Startup workflow for a new project

This is the recommended sequence, not a promise that an agent can create resources without adequate tool permissions.

## Bootstrap

1. Create a private GitHub repository from this template, using GitHub's **Use this template** feature when enabled. Never assume copied repositories inherit the source privacy setting; verify the new repo is private.
2. Run `python3 scripts/bootstrap.py --name ... --description ... --mode ... --stack ...` and review `PROJECT.md`.
3. Have a Product Analyst (or Coordinator for a tiny project) define target user, problem, minimum useful outcome, constraints, explicit non-goals, material risks and open owner decisions. No speculative architecture is needed to write the product brief.
4. The owner approves or delegates material product choices; write durable records where they will constrain later work.
5. For standard/rigorous projects, choose the stack and major architecture boundary based on actual needs. Add app folders and relevant build/tests; do not copy another project's unrelated dependencies.

## Suggested first bounded Issues

- **BOOT-01 Product boundary:** establish who the product serves, what the first deliverable must do, non-goals, acceptance criteria and owner-decision list. Role: product-analyst. Output: `PROJECT.md` and `docs/product/BRIEF.md`.
- **BOOT-02 Technical foundation:** establish minimal runnable skeleton, reproducible install/build/test commands, and CI on the approved stack. Dependency: BOOT-01's platform/constraints decisions. Role: architect/implementer. Output: bootable code, documented commands, passing CI.
- **BOOT-03 First vertical slice:** deliver one user-observable end-to-end feature. Dependency: BOOT-02. Role: implementer. Output: working behavior, tests, reviewer evidence and demo.

In rigorous projects, add explicit domain contracts, reviewed design baseline, and owner implementation gate before BOOT-02 or before production implementation as appropriate. The coordinator should not arbitrarily implement undefined material product behavior.

Use `.github/ISSUE_TEMPLATE/task.yml` or copy `templates/TASK.md`. The coordinator owns status and dependency tracking in GitHub. For repeated setup, `scripts/setup_github.py` can create labels and the three proposed issues using an authenticated `gh` CLI (dry-run by default). Check its generated issue content before applying; the proposals are not approvals.

## Ready-to-work criterion

An issue has one observable outcome, stated scope and exclusions, upstream decisions, owner/paths, dependencies, acceptance commands/checks, role and risk tier. Required approvals and external inputs are available. A reviewer independent from the author can verify completion.

## Delivery rhythm

Open a draft PR after first push and keep Handoff current. Run the issue's tests, independent review, merge in dependency order, then show a stage demo when there is meaningful user-visible behavior. Record open questions and decisions durably so the next session can resume without chat history.
