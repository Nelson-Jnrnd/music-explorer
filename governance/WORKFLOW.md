# Project workflow

## Purpose and scope

Make projects understandable, buildable, and recoverable by multiple AI agents with minimal unnecessary oversight. Use GitHub Issues, PRs, labels and milestones as the work-status source of truth; use repository docs as the requirement and decision source of truth. Never copy the same roadmap/status into competing authoritative files.

## Modes

| Mode | Suitable for | Required planning and review |
|---|---|---|
| `lightweight` | Narrow experiment, small utility | Short product intent, one issue per feature, tests as appropriate, independent review before merge. Prototypes may use exploratory code to resolve uncertainty. |
| `standard` | Typical web/mobile/desktop app | Product boundary, major interfaces and architecture assumptions, dependency-scoped issues, CI and relevant tests, independent review. |
| `rigorous` | Complex domain, multiple contexts, sensitive migration or nontrivial simulation | Explicit product baseline, bounded domain/contract slices, integration gates, architecture and verification baselines, reviewed implementation plan and owner-authorized implementation gate. |

Rigor can increase as evidence demands it. No mode eliminates owner-reserved approvals, review independence, exact handoffs, or verification of claimed results.

## Work lifecycle

1. **Discover** — identify users, core outcome, constraints, non-goals, and uncertain consequential choices in `PROJECT.md`; ask the Product Owner only for reserved decisions.
2. **Shape** — separate testable outcomes from speculative detail. For each substantial feature, state observable behavior, ownership and dependencies. Rigorous projects first partition domain ownership and publish contracts.
3. **Plan** — create bounded GitHub issues using `.github/ISSUE_TEMPLATE/task.yml`; list required inputs, acceptance criteria, paths, risk tier, agent role, dependency issue numbers and exact checks. Create milestones for delivery stages where helpful.
4. **Ready check** — coordinator verifies prerequisites, upstream decisions, exclusive paths, scope, and available checks before work starts. Rigorous implementation also needs an explicit owner approval of the reviewed plan.
5. **Execute** — agent claims the issue, opens a short-lived branch and draft PR, edits within scope, records reproducible validation and checkpoints its handoff at every meaningful push.
6. **Review** — independent reviewer evaluates the bounded diff, acceptance and evidence. Rework only reported findings and direct regressions. Risk controls the depth, not reviewer independence.
7. **Integrate** — authorized coordinator merges after review and checks, respecting dependency order. For multiple coupled issues, check behavior across boundaries at the stage gate.
8. **Demonstrate** — show working behavior at stage completion; note limitations, what remains and whether release approval is a separate gate.

## Unknowns and boundaries

- **Current scope:** resolve within issue, or raise a blocked decision.
- **External owner:** specify needed input/output and canonical owner; create a dependency instead of taking over neighboring work.
- **Later phase:** record the target issue/milestone and continue without pretending it was decided.

Don't require database schemas or detailed APIs during early product discovery merely to make documents look complete. Conversely, don't start implementation when the issue depends on undefined critical behavior or a required gate.

## Parallel execution

Parallelize only independent, non-overlapping work with pinned upstream interfaces and a known merge order. Begin with one agent and expand as integration stays tractable; project capacity is not a fixed universal number. Avoid simultaneous edits to governance, shared root configuration and global contracts. The coordinator manages cross-task conflict and the dependency graph.

## Branch conventions

Use `feat/<issue>-<slug>`, `fix/<issue>-<slug>`, `spec/<issue>-<slug>`, `design/<issue>-<slug>`, `verify/<issue>-<slug>` or `infra/<issue>-<slug>`. Branch from current `main`; the PR identifies its issue (`Closes #N` when appropriate). Prefer squash-merge through GitHub after review so issue state matches the merged result.

## Stop rule for non-convergence

One full scoped independent review; one bounded re-review after corrections. If substantial blocking concerns remain, the coordinator must split, rescope, change approach, route a missing dependency, or escalate the real product decision before initiating another cycle. Never turn a bounded task into endless review-driven scope expansion.
