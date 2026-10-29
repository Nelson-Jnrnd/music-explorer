# Start tracks through their album context

Candidate starts and Replay use Spotify's documented `context_uri` album plus `offset.uri` track and `position_ms: 0`. Pause and ordinary Resume remain bodyless controls. Resolve the requested track with authenticated `GET /tracks/{id}?market=from_token` before changing playback. If album metadata is missing or Spotify explicitly reports the track unplayable, stop with an error before sending player commands.

The owner reported that direct track-list starts stop existing phone playback and leave no reported track, while the Spotify link works. Independent developers report this same recent regression and an album-context workaround. This is evidence for a compatibility change, not proof of the owner's root cause or a Spotify-confirmed incident.

A market replacement may have another ID. Accept identity only when Spotify reports `linked_from.id`, or when the adapter's successfully accepted start resolves that exact original request through authenticated track metadata to the reported ID on the selected device. If the player reports another ID without `linked_from`, resolve that reported ID with authenticated market metadata: accept only an exact match of its resolved ID or explicit `linked_from.id` to the requested/resolved candidate. Matching names, artists, ISRCs or album membership are not identity evidence. Explicitly unplayable metadata or a failed lookup supplies no proof. The playback endpoint already prioritizes the access token's account country; track metadata uses `market=from_token`.

Cache at most eight reported-ID lookup results (including in-flight requests) per accepted start, so polling does not repeatedly fetch stable aliases or unrelated IDs. Failed reads may retry. Clear the runtime association before every new start and on exit, and discard proof completed for an obsolete start. Exact device checks remain mandatory.

## Observed catalogue compatibility pair

There is one directional exception to metadata-only identity proof: requested `47X95Rup7LOEaVIHWlkRUT` may be reported as `0FjI1qnqhQbJNZn0zZRUZK`. On 2026-10-29 the owner supplied the Web API diagnostic showing this exact pair, playing on the selected phone without `linked_from`. They confirmed the intended song audibly plays and Replay restarts it; both the app link and Spotify app Share link use the requested ID. Both public Spotify pages identify "She's A Big Boy" by Mcbaise; the requested entry's page title additionally mentions a music video. An audio/video catalogue distinction is plausible, but is not established by an official API contract.

`catalogueAliases.ts` records this exact observed pair. The adapter accepts it only within the runtime resolution of a successfully accepted start of the requested entry on the exact selected device. It preserves the actual reported ID, original library ID and original judgment identity, annotating the same runtime `resolvedFromTrackId` used by metadata proof. It is not a global or bidirectional equivalence. No-start/reloaded sessions, failed starts, exit, other devices and other IDs receive no exception. All unlisted pairs retain the metadata/linked-from rules above. This narrow compatibility fix relies on the owner's observed intended playback plus the catalogue pages, not matching names as an algorithm. Adding another pair requires its own observed evidence and independent review. Live acceptance of this fix remains the owner's next check under issue #20.

Evidence:
- https://github.com/Nelson-Jnrnd/music-explorer/issues/20
- https://open.spotify.com/track/47X95Rup7LOEaVIHWlkRUT
- https://open.spotify.com/track/0FjI1qnqhQbJNZn0zZRUZK

## Diagnostics and repeat

Default error summaries omit identifiers. An explicit Check playback also displays the expected and Web API-reported public track IDs, restricted to Spotify's 22-character base62 catalogue format. This distinguishes what the Web API reports from the Spotify app's Share link when confirmation fails. Missing or malformed IDs display as unavailable. Device/account identifiers, tokens and raw payloads remain excluded. The report stays in the existing local UI state, with no persistence or automatic transmission. This diagnostic supplies evidence; it does not relax confirmation or send player commands. Matching Share links alone are not proof of the Web API's reported identity.

Repeat-one remains preferred and the existing Replay fallback remains visible when repeat cannot be established. Album context can continue to another song if repeat fails; existing playback polling blocks rating and pauses confirmed mismatches, with up to the polling interval before detection. No playlist creation, queue mutation, new scopes or backend is introduced.

Sources:
- https://developer.spotify.com/documentation/web-api/reference/start-a-users-playback
- https://developer.spotify.com/documentation/web-api/concepts/track-relinking
- https://community.spotify.com/forum/en/discussion/7552922/web-api-me-player-play-returns-204-but-does-not-start-playback-and-clears-current-playback-desktop
- https://community.spotify.com/forum/en/discussion/7562011/me-player-play-with-body-does-not-start-song-on-android-spotify-app
