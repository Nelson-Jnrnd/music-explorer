# Writing style

Applies to every piece of text an agent produces: product UI copy, documentation, issues, PR descriptions, commit messages, code comments, and messages to the Product Owner. Owner-facing reporting also follows `governance/USER_INTERACTION.md`; UI copy also follows `governance/UI_QUALITY.md`.

The goal is text a person would have written on purpose for a specific reader. Text that "reads like an LLM" is usually text with no specific reader and no specific claim.

## Method, not a banned-word list

Swapping flagged words for synonyms does not fix generic writing. Before writing, know three things: who reads this, what they should know or do afterwards, and the one specific fact worth saying. Then:

1. Lead with the point. No warm-up sentence, no restating the question.
2. Be specific. Prefer a name, number, file, state, or example over an adjective.
3. Cut anything you cannot attach a concrete claim to.
4. Stop when the content ends. No closing summary of what you just said, no offer of further help.
5. Re-read as the reader. Delete what they would skip.

## Patterns to remove

Adapted from Wikipedia's field guide [Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing). These are signals, not proof; one instance is fine, a cluster is a defect.

| Pattern | Example | Fix |
|---|---|---|
| Significance inflation | "a pivotal step in the evolution of..." | State what happened. |
| Promotional tone | "seamless, powerful, intuitive experience" | Say what it does. |
| Copula avoidance | "serves as", "boasts", "features" | "is", "has". |
| Negative parallelism | "It's not just a tracker, it's a platform" | Say the actual thing once. |
| Reflexive triads | "fast, reliable, and scalable" | Keep only the items that are true and matter. |
| Trailing analysis | "...highlighting its importance" | Delete the clause. |
| Vague attribution | "best practices suggest", "users often" | Name the source or drop it. |
| Elegant variation | cycling synonyms for one thing | Repeat the plain word. |
| Filler framing | "It's important to note", "In today's fast-paced world", "Let's dive in" | Delete. |
| Chatbot residue | "Certainly!", "I hope this helps", "As an AI" | Delete. |
| Self-summary | "In summary", a paragraph that restates the last one | Delete. |
| Hollow hedging | "may potentially help to some extent" | State the claim, or state the real uncertainty and its cause. |
| Stock vocabulary | delve, tapestry, landscape, leverage, robust, seamless, elevate, unlock, empower | Use the ordinary word. The list shifts over time; judge by vagueness, not by lookup. |

## Formatting restraint

- Prose by default. Use a list only for parallel items or steps, a table only for comparison across several attributes.
- Bold sparingly. No bolded-label-colon bullets as a house style for every list.
- Sentence case headings, one level-1 heading, no heading without content, no skipped levels.
- No emoji in docs or UI unless the project voice (below) says so. Use straight quotes consistently.
- Em dashes: use rarely. A comma, period, or parentheses usually reads better.
- Vary sentence length. A page of equal-length sentences reads as machine output.

## Honesty in text

- Never invent sources, quotes, statistics, testimonials, company names, or feature claims. Placeholder content must be visibly a placeholder and must not ship.
- Do not claim a thing works, was tested, or is approved unless that happened (see `AGENTS.md` rule 8). Say what you ran and what you did not.
- Remove leftover template text, bracketed prompts, `TODO` placeholders and tool artifacts before committing.

## Project voice

`PROJECT.md` has a **Voice and visual identity** entry. Writing for users follows it. If it is `TBD` and the work needs user-facing copy, use neutral, plain, literal wording and record "voice not yet decided" in the PR. Do not invent a brand personality; it is a Product Owner decision (`governance/DECISION_BOUNDARIES.md`).

## By text type

- **UI copy:** see `governance/UI_QUALITY.md`, section "Copy in the interface".
- **PR and issue text:** observable outcome first, then evidence. Template headings stay; filler sentences inside them go.
- **Commit messages:** imperative subject under about 70 characters saying what changed; body only for why.
- **Code comments:** explain why, a constraint, or a non-obvious trap. Do not narrate what the next line does, and do not leave comments about the editing process ("added", "refactored", "now uses").
- **Docs:** write for someone who has not seen the conversation that produced the change. Define terms where first used, link to the canonical owner instead of copying.

## Self-check before submitting

- Could the reader act on this without asking me anything?
- Is every adjective and every claim backed by something concrete?
- Did I delete the intro, the outro, and any sentence that only restates a neighbour?
- Would a colleague who writes plainly have put their name on it?
