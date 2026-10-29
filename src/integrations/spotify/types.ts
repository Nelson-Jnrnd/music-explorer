export interface Device {
  id: string;
  name: string;
  is_restricted?: boolean;
  is_active?: boolean;
}

export type RepeatMode = "off" | "context" | "track";

export interface PlaybackState {
  trackId: string;
  linkedFromTrackId?: string;
  // Runtime request association under the owner's accepted-command trust policy.
  acceptedForTrackId?: string;
  deviceId: string;
  isPlaying: boolean;
  progressMs: number;
  durationMs: number;
  repeat: RepeatMode;
}

export interface TrackMetadata {
  id: string;
  linkedFromTrackId?: string;
  name: string;
  artists: string[];
  album: string;
  albumUri?: string;
  isPlayable?: boolean;
  coverUrl?: string;
  spotifyUrl: string;
}

export interface SpotifyAdapter {
  devices(): Promise<Device[]>;
  play(trackId: string, deviceId: string): Promise<void>;
  pause(deviceId: string): Promise<void>;
  resume(deviceId: string): Promise<void>;
  state(): Promise<PlaybackState | null>;
  metadata(trackId: string): Promise<TrackMetadata>;
  exit(): Promise<void>;
}

export type Reconciliation = "confirmed" | "mismatch" | "uncertain";
