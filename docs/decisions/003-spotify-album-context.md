# Start tracks through their album context

Candidate starts and Replay use Spotify's documented `context_uri` album plus `offset.uri` track and `position_ms: 0`. Pause and ordinary Resume remain bodyless controls. Resolve the requested track with authenticated `GET /tracks/{id}?market=from_token` before changing playback. If album metadata is missing or Spotify explicitly reports the track unplayable, stop with an error before sending player commands.

The owner reported that direct track-list starts stop existing phone playback and leave no reported track, while the Spotify link works. Independent developers report this same recent regression and an album-context workaround. This is evidence for a compatibility change, not proof of the owner's root cause or a Spotify-confirmed incident.

A market replacement may have another ID. Accept identity only when Spotify reports `linked_from.id`, or when the adapter's successfully accepted start resolves that exact original request through authenticated track metadata to the reported ID on the selected device. This runtime association is cleared on exit. Do not compare titles or treat unrelated IDs/devices as equivalent. Diagnostics do not expose identifiers or persist this association.

Repeat-one remains preferred and the existing Replay fallback remains visible when repeat cannot be established. Album context can continue to another song if repeat fails; existing playback polling blocks rating and pauses confirmed mismatches, with up to the polling interval before detection. No playlist creation, queue mutation, new scopes or backend is introduced.

Sources:
- https://developer.spotify.com/documentation/web-api/reference/start-a-users-playback
- https://developer.spotify.com/documentation/web-api/concepts/track-relinking
- https://community.spotify.com/forum/en/discussion/7552922/web-api-me-player-play-returns-204-but-does-not-start-playback-and-clears-current-playback-desktop
- https://community.spotify.com/forum/en/discussion/7562011/me-player-play-with-body-does-not-start-song-on-android-spotify-app
