# Start tracks through their album context

Candidate starts and Replay use Spotify's documented `context_uri` album plus `offset.uri` track and `position_ms: 0`. Pause and ordinary Resume remain bodyless controls. Resolve the requested track with authenticated `GET /tracks/{id}?market=from_token` before changing playback. If album metadata is missing or Spotify explicitly reports the track unplayable, stop with an error before sending player commands.

The owner reported that direct track-list starts stop existing phone playback and leave no reported track, while the Spotify link works. Independent developers report this same recent regression and an album-context workaround. This is evidence for a compatibility change, not proof of the owner's root cause or a Spotify-confirmed incident.

## Accepted-command confirmation (owner decision, 2026-10-29)

The owner explicitly chose to trust a successful Spotify play acknowledgement when the subsequent playing track has a different ID. This supersedes metadata-only ID equivalence and the one-track catalogue exception from PR #22. Remove the hardcoded pair and reverse metadata lookup/cache. No per-song confirmation or persistent alias table is required.

After a candidate start or Replay succeeds, the adapter opens a five-second observation window when the serialized operation returns. Reads begun within the first 750 ms cannot bind a differing ID, allowing Spotify time to apply the command. The first non-null PLAYING track read on the selected device after that delay is associated with the requested candidate, regardless of its reported ID. Both the read's start and completion must be within the window. The existing bounded confirmation polling supplies these reads without resending the play command. Exact IDs, Spotify linked_from proof and the start's metadata-resolved ID remain valid independently.

Latch that one reported ID for the current operation. Subsequent Pause/Resume, polling, Check playback and rating use the association. Later unrelated IDs or devices do not inherit it. Preserve the actual reported ID in state and the requested candidate ID in saved judgments. `acceptedForTrackId` is runtime command trust, not a claim that two Spotify catalogue entries are equivalent. No extra metadata lookup is needed to validate the reported ID.

Clear the operation before a new start, including failed starts, and on exit. A read begun before a different operation cannot bind or annotate its state. Failed or ambiguous play requests do not arm trust. Paused reports, no state, the wrong device, expired windows and reloaded sessions cannot create an association. An explicit Check playback sends no player commands and can only read the association of an already accepted start. Nothing is persisted or shared between candidates.

This policy deliberately trusts Spotify: a stale report after the settling delay or a concurrent external action could be associated with the request. The acknowledgement is not proof that Spotify has already applied the command. The owner accepts that tradeoff to avoid blocking judgments on catalogue ID differences. This is not an acoustic/title/ISRC match. A one-ID latch and bounded window limit the assumption; existing external-change guards apply afterward.

Decision and observed cases: https://github.com/Nelson-Jnrnd/music-explorer/issues/20. Both owner pairs and a previously unknown synthetic pair are regression fixtures, not runtime special cases.

## Diagnostics and repeat

Default error summaries omit identifiers. An explicit Check playback also displays the expected and Web API-reported public track IDs, restricted to Spotify's 22-character base62 catalogue format. This distinguishes what the Web API reports from the Spotify app's Share link when confirmation fails. Missing or malformed IDs display as unavailable. Device/account identifiers, tokens and raw payloads remain excluded. The report stays in the existing local UI state, with no persistence or automatic transmission. This diagnostic supplies evidence; it does not relax confirmation or send player commands. Matching Share links alone are not proof of the Web API's reported identity.

Repeat-one remains preferred and the existing Replay fallback remains visible when repeat cannot be established. Album context can continue to another song if repeat fails; existing playback polling blocks rating and pauses confirmed mismatches, with up to the polling interval before detection. No playlist creation, queue mutation, new scopes or backend is introduced.

Sources:
- https://developer.spotify.com/documentation/web-api/reference/start-a-users-playback
- https://developer.spotify.com/documentation/web-api/concepts/track-relinking
- https://community.spotify.com/forum/en/discussion/7552922/web-api-me-player-play-returns-204-but-does-not-start-playback-and-clears-current-playback-desktop
- https://community.spotify.com/forum/en/discussion/7562011/me-player-play-with-body-does-not-start-song-on-android-spotify-app
