# Component ownership and contracts (use where complexity warrants)

Use one authoritative source for each business concept, policy, data shape, and component responsibility. Other components consume a declared contract rather than independently redefining its meaning.

A contract identifies provider and consumer, purpose, inputs/outputs or events, guarantees, ordering/units/identity rules where relevant, explicit non-responsibilities, owners and change impact. Use `templates/CONTRACT.md`.

In rigorous mode, establish context boundaries during product/domain analysis before issuing parallel architecture/implementation tasks. In standard mode, use contracts for cross-module boundaries where incompatible assumptions are likely. Lightweight projects need not invent contract files for private functions.

Approved contracts are change-controlled: propose a scoped impact assessment and update affected tests/docs before changing behavior. Cross-component integration reviews check contracts rather than reopening entire component implementations.
