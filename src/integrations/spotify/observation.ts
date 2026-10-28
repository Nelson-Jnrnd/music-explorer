import { trackIdentityMatches } from "./auth";
import type { PlaybackState } from "./types";

/** Local summary; explicit checks can include public catalogue IDs only. */
export function describePlayback(
  actual: PlaybackState | null,
  expectedTrackId: string,
  selectedDeviceId: string,
  includeTrackIds = false,
): string {
  const publicId = (id: string | undefined) => id && /^[A-Za-z0-9]{22}$/.test(id)
    ? id : "not available";
  const details = includeTrackIds
    ? ` Candidate track ID: ${publicId(expectedTrackId)}. Spotify-reported track ID: ${publicId(actual?.trackId)}.`
    : "";
  if (!actual) return `Spotify reports no track playback state.${details}`;
  return [
    `Spotify reports playback ${actual.isPlaying ? "playing" : "paused"}.`,
    `Track matches candidate: ${trackIdentityMatches(actual, expectedTrackId) ? "yes" : "no"}.`,
    `Device matches selection: ${actual.deviceId === selectedDeviceId ? "yes" : "no"}.`,
    `Original linked track matches candidate: ${actual.linkedFromTrackId
      ? actual.linkedFromTrackId === expectedTrackId ? "yes" : "no"
      : "not provided"}.`,
  ].join(" ") + details;
}
