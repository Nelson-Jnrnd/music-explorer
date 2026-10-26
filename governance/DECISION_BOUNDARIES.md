# Decision authority

## Product Owner reserves

- Product purpose, target users, release scope and prioritization trade-offs.
- Material user-visible behavior, data/privacy posture, accessibility expectations and business rules where reasonable alternatives lead to different products.
- Platforms/business model if not already delegated, material budget/spending, third-party terms, public launch and irreversible external actions.
- Approval of substantial scope/contract changes, any explicitly required phase gate, and governance exceptions.

The Product Owner may **explicitly delegate** some decisions in `PROJECT.md` or an accepted decision record. Do not assume silence is approval.

## Agents decide locally

- Private implementation structure, method/class names, test design, refactoring and documentation presentation that preserve approved behavior/contracts.
- Routine error handling and accessibility/correctness improvements implied by approved requirements, where they do not create a material product trade-off.
- Issue decomposition, dependency handling and technical research within approved scope.
- Existing-stack tooling consistent with established project constraints.

Do not convert ordinary technical alternatives into owner questionnaires.

## Escalate when

- Multiple plausible choices materially affect visible behavior, costs, privacy, compatibility, accessibility, security, scope or delivery.
- Existing approved contracts, ownership boundaries or key design decisions must change.
- An absent critical requirement blocks correct implementation, or the task would require actions beyond available permissions.

Use `templates/DECISION.md`: concise A/B (C only if useful), plus recommendation; or one Approve/Reject proposal. State consequence in plain language before technical details. No implied approval. After a decision, update the canonical artifact and durable record in `docs/decisions/` (if materially reusable); link it in the issue/PR. Do not record incidental naming or internal refactoring decisions as project-wide decisions.
