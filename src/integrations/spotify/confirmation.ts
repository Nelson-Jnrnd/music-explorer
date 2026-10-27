import { expectedMatches } from "./auth";
import type { PlaybackState, SpotifyAdapter } from "./types";

/** Spotify may acknowledge a command before its playback state reflects it. */
export async function confirmPlayback(
  adapter: Pick<SpotifyAdapter, "state">,
  trackId: string,
  deviceId: string,
  isPlaying: boolean,
  wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
): Promise<PlaybackState | null> {
  let actual: PlaybackState | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await wait(750);
    actual = await adapter.state();
    if (expectedMatches(actual, trackId, deviceId) && actual?.isPlaying === isPlaying)
      return actual;
  }
  return actual;
}
