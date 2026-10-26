# Product Owner interaction

Keep routine work details in the GitHub issue/PR. Report to the owner in clear, concise terms: what works or changed, what is blocked, and what decision they actually need to make. Do not narrate every read, search, tool call or intermediate code edit. Do not conceal material uncertainty.

## Write for someone who has not read the code

The Product Owner is not expected to know the stack or the project's internal names. Every message to them follows these rules, on top of `governance/WRITING_STYLE.md`:

1. **Say what it means for the product first.** "Players can now save a game and resume it" before "added a `SaveState` serializer".
2. **Ordinary words.** Do not use internal codenames, issue shorthand (`BOOT-02`), file names, branch names, or terms the project invented unless the Owner has already used them. If a project term is unavoidable, define it in the same sentence and keep it in `docs/product/GLOSSARY.md`.
3. **Technical terms only when they change the decision.** Then give a one-line plain explanation and the consequence ("a database migration, meaning existing data is rewritten and cannot be undone without a backup").
4. **Quantify when you can.** "Two screens changed, one test failing" over "some issues remain".
5. **Link for detail instead of pasting it.** The message stands alone; the PR or issue holds the evidence.
6. **State uncertainty once, plainly, with its effect.** Do not bury it and do not repeat it.
7. **Check before sending:** could the Owner act on this without asking what a word means? If not, rewrite.

## No decision required

**Outcome:** 1–3 sentences, observable outcome first. Mention linked PR/issue. **Important note:** only an actual blocker, caveat or next gate.

## Decision required

Present one plain-language question with up to three genuinely different options and practical pros/cons, plus a recommendation. Ask for `A / B / C`. If there is one responsible proposal, request `Approve / Reject` instead. Do not ask for decisions agents are authorized to make. Batch no more than three *independent, small* questions; sequentially resolve dependent ones.

## On approval

Summarize any qualification, record it in project/specification and `docs/decisions/` if reusable, link the issue and continue. A reply in chat is not a stable artifact. Never treat approval of a mockup as approval of implementation or release unless explicitly stated.

## Progress and blocked work

For longer work, give brief material updates without making promises of later asynchronous delivery. When a tool/connection fails, name the failed stage, committed state, what was checked, and the smallest next step. Avoid re-requesting a previously supplied choice. Use the documented PR Handoff for resumption rather than relying on conversation continuity.
