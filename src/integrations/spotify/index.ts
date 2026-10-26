export { beginLogin, completeLogin, disconnect, expectedMatches, isConnected, SpotifyTokenProvider } from './auth';
export { SpotifyApi, SpotifyApiError, parseRetryAfter } from './api';
export { SpotifyPlaybackAdapter } from './adapter';
export { SimulatedSpotifyAdapter } from './simulatedAdapter';
export type { Device, PlaybackState, Reconciliation, RepeatMode, SpotifyAdapter, TrackMetadata } from './types';
