# Start tracks through their album context

Candidate starts and Replay use Spotify's documented `context_uri` album plus `offset.uri` track and `position_ms: 0`. Pause and ordinary Resume remain bodyless controls. Resolve the requested track with authenticated `GET /tracks/{id}?market=from_token` before changing playback. If album metadata is missing or Spotify explicitly reports the track unplayable, stop with an error before sending player commands.

The owner reported that direct track-list starts stop existing phone playback and leave no reported track, while the Spotify link works. Independent developers report this same recent regression and an album-context workaround. This is evidence for a compatibility change, not proof of the owner's root cause or a Spotify-confirmed incident.

A market replacement may have another ID. Accept identity only when Spotify reports `linked_from.id`, or when the adapter's successfully accepted start resolves that exact original request through authenticated track metadata to the reported ID on the selected device. If the player reports another ID without `linked_from`, resolve that reported ID with authenticated market metadata: accept only an exact match of its resolved ID or explicit `linked_from.id` to the requested/resolved candidate. Matching names, artists, ISRCs or album membership are not identity evidence. Explicitly unplayable metadata or a failed lookup supplies no proof. The playback endpoint already prioritizes the access token's account country; track metadata uses `market=from_token`.

Cache at most eight reported-ID lookup results (including in-flight requests) per accepted start, so polling does not repeatedly fetch stable aliases or unrelated IDs. Failed reads may retry. Clear the runtime association before every new start and on exit, and discard proof completed for an obsolete start. Exact device checks remain mandatory. Diagnostics do not expose identifiers or persist this association.

Repeat-one remains preferred and the existing Replay fallback remains visible when repeat cannot be established. Album context can continue to another song if repeat fails; existing playback polling blocks rating and pauses confirmed mismatches, with up to the polling interval before detection. No playlist creation, queue mutation, new scopes or backend is introduced.

Sources:
- https://developer.spotify.com/documentation/web-api/reference/start-a-users-playback
- https://developer.spotify.com/documentation/web-api/concepts/track-relinking
- https://community.spotify.com/forum/en/discussion/7552922/web-api-me-player-play-returns-204-but-does-not-start-playback-and-clears-current-playback-desktop
- https://community.spotify.com/forum/en/discussion/7562011/me-player-play-with-body-does-not-start-song-on-android-spotify-app
