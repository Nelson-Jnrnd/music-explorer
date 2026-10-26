# Agent operating instructions

## Required startup

1. Read `PROJECT.md` and `governance/WORKFLOW.md` before modifying anything.
2. Read `governance/DECISION_BOUNDARIES.md`, `governance/REVIEW_POLICY.md`, `governance/USER_INTERACTION.md`, and `governance/HANDOFF_POLICY.md`.
3. Read `governance/ARTIFACT_RECOVERY.md` before creating, transferring or repairing multi-file/binary artifacts.
3a. Read `governance/WRITING_STYLE.md` before producing any text others will read. Read `governance/UI_QUALITY.md` before creating or changing anything a user sees, and `governance/GENERATED_ASSETS.md` before generating or drawing icons, logos, backgrounds, images or other visual assets.
4. Read the GitHub issue, upstream decisions/contracts linked by it, and the applicable `.github/agents/<role>.agent.md` file **explicitly**. Chat interfaces do not necessarily auto-activate custom roles.
5. If resuming, read the draft PR's Handoff, newest remote branch head, and current `main` governance before editing. GitHub is the durable state; chat history is not.

## Always applicable

1. One issue = one bounded, observable outcome. Obey in-scope, out-of-scope, owned paths, dependencies and acceptance checks.
2. Classify unknowns: **current-scope** (resolve or block), **external dependency** (name owner/contract; don't implement their work), **later** (record follow-up without expanding scope).
3. Human Product Owner decides product direction, user-visible trade-offs, delivery ambition, privacy, spending, external publication and governance exceptions. Agents make delegated local choices; do not ask for routine preferences.
4. A chat approval is not the durable source. Update canonical artifacts and `docs/decisions/` for consequential reusable decisions.
5. One concept, interface or policy has one canonical owning artifact. Consumers cite it instead of duplicating it.
6. Use short-lived branches and PRs for ordinary work. Don't push directly to `main` except explicitly authorized bootstrap/governance maintenance.
7. The author does not approve their own substantive work. A separate reviewer must establish acceptance within the issue boundary. Only the authorized merger merges.
8. Include actual test/validation command results and limitations. Don't claim checks ran when they did not.
9. Commit/push after each coherent checkpoint and update PR Handoff. Preserve successfully committed work after failures; verify before retries.
10. Avoid overlapping write ownership across parallel tasks. Coordinate dependencies, merge order and shared files before launching agents.
11. Do not fabricate task success, tool availability, repository permissions, asset provenance, or product approval. Escalate material blockers promptly.
12. Write plainly and specifically (`governance/WRITING_STYLE.md`); report to the Product Owner without project jargon (`governance/USER_INTERACTION.md`); do not ship generic-looking or inaccessible UI (`governance/UI_QUALITY.md`).
13. Follow the project's selected `mode` in `PROJECT.md`. Mode adjusts paperwork/review depth, not permission, safety, truthfulness or recovery rules.

## Work completion

Work is finished only when the issue acceptance criteria are met, required checks are documented, independent review requirements are satisfied, the PR is merged by an authorized actor, and the issue is closed or explicitly handed off. Distinguish **implemented**, **reviewed**, **approved**, **merged**, and **released**.

If the current session cannot complete work, leave a committed checkpoint plus a concise PR handoff with exact next action. Never silently promise background progress.
