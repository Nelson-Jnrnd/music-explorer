# Music Explorer

A personal listening-path explorer. Import a Spotify CSV, replay a reference on a Spotify Connect device, and judge suggestions against the sound and atmosphere of your recent path. Accepted songs form a branching tree; refusals and skips stay in their original context.

## Run locally

Requires Node.js 22.12+ and npm.

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:5173/music-explorer/`. The IP address matters: Spotify rejects `localhost` callbacks. The app has no backend and requires no client secret.

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
python3 scripts/check_public_build.py
```

For deterministic browser testing, the development server accepts `?simulate=1`. It is visibly labeled simulated playback, does not play audio, and is disabled in production. Tests use synthetic songs only.

## Connect Spotify

1. Open [Music Explorer](https://nelson-j.ch/music-explorer/) and select **Connect with Spotify**. Sign in and authorize the requested playback permissions on Spotify. Only playback-state and playback-modification scopes are requested.
2. Open Spotify Desktop (or another Connect device), refresh devices in Settings, select one, and use Resume candidate. Judgments are enabled only when the expected track/device are confirmed. Development-mode owner and playback account require Premium; ensure the account is allowed for the Spotify app.
3. Disconnect Spotify to restore the previous repeat setting and remove this tab's tokens. Browser shutdown cannot reliably run a final network request; if repeat restoration fails, change Spotify repeat manually. You can also revoke the app at [Spotify account apps](https://www.spotify.com/account/apps/).

The deployed application uses the owner's public client ID from `src/integrations/spotify/config.ts`. This identifier is part of browser OAuth requests and is not a secret. No client secret is used or requested. Users do not need to register their own app or enter a client ID.

For maintainers: register the exact production callback `https://nelson-j.ch/music-explorer/` in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard). Local development also requires `http://127.0.0.1:5173/music-explorer/`. Keep trailing slashes. A separate deployment must configure its own public client ID and register its exact callback.

No live account was supplied during implementation. Real playback, eligibility, repeat-one reliability and device transfer must be verified using the checklist in [release acceptance](docs/verification/ACCEPTANCE.md).

## Import and explore

The first-run wizard previews column mappings, defaults to tracks added since `2020-01-01`, and reports unique tracks, duplicates, invalid IDs, rejected rows and date exclusions. Extra CSV columns remain available locally; audio features are not used for ranking. The original CSV is never changed.

Select a library song to create a root. Reference replay has Next suggestion, with no rating controls. In candidate mode, Fits appends an occurrence to the current path; No keeps the context; Skip records exposure only. No song-end event makes a judgment. Undo adds an audit event and restores the candidate. Opening the graph or selecting a node does not change playback. Replay & explore from here activates that occurrence, replays the reference, and preserves its existing branches.

Keys outside interactive controls: `1` No, `2` Skip, `3` Fits, `Space` pause/resume, `Z` Undo, `G` Graph. Buttons provide the same actions.

## Save and restore

Your versioned exploration JSON includes the local song library, queues, sessions, evaluations and audit events. Choose a writable file in Chrome/Edge to save every action. After reload, reconnect through Open existing JSON; Save as creates or intentionally replaces a file. Other browsers use recoverable browser storage, which is not a separate backup. Download backups regularly.

A write failure stops progression before another track starts. Retry, choose another destination or download the pending recovery state. Restore validates schema and graph references before replacing data. Unknown schema versions are rejected; version 1 is the initial format. Restore is an explicit replacement, not a silent merge of two unrelated explorations.

Past comparisons are imported explicitly through Settings, kept separately from branches, and deduplicated by judgment identity. Only explicit fits/no/maybe/unsure verdicts count. Proposed or unrated pair tests are ignored. Source formats and actual private-file counts require verification against the user's original files; these files are not bundled.

## Privacy and deployment

Song CSVs and exploration JSON stay on the device. Spotify receives authorization, metadata and playback requests; original album art is requested lazily for visible songs. Tokens are separate, tab-scoped session data and never part of backups. No database, analytics, playlist publication or ML training is included. Disconnect removes Spotify tokens; Remove local exploration data clears songs/history (and rewrites the chosen file when connected).

The baseline selector uses explicit contextual evidence and deterministic exploration. It does not label moods, analyze Spotify audio features, train a model or claim measured recommendation improvement. See [architecture and policy gate](docs/architecture/IMPLEMENTATION.md).

GitHub Actions checks tests and the production build. Pages deployment is manual, from `main`, after owner release approval and enabling Pages with GitHub Actions. A private repository requires an eligible GitHub plan; the hosted site is public. Only `dist/` is uploaded. Personal CSV/JSON must never be placed in `public/`, source imports or Actions artifacts.

Approved requirements: [functional specification v1](docs/specifications/Music_Explorer_v1.md). Implementation/review evidence and remaining account-dependent checks: [acceptance](docs/verification/ACCEPTANCE.md).
