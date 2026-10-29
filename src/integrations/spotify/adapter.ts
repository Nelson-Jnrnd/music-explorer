import { SpotifyApi } from "./api";
import { expectedMatches, trackIdentityMatches } from "./auth";
import type {
  Device,
  PlaybackState,
  Reconciliation,
  RepeatMode,
  SpotifyAdapter,
  TrackMetadata,
} from "./types";

export class SpotifyPlaybackAdapter implements SpotifyAdapter {
  private readonly originalRepeat = new Map<string, RepeatMode>();
  private currentDeviceId: string | null = null;
  private repeatUnavailable = false;
  private resolution: {
    requested: string;
    resolved: string;
    device: string;
    reported: string | null;
    acceptAfter: number;
    acceptUntil: number;
  } | null = null;
  private operationTail: Promise<unknown> = Promise.resolve();

  constructor(private readonly api: SpotifyApi, private readonly now = () => Date.now()) {}

  private serialized<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationTail.then(operation, operation);
    this.operationTail = result.catch(() => undefined);
    return result;
  }

  devices(): Promise<Device[]> {
    return this.api.devices();
  }

  play(trackId: string, deviceId: string): Promise<void> {
    return this.serialized(async () => {
      // Invalidate evidence before awaiting the next start, including failed starts.
      this.resolution = null;
      const device = (await this.api.devices()).find(
        (candidate) => candidate.id === deviceId,
      );
      if (!device)
        throw new Error(
          "The selected Spotify device is unavailable. Choose an available device.",
        );
      if (device.is_restricted)
        throw new Error(
          "The selected Spotify device does not allow remote playback.",
        );
      // Resolve the album before any player mutation. Bare URI lists currently
      // fail on affected Spotify clients; album context + track offset works.
      const metadata = await this.api.metadata(trackId);
      if (!metadata?.albumUri || !/^spotify:album:[A-Za-z0-9]{22}$/.test(metadata.albumUri) || !metadata.id)
        throw new Error("Spotify did not return the album needed to start this track. Use Listen on Spotify, or try another candidate.");
      if (metadata.isPlayable === false)
        throw new Error("Spotify reports this track is unavailable for your account. Use Listen on Spotify, or try another candidate.");
      if (this.currentDeviceId && this.currentDeviceId !== deviceId) {
        const previousRepeat = this.originalRepeat.get(this.currentDeviceId);
        if (previousRepeat !== undefined)
          await this.api.repeat(previousRepeat, this.currentDeviceId);
        this.originalRepeat.delete(this.currentDeviceId);
      }
      // Spotify does not guarantee execution order across player endpoints.
      // Avoid a redundant transfer before starting an already active device.
      if (!device.is_active) await this.api.transferPlayback(deviceId);
      if (!this.originalRepeat.has(deviceId)) {
        // Repeat is optional. A failed read must not prevent the play request.
        try {
          const repeat = await this.api.repeatState();
          if (repeat !== null) this.originalRepeat.set(deviceId, repeat);
        } catch {
          // Without a saved setting, leave repeat unchanged and offer Replay.
        }
      }
      this.currentDeviceId = deviceId;
      this.repeatUnavailable = true;
      await this.api.play(metadata.id, deviceId, metadata.albumUri);
      if (this.originalRepeat.has(deviceId)) {
        try {
          await this.api.repeat("track", deviceId);
          this.repeatUnavailable = false;
        } catch {
          // Playback still works when Spotify refuses repeat mode.
        }
      }
      // The owner trusts Spotify's successful start acknowledgement. Bind one
      // playing report shortly after this operation returns, even if its ID differs.
      const acceptedAt = this.now();
      this.resolution = { requested: trackId, resolved: metadata.id, device: deviceId,
        reported: null, acceptAfter: acceptedAt + 750, acceptUntil: acceptedAt + 5000 };
    });
  }

  pause(deviceId: string): Promise<void> {
    return this.serialized(() => this.api.pause(deviceId));
  }
  resume(deviceId: string): Promise<void> {
    return this.serialized(() => this.api.resume(deviceId));
  }
  async state(): Promise<PlaybackState | null> {
    const resolution = this.resolution;
    const readStartedAt = this.now();
    const state = await this.api.state();
    if (!state || !resolution || this.resolution !== resolution ||
        state.deviceId !== resolution.device) return state;
    const knownIdentity = state.trackId === resolution.resolved || trackIdentityMatches(state, resolution.requested);
    if (resolution.reported === null && state.isPlaying && (knownIdentity || (
        readStartedAt >= resolution.acceptAfter && readStartedAt <= resolution.acceptUntil &&
        this.now() <= resolution.acceptUntil)))
      resolution.reported = state.trackId;
    if (state.trackId === resolution.reported || knownIdentity)
      return { ...state, acceptedForTrackId: resolution.requested };
    return state;
  }
  metadata(trackId: string): Promise<TrackMetadata> {
    return this.api.metadata(trackId);
  }

  repeatStatus(): "track" | "unavailable" {
    return this.repeatUnavailable ? "unavailable" : "track";
  }

  reconcile(
    expectedTrackId: string,
    deviceId: string,
  ): Promise<Reconciliation> {
    return this.serialized(async () => {
      const current = await this.state();
      if (!current) return "uncertain";
      if (
        !expectedMatches(current, expectedTrackId, deviceId) ||
        !current.isPlaying
      ) {
        await this.api.pause(current.deviceId);
        return "mismatch";
      }
      return "confirmed";
    });
  }

  exit(): Promise<void> {
    return this.serialized(async () => {
      this.resolution = null;
      for (const [deviceId, repeat] of this.originalRepeat)
        await this.api.repeat(repeat, deviceId);
      this.originalRepeat.clear();
      this.currentDeviceId = null;
      this.repeatUnavailable = false;
    });
  }
}
