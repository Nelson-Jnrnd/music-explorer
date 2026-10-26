import { SpotifyTokenProvider } from "./auth";
import type { Device, PlaybackState, RepeatMode, TrackMetadata } from "./types";

const API = "https://api.spotify.com/v1";
export class SpotifyApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "SpotifyApiError";
  }
}

type FetchLike = typeof fetch;
const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export class SpotifyApi {
  private commandTail: Promise<unknown> = Promise.resolve();
  private cooldown: Promise<void> | null = null;

  constructor(
    private readonly tokens: SpotifyTokenProvider,
    private readonly fetcher: FetchLike = (...args) => fetch(...args),
    private readonly wait: (milliseconds: number) => Promise<void> = sleep,
  ) {}

  private serialized<T>(command: () => Promise<T>): Promise<T> {
    const result = this.commandTail.then(command, command);
    this.commandTail = result.catch(() => undefined);
    return result;
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
    retry401 = true,
    retry429 = true,
  ): Promise<T | null> {
    const send = (token: string) =>
      this.fetcher(`${API}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(init.body ? { "Content-Type": "application/json" } : {}),
          ...init.headers,
        },
      });
    if (this.cooldown) await this.cooldown;
    let token = await this.tokens.accessToken();
    let response = await send(token);
    if (response.status === 401 && retry401) {
      token = await this.tokens.refreshAfterUnauthorized(token);
      response = await send(token);
    }
    if (response.status === 429 && retry429) {
      const seconds = parseRetryAfter(response.headers.get("Retry-After"));
      if (seconds !== undefined) {
        if (!this.cooldown) {
          this.cooldown = this.wait(seconds * 1000).finally(() => {
            this.cooldown = null;
          });
        }
        await this.cooldown;
        response = await send(token);
      }
    }
    if (response.status === 204) return null;
    if (response.status === 429) {
      throw new SpotifyApiError(
        429,
        "Spotify rate limit reached.",
        parseRetryAfter(response.headers.get("Retry-After")),
      );
    }
    if (!response.ok) {
      throw new SpotifyApiError(
        response.status,
        response.status === 403
          ? "Spotify denied this playback request. Check account eligibility and device restrictions."
          : `Spotify request failed (${response.status}).`,
      );
    }
    if (
      response.status === 202 ||
      response.headers.get("content-length") === "0"
    )
      return null;
    return (await response.json()) as T;
  }

  devices(): Promise<Device[]> {
    return this.request<{ devices: Array<Record<string, unknown>> }>(
      "/me/player/devices",
    ).then((data) =>
      (data?.devices ?? []).flatMap((device) =>
        typeof device.id === "string" && typeof device.name === "string"
          ? [
              {
                id: device.id,
                name: device.name,
                ...(typeof device.is_restricted === "boolean"
                  ? { is_restricted: device.is_restricted }
                  : {}),
                ...(typeof device.is_active === "boolean"
                  ? { is_active: device.is_active }
                  : {}),
              },
            ]
          : [],
      ),
    );
  }

  play(trackId: string, deviceId: string): Promise<void> {
    return this.serialized(async () => {
      await this.request(
        `/me/player/play?device_id=${encodeURIComponent(deviceId)}`,
        {
          method: "PUT",
          body: JSON.stringify({
            uris: [`spotify:track:${encodeURIComponent(trackId)}`],
          }),
        },
      );
    });
  }

  pause(deviceId: string): Promise<void> {
    return this.serialized(async () => {
      await this.request(
        `/me/player/pause?device_id=${encodeURIComponent(deviceId)}`,
        { method: "PUT" },
      );
    });
  }

  resume(deviceId: string): Promise<void> {
    return this.serialized(async () => {
      await this.request(
        `/me/player/play?device_id=${encodeURIComponent(deviceId)}`,
        { method: "PUT" },
      );
    });
  }

  repeat(mode: RepeatMode, deviceId: string): Promise<void> {
    return this.serialized(async () => {
      await this.request(
        `/me/player/repeat?state=${mode}&device_id=${encodeURIComponent(deviceId)}`,
        { method: "PUT" },
      );
    });
  }

  repeatState(): Promise<RepeatMode | null> {
    return this.request<Record<string, unknown>>("/me/player").then((data) => {
      const repeat = data?.repeat_state;
      return repeat === "off" || repeat === "context" || repeat === "track"
        ? repeat
        : null;
    });
  }

  transferPlayback(deviceId: string): Promise<void> {
    return this.serialized(async () => {
      await this.request("/me/player", {
        method: "PUT",
        body: JSON.stringify({ device_ids: [deviceId], play: false }),
      });
    });
  }

  state(): Promise<PlaybackState | null> {
    return this.request<Record<string, unknown>>("/me/player").then((data) => {
      if (
        !data ||
        typeof data.device !== "object" ||
        !data.device ||
        typeof data.item !== "object" ||
        !data.item
      )
        return null;
      const device = data.device as Record<string, unknown>;
      const item = data.item as Record<string, unknown>;
      if (typeof device.id !== "string" || typeof item.id !== "string")
        return null;
      const repeat = data.repeat_state;
      return {
        trackId: item.id,
        deviceId: device.id,
        isPlaying: data.is_playing === true,
        progressMs: typeof data.progress_ms === "number" ? data.progress_ms : 0,
        durationMs: typeof item.duration_ms === "number" ? item.duration_ms : 0,
        repeat: repeat === "track" || repeat === "context" ? repeat : "off",
      };
    });
  }

  metadata(trackId: string): Promise<TrackMetadata> {
    return this.request<Record<string, unknown>>(
      `/tracks/${encodeURIComponent(trackId)}`,
    ).then((data) => {
      if (!data || typeof data.id !== "string" || typeof data.name !== "string")
        throw new Error("Spotify returned no track metadata.");
      const album = data.album as
        { name?: unknown; images?: Array<{ url?: unknown }> } | undefined;
      const external = data.external_urls as { spotify?: unknown } | undefined;
      return {
        id: data.id,
        name: data.name,
        artists: Array.isArray(data.artists)
          ? data.artists.flatMap((artist) =>
              typeof artist?.name === "string" ? [artist.name] : [],
            )
          : [],
        album: typeof album?.name === "string" ? album.name : "",
        ...(typeof album?.images?.[0]?.url === "string"
          ? { coverUrl: album.images[0].url }
          : {}),
        spotifyUrl:
          typeof external?.spotify === "string"
            ? external.spotify
            : `https://open.spotify.com/track/${encodeURIComponent(data.id)}`,
      };
    });
  }
}

export function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds;
  const date = Date.parse(header);
  return Number.isNaN(date)
    ? undefined
    : Math.max(0, (date - Date.now()) / 1000);
}
