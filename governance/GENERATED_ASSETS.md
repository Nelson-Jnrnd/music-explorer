# Generated visual assets

Applies to icons, logos, backgrounds, illustrations, photos, portraits, textures and any other image an agent produces with an image-generation tool, vector construction or a mix. It extends `governance/UI_QUALITY.md` and uses `governance/ARTIFACT_RECOVERY.md` for storing and transferring files. Taste decisions (look, feel, subjects, acceptance of the final art) belong to the Product Owner (`governance/DECISION_BOUNDARIES.md`).

The method comes from a project that generated hundreds of consistent assets with agents. Its core idea: **a generated image is a candidate, not a deliverable.** Quality and consistency come from a written art direction, frozen recipes, small proofs before batches, every attempt kept, and separate steps for choosing and approving.

## 1. Choose the right production method per asset

| Asset needs | Method |
|---|---|
| Exact shapes, small sizes, precise geometry, lettering, flags, maps, UI icons, diagrams | Construct as editable SVG (or the platform's icon format). Do not generate. |
| Logos and identity marks | Explore concepts with generation, owner selects a direction, then redraw deliberately as clean SVG. Never auto-trace a generated image. |
| Photos, portraits, illustrations, backgrounds, textures | Generate raster candidates with a frozen recipe. |
| Text in or on an image | Never bake it into generated images. Compose text outside the art. |

State the method for each asset family in the issue. If a generated image is mostly right but a detail is wrong, correct it with a new recorded request or move that detail to a vector layer; do not hand-wave it.

## 2. Write the art direction before generating anything

One canonical document per project, `docs/design/ART_DIRECTION.md` (start from `templates/ART_DIRECTION.md`). It owns:

- the shared visual language and the reasons for it (what the images should feel like in the product),
- palette roles, lighting, camera or framing, level of detail, and what each family looks like,
- a reusable **prefix** per family (the standing part of every prompt) and one shared **negative list** (real brands, real people, baked-in text, watermarks, generic effects, and so on),
- a **slot brief** for each place an asset appears: purpose, display size and aspect, transparency, fallback if missing, and alt-text guidance,
- the minimum sizes each family is checked at.

The Product Owner approves the direction and any visual identity choice. Agents do not invent a house style from silence; propose options with samples and ask once.

## 3. Prove small, then extend

1. Make a small proof (one to three assets) of a family.
2. Review it at full size and at the real display size. Owner accepts or redirects.
3. Only then freeze the **family master** (one chosen reference per family) and extend to the batch.
4. A new family, a new tool or model, or a changed reference requires a new small proof.

Do not use a reference from one family to satisfy another (a car reference for portraits). Do not build a set by recolouring the previous output into the next one; derive every variant from the same frozen master, or the set drifts.

## 4. Freeze the recipe, record every request

Before generating, write the **family recipe** (start from `templates/ASSET_RECIPE.md`): prompt body, prefix and negative list, permitted variables, camera, lighting, background or transparency, framing, reference roles and target display size. Then for each request, record in a run log next to the assets:

- the complete resolved prompt (no unresolved placeholders, no undocumented additions),
- ordered reference files with SHA-256 hashes, each marked as edit target, geometry/identity reference or style reference,
- the tool and any controls it actually exposes (model, seed, quality). Write `not exposed` where it is not; never invent values,
- output filename, dimensions, mode and SHA-256 of the result.

One asset per request. Do not rely on implicit "recent image" context.

## 5. Keep every attempt, select separately

- Store every raw output unchanged under a versioned path, including rejected ones with the reason. Never overwrite an output that was reviewed.
- A corrective edit is a new request with its own record and filename; the predecessor stays.
- **Selection is a separate record**: which output, its hash, who selected it, and its status. Selecting a candidate is not approval.
- Keep accepted originals in the repository. Do not depend on regenerating them; fresh generation from identical input produces different pixels.
- Never regenerate an accepted or recoverable asset because an upload, commit or download failed (`governance/ARTIFACT_RECOVERY.md`).

## 6. Inspect before presenting

Check every candidate yourself first, and reject failures with a stated reason:

- full-size view for silhouette, anatomy, joints, proportions, stray marks, seams and impossible objects,
- crops at native size, edges and transparency on both light and dark backgrounds,
- the family **contact sheet** side by side, so inconsistency and near-duplicates are visible,
- the real minimum display size and a greyscale view, for icons, logos and portraits,
- accidental text, pseudo-writing, logos, watermarks, and resemblance to real people or brands,
- for sets: variety. Ten items should differ in structure and silhouette, not only in colour.

Automated metrics (alpha coverage, dimensions) cannot prove geometry, identity, rights or quality; they supplement looking.

## 7. Present for owner review

The Product Owner reviews pictures, not paths. Provide a single review sheet (PDF or image page) with each candidate large, then at real size, with a short plain-language caption saying what to look at and what decision is needed (`governance/USER_INTERACTION.md`). Ask for an explicit pick or reject per asset. Record the answer in the repository, pinned to the asset hashes, so approval cannot drift onto a later regeneration.

Three approvals stay distinct and none implies the others: author selection, independent review, Product Owner visual acceptance. Approving a sample does not approve the batch.

## 8. Export deterministically

Production files are derived from archived selected sources by a scripted, versioned, pinned-dependency step: fixed crop and fit rules, preserved aspect ratio and alpha, enough resolution for the largest display, no stretching, no hiding defects with a background. Write atomically, reopen the files, and check dimensions, decoding and hashes. Build twice in separate processes and compare bytes. Only the export is promised to be byte-identical; fresh generation is not.

## 9. Rights and safety

- No real brands, trademarks, team or product identities, sponsor marks, or recognisable real people. Check for accidental lookalikes.
- Verify the generation tool's terms permit the intended use before production, and record the tool and account type. Terms and legal acceptance are Product Owner matters; flag them, do not decide them.
- Record the source and provenance of any supplied reference or stock asset. Do not fabricate provenance.

## Per-asset acceptance checklist

Record pass, fail or justified N/A with reviewer and revision in the delivery notes:

- [ ] Right slot, size, aspect and transparency per the slot brief; fallback exists
- [ ] Matches the family master: palette, lighting, viewpoint, detail
- [ ] Clear at minimum size and in greyscale; no defects at full size
- [ ] No baked-in text, no real marks or likenesses, no watermark
- [ ] Visible text and state live outside the image; alt text follows the brief
- [ ] Text over the image passes contrast on the real background
- [ ] No invented data or meaning (ratings, status, levels) drawn into the art
- [ ] Recipe, request log, raw outputs, selection record and hashes committed
- [ ] Owner visual acceptance recorded against the asset hashes
