# Music Explorer — Functional Specification & Implementation Plan

**Version:** 1.0 · **Date:** 2026-10-26 · **Status:** Design agreed; implementation not started

## 1. Purpose

Build a personal, Spotify-connected music exploration application that helps the user discover sonically and atmospherically coherent listening paths from their liked songs. The product does not begin with genre buckets, predefined vibes, playlists, or rigid clusters. It progressively collects the user's judgments about **contextual compatibility**.

**Definition of `Fits`:** "This candidate is compatible with the overall sonic cohesion and atmosphere of my **recent active path**." It does **not** mean "I like the song in general," "this pair is an especially good immediate transition," or "this candidate must match every ancestor of the path." Rejections are likewise contextual, not dislikes.

### Seed materials verified

- `Liked_Songs.csv`: original export, 6,068 tracks, preserved unchanged.
- `liked_songs_since_2020.csv`: 3,320 retained tracks, filtered by `Added At >= 2020-01-01`, with 3,320 unique Spotify track IDs, track names, artists, timestamps, and historical numerical audio-feature columns.
- `music_similarity_judgments_rounds_1_to_5.csv`: 48 prior judgments (16 fits, 26 no, 5 maybe, 1 unsure) from reference-based comparisons. Preserve each judgment's original reference and never convert these directly into exploration-tree edges.
- `music_similarity_learning_state_round6.json`: contains historic judgments and a *proposed*, **unrated** Round 6 pair test. Do not import the proposed pair test as actual judgments.

All these are **local input files**; none belong in the public deployment build.

## 2. Functional scope (MVP)

### 2.1 Import & library

1. Provide a first-run wizard: (a) import a Spotify-compatible CSV, (b) inspect a preview of column mapping, (c) choose an `Added At` date filter, default `2020-01-01`, (d) confirm imported track count, duplicates, invalid IDs, and rejected rows, (e) choose/create a local `exploration.json` file.
2. Support the actual columns: `Track URI`, `Track Name`, `Artist Name(s)`, `Album Name`, `Added At`; accept extra columns without breaking. Derive canonical ID from `spotify:track:<id>` and validate it. Preserve extra source fields where useful but do not require audio features for normal operation.
3. De-duplicate on Spotify track ID; preserve original input and do not silently delete anything. Warn on changing the date cutoff after judgments exist.
4. Import the 48 historical judgments through an explicit *Import past comparisons* action, idempotently, with original reference IDs. These remain reference-comparison evidence, not fabricated accepted branches.
5. Allow searching the imported library and starting a **new exploration root** from any eligible song, including a song that was rejected in a different context.
6. Future enhancement: incremental import of current Spotify liked tracks via `GET /me/tracks`, without losing CSV-only features or overwriting judgments. Do not make this a prerequisite for MVP.

### 2.2 Spotify integration

1. A browser-only Spotify OAuth Authorization Code with PKCE flow (no client secret). Require explicit user authorization and maintain the access token lifecycle. Exact registered HTTPS callback for GitHub Pages. Local development must use a permitted loopback IP callback (not `localhost`).
2. Require Spotify Premium for development-mode playback and select a supported Spotify Connect device (prefer Spotify Desktop, but allow another device). Request minimum scopes: `user-read-playback-state`, `user-modify-playback-state`; add `user-library-read` only if live library sync is implemented.
3. Issue per-track playback to the selected Spotify client with the Spotify Web API rather than embedding a competing audio player or opening another browser tab.
4. Set Spotify repeat mode to `track` while exploring. Save the previous repeat setting and try to restore it on session exit. Test that repeat-one works reliably on the selected device; if not, display a visible fallback, leaving the candidate pending and offering Replay.
5. Serialize playback commands (Spotify does not guarantee ordering), reconcile reported playback using accepted-command confirmation and the selected device, and handle missing/inactive/restricted devices, playback conflicts, `401`, `403`, `429`, network errors, and reauthentication. Honor `Retry-After`; do not busy-poll.
6. Never accept a judgment while Spotify is confirmed to be playing a different track from the candidate. Pause and show `Resume candidate` on external playback changes; treat temporary no-state responses as uncertain, not as positive confirmation.
7. A finished song does not create any judgment. The same candidate should loop until Fits, No, Skip, pause, or an explicit change of session.
8. The app must show Spotify metadata and original, unaltered album artwork. Each cover/title has an available Spotify attribution/link; never crop, blur, overlay or distort artwork. Lazy-load metadata for tracks about to play and visible graph nodes; avoid mass-fetching 3,320 single-track lookups.

### 2.3 Two explicit player modes

**Reference replay mode** (after `Replay & explore from here`):
- Activate selected node as current context; replay its track from the beginning.
- Display large cover, title, artist, breadcrumb path, selected device, playback controls and the primary action `Next suggestion`.
- Do **not** display Fits/No because the reference is not a candidate for rating.
- The selected reference may loop while the user reacquires the atmosphere. Pressing `Next suggestion` picks a pending candidate and changes to evaluation mode.

**Candidate evaluation mode**:
- Display candidate cover prominently (~250–350px on desktop), artist/title, Spotify attribution, active-path breadcrumb, device, repeat indicator and playback progress (where available).
- Large primary actions: **No**, **Skip**, **Fits**, plus Pause/Resume, Replay, Undo and Open Graph.
- **Fits:** record a contextual positive judgment and a new child node under the active node, move to that child, select the next candidate, then request its playback. Accepted nodes are occurrences, not unique songs.
- **No:** record a contextual rejection, keep active node unchanged, select another candidate and request playback.
- **Skip:** record exposure without a compatibility judgment; keep active node unchanged, choose another candidate.
- **Maybe/Unsure:** preserved for historical imports; MVP can expose them via an optional secondary menu if useful. A `Skip` must **never** be interpreted as `No`, `Maybe`, or `Unsure`.
- Each decision is durable **before** starting the next Spotify playback command. If saving fails, stop progression and show recovery controls; never silently lose a judgment.
- **Undo:** reverse the most recent evaluation and its direct graph effects, restore context, and replay that candidate. Do not silently remove any descendant graph with later decisions; require explicit confirmation for destructive retrospective edits.

### 2.4 Branching / navigation

1. Main view remains player-focused. `Graph` opens an **overlay**, not a permanently visible split view. Opening/closing does not interrupt playback.
2. A zoomable/pannable directed tree of accepted song occurrences (React Flow / `@xyflow/react`). The accepted-tree view is a navigation representation; evaluations also form a **contextual knowledge network**, which is distinct.
3. **Every node contains original album art** (square cover, fallback if unavailable), track name, artist, contextual status. Zoom levels progressively simplify labels while retaining covers. Do not overlay badging on Spotify artwork: place controls/indicators around the image.
4. Clicking a node only selects it and shows detail—no playback side effects. `Replay & explore from here` makes it the active node, closes the graph, starts reference replay at 0:00, and leaves all its existing descendants unchanged.
5. A selected node may create any number of child branches. Reusing the same Spotify track in distinct contexts creates separate node IDs but uses the same canonical Spotify track ID.
6. Rejected and skipped suggestions do not clutter accepted-tree nodes; they appear in node detail/activity history. Each node preserves its own pending/seen candidate queue.
7. Include locate active node, search song/artist, center graph, navigate to current path, path breadcrumbs, collapse subtrees, and large-graph performance via layout/virtualization as necessary.
8. A new exploration root starts another tree while retaining previous sessions.

### 2.5 Candidate recommendation behavior

**Design goal:** Learn what the user judges coherent, not manufacture authoritative AI mood labels.

- The recommendation context includes the active node **and a recent-window snapshot** of the accepted path, initially the last **4** accepted songs (configurable after validation), weighted towards more recent context. A root may influence the path but never acts as an unbreakable anchor.
- Prevent candidates from being re-proposed repeatedly within the same context after No/Skip/Fits; retain eligibility in other branches where contexts differ. A candidate may have several context-specific judgments; never treat a rejection as a global blacklist.
- Preserve per-node candidate queues and previously evaluated items. Switching branches must not erase or reuse other nodes' queues.
- Use a **deterministic, inspectable v0 candidate selector**, not a trained model. Candidate sourcing should offer (1) close-to-context suggestions, (2) boundary exploration and (3) informative comparisons; the proposed 70/20/10 weighting is **an initial configurable heuristic**, not validated probabilities.
- Prefer direct, user-provided evidence from historical and live judgments. Avoid declaring numerical Spotify feature similarity equal to actual cohesion. Evaluate whether any use of Spotify-derived feature columns in scoring complies with Spotify's current analysis restrictions **before enabling feature-based ranking**. If not, use a compliant baseline based on explicit user choices, random/diverse eligible tracks, and user-directed exploration.
- Candidate explanations should be factual: `Previously accepted with reference X`, `Exploration candidate`, `Related to recent accepted examples` (only if grounded). Never fabricate confidence percentages.
- No ML training on Spotify Platform data or content. If revisiting ML in future, undertake separate product/legal/technical review using appropriately licensed non-Spotify training data and user choices.
- Hold out judgments to test prediction quality later; do not claim improvement without measured performance. No automatic category creation or playlist publication in MVP.

### 2.6 Local-first persistence

- **Canonical files on user's device:** library CSV and versioned `exploration.json`. The deployed site may not bundle these private files or publish them to GitHub.
- Edge/Chrome: user chooses or creates writable JSON through File System Access API. With granted write permission, save after each judgment/branch activation/queue update, using serialized writes and update-safe file replacement; show persistent save status. Browser permissions may require renewal after reload.
- Other browsers or declined permission: maintain recoverable in-browser session state plus explicitly downloadable JSON export; clearly warn that this is not equivalent to direct persistent file saving. No server DB.
- Include manual Save As/Backup and Restore/Import with schema validation, migration and duplicate-safe history import. Keep historical evaluations auditable and `undo` traceable.
- Store Spotify tokens **separately** from exported state; never put credentials, OAuth tokens, or refresh tokens in JSON, CSV, repository, GitHub Actions artifacts or published assets. Minimal transient session storage where appropriate.
- Include a straightforward `Disconnect Spotify` action and data removal option, respecting Spotify requirements.

## 3. Suggested persisted-state structure

A single JSON file with a schema version and stable identifiers (example shape, not final code):

```json
{
  "schemaVersion": 1,
  "library": {
    "sourceFile": "liked_songs_since_2020.csv",
    "addedAtFrom": "2020-01-01",
    "trackCount": 3320,
    "fingerprint": "sha256-of-normalized-import"
  },
  "sessions": [
    { "id": "s1", "rootNodeId": "n1", "createdAt": "2026-10-26T10:00:00Z" }
  ],
  "nodes": [
    { "id": "n1", "sessionId": "s1", "spotifyTrackId": "01TyFEZu6mHbffsVfxgrFn", "parentNodeId": null, "acceptedByEvaluationId": null }
  ],
  "evaluations": [
    {
      "id": "e1", "kind": "live_path", "contextNodeId": "n1",
      "recentPathNodeIds": ["n1"],
      "candidateSpotifyTrackId": "6rcEGONV6XPUTvwqUEXdIH",
      "verdict": "fits", "createdAt": "2026-10-26T10:03:00Z"
    }
  ],
  "historicalReferenceComparisons": [],
  "candidateQueues": {},
  "active": { "sessionId": "s1", "nodeId": "n1", "mode": "reference", "pendingTrackId": null },
  "settings": { "recentPathWindow": 4, "explorationRatio": 0.3 },
  "events": []
}
```

This model must be normalized so multiple occurrences of the same Spotify track remain distinguishable. Use Zod for runtime parsing/migrations; TypeScript types derive from the validated schemas. Keep the event trail append-only for auditable action/undo history; runtime can derive the displayed tree from current state. Do not save cover-art binaries or Spotify tokens.

## 4. Technology and repository

- **Frontend:** React + TypeScript + Vite.
- **Graph:** `@xyflow/react` with album-art node component and lightweight graph layout.
- **Styling:** accessible CSS/Tailwind optional; mobile-responsive player. Full overlay for graph.
- **Validation:** Zod, unit tests with Vitest, UI tests using Playwright with a simulated Spotify adapter.
- **Spotify integration:** small typed Web API client + PKCE session + device/player state-machine adapter.
- **Deployment:** GitHub Actions → GitHub Pages, HTTPS, correct Vite `base` for `/music-explorer/` and matching Spotify OAuth redirect URI. Public deployment contains **code only**, never user's CSV, JSON or OAuth secrets.
- **Repository:** dedicated `Music-Explorer` repository recommended; private source repository requires an eligible GitHub plan for Pages, but the **Pages site is public** even if repo is private.
- **No backend:** no API server, databases, Firebase, Supabase, or server-side Spotify token broker for MVP.

```text
music-explorer/
  src/
    app/                   # routing/state orchestration
    components/player/     # cover, controls, breadcrumbs, status
    components/graph/      # album-art nodes, full-screen overlay
    domain/                # entities, judgments, sessions, selectors
    integrations/spotify/  # PKCE, playback, tracks, devices, metadata
    import/                # CSV mappings, past judgments
    persistence/           # JSON validation, file-write adapter
    recommendations/       # deterministic selectors and tests
  tests/
  docs/                    # decisions, scope, safety, acceptance
  .github/workflows/       # tests and Pages deployment
  README.md
```

## 5. Key UI and keyboard shortcuts

**Primary player:** giant candidate cover; title/artist; Spotify attribution; breadcrumb of recent covers; pause/replay; active device & repeat state; prominent `No`, `Skip`, `Fits`; save indicator; Undo.

**Graph overlay:** album artwork in each node; interactive selection; breadcrumb context; `Replay & explore from here`; no auto-play just by inspecting a node; toggle back to player.

**Keyboard:** `1` No, `2` Skip, `3` Fits, `Space` Pause/Resume, `Z` Undo, `G` Graph (only when focus isn't in a text input; provide visible button equivalents). Ensure keyboard focus states, accessible button labels, and album-art alt text.

**Failure cases:** no device, reconnect, refused file permission, expired token, expected-track mismatch, skipped/inactive candidate, 429/quota, missing image, browser lacks file-write support. The user should always know whether a decision is persisted and which song is pending.

## 6. Delivery plan (sequenced and independently testable)

### Phase 0 — Feasibility & policy gate

- Create/configure Spotify Developer app and register exact dev + production OAuth callbacks; validate Premium allowlist and development-mode availability.
- Test device enumeration, playback of a known track, repeat-one, state reconciliation, and cover retrieval against a real Premium account.
- Review Spotify Developer Policy regarding automated playback, repeated listening, user profiling/content analysis and ML before enabling any Spotify-derived feature-ranking logic.
- Establish public Pages/privacy strategy. **Exit:** tested API feasibility, documented restrictions and fallbacks.

### Phase 1 — File import & domain model

- Implement CSV import with 2020 cutoff; verify **3,320** unique tracks from current export and report malformed rows.
- Implement versioned `exploration.json`, file-picker save, export/import, backups, schema migration and action history.
- Import historical **48** judgments into a separate reference-comparison collection, not branches. **Exit:** import + save/reload preserves the full data and user judgments.

### Phase 2 — Player UX with mocked Spotify

- Implement candidate/reference modes, album-art slots, keyboard controls, progress, decision actions, replay/loop state, undo, loading and error states.
- Use a fake Spotify adapter for deterministic tests. **Exit:** 20 mocked decisions with no navigation or data loss.

### Phase 3 — Branching graph & navigation

- Implement React Flow overlay, cover nodes, selection without playing, replay-and-explore activation, branch preservation, node-local queues, search, center active, breadcrumbs.
- Test same track in separate branches; no global blacklist. **Exit:** branching from earlier nodes works repeatedly with accurate save/reload.

### Phase 4 — Real Spotify playback integration

- Implement PKCE, device picker, playback queue serialization, repeat-one and restoration, playback reconciliation, metadata/cover lazy loading and compliant attribution.
- Test external playback changes, disconnect and API errors. **Exit:** real Spotify session can replay references, loop candidates, and process decisions without tabs or lost data.

### Phase 5 — Candidate ranking and evaluation

- Establish a conservative deterministic baseline using permitted evidence and local explicit user judgments. Add contextual recent-window selection, node-local candidate exclusion and explainable exploration modes.
- Run tests on earlier A/B reference judgments and new prospective decisions; measure prediction quality, coverage, acceptance rate and over-repetition. Never promise a model is learning effectively without such evidence.
- Only then consider advanced audio embeddings or a more expressive model, after legal/source validation. **Exit:** usable recommendations that outperform a simple baseline in user evaluation or an explicit finding that more data is needed.

### Phase 6 — Deployment and release

- Configure Vite static build, GitHub Actions tests and Pages deployment; ensure no CSV/JSON or secrets in bundles or repository history.
- Confirm production OAuth callback, HTTPS, navigation reload, recovery from interrupted saves, cross-session restore, mobile layout and full keyboard accessibility. **Exit:** personal use in Edge/Chrome on GitHub Pages with reproducible saved JSON state.

## 7. MVP acceptance tests

1. Given the actual original CSV, filter `Added At >= 2020-01-01` yields **3,320** tracks without modifying the input file.
2. Historical import yields exactly **48** reference judgments, with 16 fits, 26 no, 5 maybe and 1 unsure; no artificial branches are created.
3. Starting from any library track, its original album artwork appears, with Spotify attribution and link.
4. A candidate loops until an explicit decision; no song-end event auto-classifies it.
5. Fits records compatibility with the *recent active path*, adds a child to the current node, advances the active node and immediately requests another track.
6. No/Skip don't extend a path; No remains context-specific, Skip does not become a negative signal.
7. Selecting a graph node alone never interrupts Spotify. `Replay & explore from here` starts that reference at 0:00 and preserves all existing descendants.
8. Node-local pending queues survive switching branches and app reload. Duplicate Spotify track IDs across branches do not collide.
9. At least 20 sequential actions, branch switches, undo and save/reload produce the same recorded decisions and graph, without duplicate events.
10. After a successful Spotify start, trust the first playing report on the selected device within the bounded observation window, even if its ID differs, per [accepted-command confirmation](../decisions/003-spotify-album-context.md). Keep that runtime ID association for controls and ratings; save judgments against the requested candidate. Missing/paused startup playback, wrong devices, failed requests, or later unrelated track changes still block confirmation. No per-track hardcoding or manual confirmation is required.
11. On file-write failure, the app indicates unsaved state and does not silently advance to a different candidate; backup/export is available.
12. Public Pages deployment never includes personal CSV/JSON, cover-image binaries, access tokens or refresh tokens.

## 8. Explicitly out of MVP

- Automatic vibe/genre playlist categories.
- Automatic writing of Spotify playlists (future user-approved export only).
- ML/audio embedding training or retrieving/ripping Spotify audio.
- Cloud synchronization, multi-user account system, database service, backend.
- Fully automatic judgments inferred from listening duration.
- Treating all accepted tracks in one path as a mutually compatible clique without explicit evidence.

## 9. Principal risks & mitigations

| Risk | Mitigation |
|---|---|
| Spotify API account/permission/quota restrictions | Run integration spike first; document Premium and 5-user dev limit, use low-frequency polling, exponential backoff. |
| Spotify policy restricts analysis of Spotify Content | Compliance gate; never train on Spotify content; keep heuristic simple and grounded in explicit user judgments until permitted evidence is clear. |
| Site is public even from private GitHub Pages source | Publish static code only; keep user library and JSON exclusively on the device. |
| Local file-write API unsupported by some browsers | Chrome/Edge first; manual JSON import/export fallback with visible unsaved warnings. |
| Spotify command ordering and external device changes | Serialize requests, confirm expected playing track, pause rating if inconsistent. |
| Repeating track increases play count unintentionally | Only implement user-directed repeat-one, no unattended bot loops, consider compliant fallback if policy concern arises. |
| Graph too large | Progressive graph rendering/collapse, root/session filtering, search and active-path emphasis. |
| Recommendations fail to capture subtle mood/timbre | Use user feedback as primary truth, retain uncertainty and measure actual prediction success; don't overclaim accuracy. |

## 10. Verified platform references (2026-10-26)

- Spotify February 2026 developer restrictions and endpoint availability: https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide
- Spotify OAuth PKCE: https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow
- Spotify start playback: https://developer.spotify.com/documentation/web-api/reference/start-a-users-playback
- Spotify repeat-one: https://developer.spotify.com/documentation/web-api/reference/set-repeat-mode-on-users-playback
- Spotify saved tracks: https://developer.spotify.com/documentation/web-api/reference/get-users-saved-tracks
- Spotify branding/design: https://developer.spotify.com/documentation/design
- Spotify developer policy: https://developer.spotify.com/policy
- GitHub Pages public site visibility: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
- Browser File System Access API: https://developer.mozilla.org/en-US/docs/Web/API/File_System_API

**Implementation authorization:** this document is a development-ready specification and backlog. It does not claim that the application, repository, Spotify registration or deployment has been created.
