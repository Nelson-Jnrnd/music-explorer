# Acceptance evidence

Implementation is complete on `feat/music-explorer-mvp`, reviewed independently, and proposed in [PR #4](https://github.com/Nelson-Jnrnd/music-explorer/pull/4). It has not been merged or publicly released. Issues [#1](https://github.com/Nelson-Jnrnd/music-explorer/issues/1), [#2](https://github.com/Nelson-Jnrnd/music-explorer/issues/2) and [#3](https://github.com/Nelson-Jnrnd/music-explorer/issues/3) track the integration, engine and interface outcomes.

## Executed checks (2026-10-26)

| Check | Result |
|---|---|
| `npm test` | 27 passing Vitest tests across 5 files |
| `npm run build` | TypeScript and production Vite build pass |
| `MUSIC_BROWSER_PATH=/tmp/music-chromium npm run test:e2e` | 6 passing Chromium scenarios |
| `python3 scripts/check_public_build.py` | Static build contains code only; no data files or token literals |
| `python3 scripts/validate_template.py` | 36 governance files and 6 roles present |
| Remote GitHub Actions | Run [40309016371](https://github.com/Nelson-Jnrnd/music-explorer/actions/runs/40309016371) failed before executing any steps; no job log was available through the connector. Root cause is unverified. |
| Independent full review and bounded correction verification | Approved; 0 Blocking / 0 Major; see REVIEW.md |

The browser suite verifies twenty sequential decisions, no rating controls for reference replay, branching, selection without playback side effects, reload and explicit resume, append-only undo, failed direct-write recovery without double-counting, malformed restore rejection, real Web API client behavior with mocked responses, untouched returned artwork, track mismatch and unknown-state rating blocks. Keyboard shortcuts, responsive no-horizontal-overflow and axe checks run on empty, player, graph and mobile states.

Screenshots were produced and inspected for the empty desktop view, desktop player, graph with connected nodes, mobile player and malformed-restore error. Test output paths: `test-results/empty-desktop.png`, `player-desktop.png`, `graph-desktop.png`, `player-mobile.png`, `error-desktop.png`. When Actions can execute, CI regenerates these from synthetic inputs and publishes them in the `browser-evidence` Actions artifact. The observed remote run failed before steps, so no remote screenshot artifact is claimed. Screenshots and test data contain no user library.

The standard Playwright browser download returned an invalid empty archive in this environment. A Chromium 153 binary from the npm `@sparticuz/chromium` distribution was decompressed into scratch for execution; it is not a project dependency or published artifact. Normal CI uses Playwright's matching Chromium. `MUSIC_BROWSER_PATH` optionally selects a local executable.

Build warnings: Vite reports the main JavaScript chunk above 500 kB (about 576 kB, 181 kB gzip); Zod dependency comments generate Rollup annotation warnings. These do not fail the build. No claim of measured recommendation improvement is made: prospective user judgments are needed to compare the deterministic baseline.

## External checks before release

The only supplied input was the specification. The actual song CSVs, 48-comparison export and round-six learning JSON were not available for this implementation. Their required counts (6,068 original / 3,320 after cutoff, and 48 historical comparisons) remain unverified. Import the original files locally, inspect the mapping/report, and verify the historical verdict counts without committing those files.

With the owner's registered Spotify Developer app and authorized Premium account:

1. Register exact development and eventual production callbacks from README. Test authorization, token refresh and disconnect.
2. Enumerate devices, select Desktop, play a known track and inspect original album artwork/Spotify link.
3. Confirm repeat-one loops the pending candidate without a verdict. If repeat is unavailable, verify the visible Replay fallback.
4. Change Spotify playback externally; verify judgments stop until Resume candidate. Test inactive/restricted devices, network loss, expiry and quota errors.
5. Disconnect and verify previous repeat restoration. If the browser closes abruptly, inspect Spotify repeat manually.
6. In Chrome/Edge, save to a real writable JSON, reload, Open existing JSON, and resume. Verify file contents and backups using real local file permissions; browser tests use simulated file handles for failure injection.
7. Approve public hosting separately. After merge, enable Pages/GitHub Actions, run the manual publish workflow and validate the HTTPS callback. The private source repository stays private; the Pages site is public.

These account, source-data and publication checks were not performed or claimed as passed.

The owner should inspect the failed Actions run annotations in GitHub and resolve the pre-execution failure, then rerun checks. Connector reads showed zero executed job steps; log retrieval returned BlobNotFound and annotation access was unsupported. No application test failed remotely because no test step started.
