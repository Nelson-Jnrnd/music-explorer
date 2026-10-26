# Asset family recipe — <family>, revision <n>

Frozen before generation. Any change makes a new revision and, for a new tool, model or reference, a new small proof (`governance/GENERATED_ASSETS.md` §3). Store beside the assets, with the run log.

- **Art direction revision:** <link / commit>
- **Slot(s) and display size:** ...
- **Method:** generate / SVG / generate then redraw
- **Tool and exposed controls:** <tool>; model: not exposed | <value>; seed: not exposed | <value>
- **Family master (reference):** <path> sha256 `...`
- **Reference roles (ordered):** 1. <path> sha256 `...` — edit target | geometry/identity | style

## Prompt

Prefix: <copied exactly from ART_DIRECTION>

Body (variables in braces): ...

Negative list: <copied exactly>

## Permitted variables

| Variable | Source (who supplies it) | Allowed values |
|---|---|---|
| ... | ... | ... |

## Framing and output

Camera / crop / backdrop / lighting; transparency; output size and mode.

## Export recipe

Crop and fit rule, target sizes, dependency versions, command. Scripted, deterministic.

## Run log (one entry per request)

```json
{
  "run": "<family>-<nnn>",
  "recipe_revision": 1,
  "resolved_prompt": "...",
  "references": [{"path": "...", "sha256": "...", "role": "style"}],
  "tool_controls": {"model": "not exposed", "seed": "not exposed"},
  "output": {"file": "...", "width": 0, "height": 0, "mode": "RGBA", "sha256": "..."},
  "status": "candidate | rejected | selected",
  "note": "reason for rejection or selection"
}
```

## Selection record

| Asset | Run | Output sha256 | Selected by | Owner acceptance (link, date) |
|---|---|---|---|---|
| ... | ... | ... | ... | ... |
