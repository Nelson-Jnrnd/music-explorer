import type { Device, PlaybackState, SpotifyAdapter, TrackMetadata } from './types';

/** Deterministic player stub for Playwright and end-to-end flows only. */
export class SimulatedSpotifyAdapter implements SpotifyAdapter {
  private current: PlaybackState | null = null;
  private readonly availableDevices: Device[] = [{ id: 'simulated-device', name: 'Simulated Spotify device', is_active: true }];

  async devices(): Promise<Device[]> { return this.availableDevices.map((device) => ({ ...device })); }
  async play(trackId: string, deviceId: string): Promise<void> {
    this.current = { trackId, deviceId, isPlaying: true, progressMs: 0, durationMs: 180_000, repeat: 'track' };
  }
  async pause(): Promise<void> { if (this.current) this.current = { ...this.current, isPlaying: false }; }
  async resume(): Promise<void> { if (this.current) this.current = { ...this.current, isPlaying: true }; }
  async state(): Promise<PlaybackState | null> { return this.current && { ...this.current }; }
  async metadata(trackId: string): Promise<TrackMetadata> {
    return { id: trackId, name: `Simulated track ${trackId}`, artists: ['Example artist'], album: 'Example album', spotifyUrl: `https://open.spotify.com/track/${trackId}` };
  }
  async exit(): Promise<void> { this.current = null; }
}
