import { SpotifyApi } from './api';
import { expectedMatches } from './auth';
import type { Device, PlaybackState, Reconciliation, RepeatMode, SpotifyAdapter, TrackMetadata } from './types';

export class SpotifyPlaybackAdapter implements SpotifyAdapter {
  private readonly originalRepeat = new Map<string, RepeatMode>();
  private currentDeviceId: string | null = null;
  private repeatUnavailable = false;
  private operationTail: Promise<unknown> = Promise.resolve();

  constructor(private readonly api: SpotifyApi) {}

  private serialized<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationTail.then(operation, operation);
    this.operationTail = result.catch(() => undefined);
    return result;
  }

  devices(): Promise<Device[]> { return this.api.devices(); }

  play(trackId: string, deviceId: string): Promise<void> {
    return this.serialized(async () => {
      const device = (await this.api.devices()).find((candidate) => candidate.id === deviceId);
      if (!device) throw new Error('The selected Spotify device is unavailable. Choose an available device.');
      if (device.is_restricted) throw new Error('The selected Spotify device does not allow remote playback.');
      if (this.currentDeviceId && this.currentDeviceId !== deviceId) {
        const previousRepeat = this.originalRepeat.get(this.currentDeviceId);
        if (previousRepeat !== undefined) await this.api.repeat(previousRepeat, this.currentDeviceId);
        this.originalRepeat.delete(this.currentDeviceId);
      }
      if (this.currentDeviceId !== deviceId) await this.api.transferPlayback(deviceId);
      if (!this.originalRepeat.has(deviceId)) {
        const repeat = await this.api.repeatState();
        if (repeat === null) throw new Error('Spotify playback state is unavailable, so the current repeat setting cannot be saved.');
        this.originalRepeat.set(deviceId, repeat);
      }
      this.currentDeviceId = deviceId;
      this.repeatUnavailable = false;
      try {
        await this.api.repeat('track', deviceId);
      } catch {
        this.repeatUnavailable = true;
      }
      await this.api.play(trackId, deviceId);
    });
  }

  pause(deviceId: string): Promise<void> { return this.serialized(() => this.api.pause(deviceId)); }
  resume(deviceId: string): Promise<void> { return this.serialized(() => this.api.resume(deviceId)); }
  state(): Promise<PlaybackState | null> { return this.api.state(); }
  metadata(trackId: string): Promise<TrackMetadata> { return this.api.metadata(trackId); }

  repeatStatus(): 'track' | 'unavailable' { return this.repeatUnavailable ? 'unavailable' : 'track'; }

  reconcile(expectedTrackId: string, deviceId: string): Promise<Reconciliation> {
    return this.serialized(async () => {
      const current = await this.state();
      if (!current) return 'uncertain';
      if (!expectedMatches(current, expectedTrackId, deviceId) || !current.isPlaying) {
        await this.api.pause(current.deviceId);
        return 'mismatch';
      }
      return 'confirmed';
    });
  }

  exit(): Promise<void> {
    return this.serialized(async () => {
      for (const [deviceId, repeat] of this.originalRepeat) await this.api.repeat(repeat, deviceId);
      this.originalRepeat.clear();
      this.currentDeviceId = null;
      this.repeatUnavailable = false;
    });
  }
}

