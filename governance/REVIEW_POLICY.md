# Independent review policy

The author never approves their own substantive change. The reviewer is a different agent or human, evaluates only the issue's declared requirements and actual diff, and cannot silently alter the author's branch or product decisions.

## Review level

- **Routine:** concise checklist review of scope, tests, behavior, documentation, evidence, affected interfaces and handoff.
- **Full:** comprehensive review for security/privacy boundaries, financial/irreversible actions, persistence or data migration, authentication/authorization, concurrency, cross-component contracts, and other high-impact changes. Evaluate failure/recovery paths and negative tests.

Coordinator assigns risk in issue. Reviewer may raise, not lower, a risk tier. Automated checks are required at both tiers where available.

## Findings

- **Blocking:** acceptance cannot be met, contract/security invariant violated, major behavior undecided, or release-breaking regression.
- **Major:** material correctness/maintainability defect in declared scope.
- **Minor:** localized quality/clarity defect.
- **Observation:** optional future enhancement, not a blocker.

Each material finding should cite exact path/line or behavior, violated requirement, reproducible evidence where possible, and smallest effective fix.

## Bounded review cycle

1. Review 1 considers complete declared slice.
2. Author fixes accepted findings or explains a scope disagreement.
3. Review 2 checks finding closure, caused regressions and original criteria only.
4. If substantive blockers persist, coordinator revisits scope/approach or raises a decision; not another unlimited review by default.

A reviewer must not demand unrelated features, a different framework, or later-phase polish as a condition for passing current acceptance. For multi-issue stages, integration review tests merged components and contracts without redoing every internal task review.

Review verdict: `Approved`, `Changes required`, or `Blocked by Product Owner decision`, with Blocking/Major counts. **Review approval is distinct from Product Owner acceptance, merge, deployment and release.**
