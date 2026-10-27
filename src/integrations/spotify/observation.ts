import type { PlaybackState } from "./types";

/** A local, identifier-free snapshot for troubleshooting a playback check. */
export function describePlayback(
  actual: PlaybackState | null,
  expectedTrackId: string,
  selectedDeviceId: string,
): string {
  if (!actual) return "Spotify reports no track playback state.";
  return [
    `Spotify reports playback ${actual.isPlaying ? "playing" : "paused"}.`,
    `Track matches candidate: ${actual.trackId === expectedTrackId ? "yes" : "no"}.`,
    `Device matches selection: ${actual.deviceId === selectedDeviceId ? "yes" : "no"}.`,
    `Original linked track matches candidate: ${actual.linkedFromTrackId
      ? actual.linkedFromTrackId === expectedTrackId ? "yes" : "no"
      : "not provided"}.`,
  ].join(" ");
}
