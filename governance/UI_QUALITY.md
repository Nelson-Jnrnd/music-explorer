# User interface quality

Applies to any task that creates or changes something a user sees: web, mobile, desktop, CLI output, emails. It sets a floor; it does not replace the Product Owner's decisions on look, feel and behavior (`governance/DECISION_BOUNDARIES.md`).

## What to avoid: generic "AI default" output

Models converge on the same safe choices, so unreviewed output looks interchangeable. These are defaults to question, not bans; each is acceptable when it was chosen for this product.

| Default | Why it reads as generated | Instead |
|---|---|---|
| Purple-to-blue gradients, glowing shadows, blurred gradient blobs behind a hero | Decoration with no meaning | Define colors by function (primary action, warning, success). One committed brand color plus neutrals. |
| System sans or Inter/Roboto/Arial everywhere with one weight | No hierarchy or character | Choose type deliberately: a body face for reading, optionally a distinct display face, with clear size and weight contrast. |
| Identical rounded cards, same radius, same height, in a grid of three with an icon each | Layout chosen for ease, not for content | Let importance set size and position. Use cards only when items are separate objects. |
| Colored left border on every panel; emoji or icon as bullet decoration | Template look | Use structure and spacing. Icons only where they add meaning. |
| Hero, three features, testimonials, pricing, footer, regardless of product | Page skeleton unrelated to the user's task | Design from the user's main task and journey. |
| Generic headline and button copy ("Unlock your potential", "Get started") | Could belong to any product | Specific language a real person on the team would say. |
| Everything on one screen at once | No decision about priority | Progressive disclosure: show what the current step needs. |
| Same fade-in on everything, or no state feedback at all | Decorative motion, missing functional motion | Motion that confirms an action or explains a change. Respect reduced-motion settings. |
| Fake data: "John Doe", "Acme Inc.", round numbers, invented testimonials and logos | Signals unfinished or fabricated | Realistic, project-relevant sample data, labelled as sample. Never fabricate endorsements or metrics. |

Reference points: community catalogs of "AI slop" patterns and designer write-ups such as [Spot the slop](https://world.hey.com/kostac/spot-the-slop-a-ui-designer-s-guide-to-fixing-ai-defaults-4c448c9c). The lasting test is whether someone would guess at a glance that no one made decisions here.

## Icons, images and backgrounds

Do not improvise these. Imagery that is generated or drawn follows `governance/GENERATED_ASSETS.md` and the project's `docs/design/ART_DIRECTION.md`: precise things (UI icons, logos, maps) are built as SVG, pictures are generated from frozen recipes, and the Product Owner accepts the result visually. Use one icon set with consistent stroke and size; do not mix sets or use emoji as icons.

## Use what the project already has

1. Existing design system, tokens, components and patterns in the repo come first. Do not introduce a second set of colors, spacings or button styles.
2. If none exists and the task is the first UI, create the smallest token set (color roles, type scale, spacing scale, radius) and record it in the PR so later work reuses it. A visual identity choice that changes the product's character goes to the Product Owner.
3. Platform conventions beat novelty (native controls, standard navigation, familiar form behavior) unless a decision says otherwise.

## States are part of the feature

Every screen or component that loads or changes data needs designed, implemented and tested:

- **Empty:** say what belongs here and offer the next action.
- **Loading:** show progress that does not shift the layout.
- **Error:** plain language, what happened, what to do, keep the user's input.
- **Partial and long content:** very long names, many items, missing optional fields.
- **Disabled and success:** make clear why something is disabled; confirm completed actions.

## Copy in the interface

Follow `governance/WRITING_STYLE.md` plus:

- Buttons name the outcome: "Save changes", "Delete project", not "Submit", "OK", "Click here".
- Error messages say what went wrong and how to fix it, next to the field concerned, without blaming the user.
- Use one word per concept everywhere in the UI. Use the user's words, not internal names.
- No exclamation marks or cheerfulness as a default. No lorem ipsum or placeholder text shipped.
- Keep labels visible (placeholder text is not a label). Dates, numbers and units in the user's locale.

## Accessibility floor

This is routine correctness under `governance/DECISION_BOUNDARIES.md`; a stricter target (such as WCAG 2.2 AA or AAA) is the Product Owner's call and lives in `PROJECT.md`. Unless stated otherwise, aim for WCAG 2.2 AA:

- Text contrast at least 4.5:1 (3:1 for large text and UI boundaries), in light and dark themes if both exist.
- Everything operable by keyboard, with a visible focus indicator and a logical order.
- Semantic elements first (button, link, heading, label); ARIA only to fill real gaps.
- Meaning never conveyed by color alone. Alternative text for informative images.
- Targets large enough to tap; layout works at narrow widths and 200% zoom without horizontal scrolling.

## Evidence required

Reading the code is not a review of a UI. For UI changes, the PR must show that the result was looked at:

- Screenshots or a short recording of the changed screens at narrow and wide widths, and of the empty, error and loading states, when the environment can run the app. If it cannot, say so under Validation instead of implying it was checked.
- Result of any available automated accessibility check, and a keyboard-only pass over the main flow.
- Note which existing components and tokens were reused and what was newly introduced.

The reviewer opens the same screens rather than relying on the author's description.
