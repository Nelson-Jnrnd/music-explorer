import { describe, expect, it, vi } from "vitest";
import {
  beginLogin,
  completeLogin,
  disconnect,
  expectedMatches,
  isConnected,
  SpotifyTokenProvider,
} from "./auth";
import { SpotifyApi } from "./api";
import { SpotifyPlaybackAdapter } from "./adapter";
import type { PlaybackState } from "./types";

const ALBUM_URI = "spotify:album:0000000000000000000001";
const trackMetadata = (id: string) => ({ id, name: "Test track", artists: ["Test artist"], album: "Test album", albumUri: ALBUM_URI, spotifyUrl: `https://open.spotify.com/track/${id}` });

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}
const response = (
  status: number,
  body?: unknown,
  headers: Record<string, string> = {},
) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers,
  });

describe("Spotify browser integration", () => {
  it("creates PKCE authorization with minimum scopes and refuses localhost", async () => {
    const storage = new MemoryStorage();
    vi.stubGlobal("window", { sessionStorage: storage });
    const url = new URL(
      await beginLogin(
        "client",
        "https://example.test/music-explorer/callback",
      ),
    );
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("scope")).toBe(
      "user-read-playback-state user-modify-playback-state",
    );
    expect(url.searchParams.get("state")).toBeTruthy();
    await expect(
      beginLogin("client", "http://localhost:4173/callback"),
    ).rejects.toThrow("not localhost");
    vi.unstubAllGlobals();
  });

  it("rejects a mismatched OAuth state before exchanging a code", async () => {
    const storage = new MemoryStorage();
    vi.stubGlobal("window", { sessionStorage: storage });
    await beginLogin("client", "https://example.test/callback");
    const fetcher = vi.fn();
    await expect(
      completeLogin(
        {
          search: "?code=secret&state=wrong",
          href: "https://example.test/callback?code=secret&state=wrong",
        },
        { replaceState: vi.fn() },
        fetcher as unknown as typeof fetch,
      ),
    ).rejects.toThrow("state did not match");
    expect(fetcher).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("exchanges a matching PKCE callback without a client secret and keeps tokens in separate session keys", async () => {
    const storage = new MemoryStorage();
    vi.stubGlobal("window", { sessionStorage: storage });
    const loginUrl = new URL(
      await beginLogin("public-client-id", "https://example.test/callback"),
    );
    const state = loginUrl.searchParams.get("state")!;
    const history = { replaceState: vi.fn() };
    const fetcher = vi.fn(
      async (_url: RequestInfo | URL, init?: RequestInit) => {
        const body = String(init?.body);
        expect(body).toContain("code_verifier=");
        expect(body).not.toContain("client_secret");
        return response(200, {
          access_token: "access-value",
          refresh_token: "refresh-value",
          expires_in: 3600,
          token_type: "Bearer",
        });
      },
    ) as unknown as typeof fetch;
    await completeLogin(
      {
        search: `?code=one-time-code&state=${state}`,
        href: `https://example.test/callback?code=one-time-code&state=${state}`,
      },
      history,
      fetcher,
    );
    expect(fetcher).toHaveBeenCalledOnce();
    expect(history.replaceState).toHaveBeenCalledWith(
      {},
      "",
      "https://example.test/callback",
    );
    expect(storage.getItem("music-explorer.spotify.access-token")).toBe(
      "access-value",
    );
    expect(storage.getItem("music-explorer.spotify.refresh-token")).toBe(
      "refresh-value",
    );
    expect(
      storage.getItem("music-explorer.spotify.pkce-transaction"),
    ).toBeNull();
    expect(isConnected(storage)).toBe(true);
    vi.unstubAllGlobals();
  });

  it("refreshes once on 401 and stores access and refresh tokens separately", async () => {
    const storage = new MemoryStorage();
    storage.setItem("music-explorer.spotify.access-token", "expired");
    storage.setItem("music-explorer.spotify.refresh-token", "refresh");
    storage.setItem("music-explorer.spotify.expires-at", "0");
    storage.setItem("music-explorer.spotify.client-id", "client");
    let calls = 0;
    const fetcher = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).includes("/api/token"))
        return response(200, {
          access_token: "fresh",
          refresh_token: "rotated",
          expires_in: 3600,
          token_type: "Bearer",
        });
      calls++;
      return calls === 1 ? response(401) : response(200, { devices: [] });
    }) as unknown as typeof fetch;
    const api = new SpotifyApi(
      new SpotifyTokenProvider(storage, fetcher),
      fetcher,
    );
    await expect(api.devices()).resolves.toEqual([]);
    expect(storage.getItem("music-explorer.spotify.access-token")).toBe(
      "fresh",
    );
    expect(storage.getItem("music-explorer.spotify.refresh-token")).toBe(
      "rotated",
    );
    expect(calls).toBe(2);
    expect(isConnected(storage)).toBe(true);
    disconnect(storage);
    expect(isConnected(storage)).toBe(false);
  });

  it("honors Retry-After without polling and surfaces a second 429", async () => {
    const storage = new MemoryStorage();
    storage.setItem("music-explorer.spotify.access-token", "token");
    storage.setItem(
      "music-explorer.spotify.expires-at",
      String(Date.now() + 60_000),
    );
    const wait = vi.fn(async () => undefined);
    const fetcher = vi.fn(async () =>
      response(429, {}, { "Retry-After": "2" }),
    ) as unknown as typeof fetch;
    const api = new SpotifyApi(
      new SpotifyTokenProvider(storage, fetcher),
      fetcher,
      wait,
    );
    await expect(api.devices()).rejects.toMatchObject({ status: 429 });
    expect(wait).toHaveBeenCalledOnce();
    expect(wait).toHaveBeenCalledWith(2000);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("shares one Retry-After cooldown across concurrent API requests", async () => {
    const storage = new MemoryStorage();
    storage.setItem("music-explorer.spotify.access-token", "token");
    storage.setItem(
      "music-explorer.spotify.expires-at",
      String(Date.now() + 60_000),
    );
    let release!: () => void;
    const waitGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const wait = vi.fn(() => waitGate);
    let calls = 0;
    const fetcher = vi.fn(async () =>
      ++calls <= 2
        ? response(429, {}, { "Retry-After": "3" })
        : response(200, { devices: [] }),
    ) as unknown as typeof fetch;
    const api = new SpotifyApi(
      new SpotifyTokenProvider(storage, fetcher),
      fetcher,
      wait,
    );
    const results = Promise.all([api.devices(), api.devices()]);
    await vi.waitFor(() => expect(wait).toHaveBeenCalledOnce());
    release();
    await expect(results).resolves.toEqual([[], []]);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it("shares concurrent refresh requests", async () => {
    const storage = new MemoryStorage();
    storage.setItem("music-explorer.spotify.refresh-token", "refresh");
    storage.setItem("music-explorer.spotify.client-id", "client");
    let release!: (value: Response) => void;
    const tokenResponse = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const fetcher = vi.fn(() => tokenResponse) as unknown as typeof fetch;
    const provider = new SpotifyTokenProvider(storage, fetcher);
    const first = provider.accessToken(true);
    const second = provider.accessToken(true);
    await Promise.resolve();
    expect(fetcher).toHaveBeenCalledOnce();
    release(
      response(200, {
        access_token: "fresh",
        expires_in: 3600,
        token_type: "Bearer",
      }),
    );
    await expect(Promise.all([first, second])).resolves.toEqual([
      "fresh",
      "fresh",
    ]);
  });

  it("serializes playback commands and sends the selected device and track", async () => {
    const storage = new MemoryStorage();
    storage.setItem("music-explorer.spotify.access-token", "token");
    storage.setItem(
      "music-explorer.spotify.expires-at",
      String(Date.now() + 60_000),
    );
    const order: string[] = [];
    const fetcher = vi.fn(
      async (url: RequestInfo | URL, init?: RequestInit) => {
        order.push(`${init?.method}:${String(url)}`);
        return response(204);
      },
    ) as unknown as typeof fetch;
    const api = new SpotifyApi(
      new SpotifyTokenProvider(storage, fetcher),
      fetcher,
    );
    await Promise.all([
      api.pause("device one"),
      api.play("track/id", "device two", ALBUM_URI),
    ]);
    expect(order[0]).toContain("pause?device_id=device%20one");
    expect(order[1]).toContain("play?device_id=device%20two");
    expect(
      JSON.parse(
        (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls[1][1].body,
      ),
    ).toEqual({ context_uri: ALBUM_URI, offset: { uri: "spotify:track:track%2Fid" }, position_ms: 0 });
  });

  it("preserves and restores repeat-one on exit; unknown playback remains uncertain and mismatches pause", async () => {
    const state: PlaybackState = {
      trackId: "wanted",
      deviceId: "device",
      isPlaying: true,
      progressMs: 2,
      durationMs: 4,
      repeat: "context",
    };
    const api = {
      metadata: vi.fn(async (id: string) => trackMetadata(id)),
      devices: vi.fn(async () => [{ id: "device", name: "Desktop" }]),
      transferPlayback: vi.fn(async () => undefined),
      repeatState: vi.fn(async () => "context" as const),
      repeat: vi.fn(async () => undefined),
      play: vi.fn(async () => undefined),
      state: vi.fn(async () => state),
      pause: vi.fn(async () => undefined),
      resume: vi.fn(async () => undefined),
    } as unknown as SpotifyApi;
    const adapter = new SpotifyPlaybackAdapter(api);
    await adapter.play("wanted", "device");
    expect(api.transferPlayback).toHaveBeenCalledWith("device");
    expect(api.repeat).toHaveBeenNthCalledWith(1, "track", "device");
    await expect(adapter.reconcile("other", "device")).resolves.toBe(
      "mismatch",
    );
    expect(api.pause).toHaveBeenCalledWith("device");
    (api.state as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    await expect(adapter.reconcile("wanted", "device")).resolves.toBe(
      "uncertain",
    );
    await adapter.exit();
    expect(api.repeat).toHaveBeenLastCalledWith("context", "device");
  });

  it("keeps playback available when repeat mode is denied and reports the fallback", async () => {
    const api = {
      metadata: vi.fn(async (id: string) => trackMetadata(id)),
      devices: vi.fn(async () => [{ id: "device", name: "Desktop" }]),
      transferPlayback: vi.fn(async () => undefined),
      repeatState: vi.fn(async () => "off" as const),
      repeat: vi.fn(async () => {
        throw new Error("forbidden");
      }),
      play: vi.fn(async () => undefined),
    } as unknown as SpotifyApi;
    const adapter = new SpotifyPlaybackAdapter(api);
    await expect(adapter.play("candidate", "device")).resolves.toBeUndefined();
    expect(api.play).toHaveBeenCalledWith("candidate", "device", ALBUM_URI);
    expect(adapter.repeatStatus()).toBe("unavailable");
  });

  it("starts a cold session when Spotify has no current repeat state, without changing repeat mode", async () => {
    const api = {
      metadata: vi.fn(async (id: string) => trackMetadata(id)),
      devices: vi.fn(async () => [{ id: "device", name: "Desktop" }]),
      transferPlayback: vi.fn(async () => undefined),
      repeatState: vi.fn(async () => null),
      repeat: vi.fn(async () => undefined),
      play: vi.fn(async () => undefined),
    } as unknown as SpotifyApi;
    const adapter = new SpotifyPlaybackAdapter(api);
    await expect(
      adapter.play("first-track", "device"),
    ).resolves.toBeUndefined();
    expect(api.repeat).not.toHaveBeenCalled();
    expect(api.play).toHaveBeenCalledWith("first-track", "device", ALBUM_URI);
    expect(adapter.repeatStatus()).toBe("unavailable");
  });

  it("restores the previous device repeat setting before transferring to another device", async () => {
    const order: string[] = [];
    let repeatReads = 0;
    const api = {
      metadata: vi.fn(async (id: string) => trackMetadata(id)),
      devices: vi.fn(async () => [
        { id: "one", name: "One" },
        { id: "two", name: "Two" },
      ]),
      transferPlayback: vi.fn(async (id: string) => {
        order.push(`transfer:${id}`);
      }),
      repeatState: vi.fn(async () =>
        ++repeatReads === 1 ? ("context" as const) : ("off" as const),
      ),
      repeat: vi.fn(async (mode: string, id: string) => {
        order.push(`repeat:${mode}:${id}`);
      }),
      play: vi.fn(async (track: string, id: string) => {
        order.push(`play:${track}:${id}`);
      }),
    } as unknown as SpotifyApi;
    const adapter = new SpotifyPlaybackAdapter(api);
    await adapter.play("a", "one");
    await adapter.play("b", "two");
    expect(order).toEqual([
      "transfer:one",
      "play:a:one",
      "repeat:track:one",
      "repeat:context:one",
      "transfer:two",
      "play:b:two",
      "repeat:track:two",
    ]);
    await adapter.exit();
    expect(order.at(-1)).toBe("repeat:off:two");
  });

  it("requires exact track and device confirmation", () => {
    const state: PlaybackState = {
      trackId: "track",
      deviceId: "device",
      isPlaying: false,
      progressMs: 0,
      durationMs: 0,
      repeat: "off",
    };
    expect(expectedMatches(state, "track", "device")).toBe(true);
    expect(expectedMatches(null, "track", "device")).toBe(false);
    expect(expectedMatches(state, "other", "device")).toBe(false);
    expect(expectedMatches(state, "track", "other")).toBe(false);
  });
});

it("starts playback on an active phone without a redundant transfer", async () => {
  const api = {
    metadata: vi.fn(async (id: string) => trackMetadata(id)),
      devices: vi.fn(async () => [{ id: "phone", name: "Phone", is_active: true }]),
    transferPlayback: vi.fn(),
    repeatState: vi.fn(async () => "off" as const),
    repeat: vi.fn(async () => undefined),
    play: vi.fn(async () => undefined),
  } as unknown as SpotifyApi;
  await new SpotifyPlaybackAdapter(api).play("candidate", "phone");
  expect(api.transferPlayback).not.toHaveBeenCalled();
  expect(api.play).toHaveBeenCalledWith("candidate", "phone", ALBUM_URI);
});


it("still starts the candidate when reading optional repeat state fails", async () => {
  const api = {
    metadata: vi.fn(async (id: string) => trackMetadata(id)),
      devices: vi.fn(async () => [{ id: "phone", name: "Phone", is_active: true }]),
    repeatState: vi.fn(async () => { throw new Error("read denied"); }),
    repeat: vi.fn(),
    play: vi.fn(async () => undefined),
  } as unknown as SpotifyApi;
  const adapter = new SpotifyPlaybackAdapter(api);
  await expect(adapter.play("candidate", "phone")).resolves.toBeUndefined();
  expect(api.play).toHaveBeenCalledWith("candidate", "phone", ALBUM_URI);
  expect(api.repeat).not.toHaveBeenCalled();
  expect(adapter.repeatStatus()).toBe("unavailable");
});

it("reports a safe playback rejection reason without displaying arbitrary server data", async () => {
  const storage = new MemoryStorage();
  storage.setItem("music-explorer.spotify.access-token", "token");
  storage.setItem("music-explorer.spotify.expires-at", String(Date.now() + 60000));
  const fetcher = vi.fn()
    .mockResolvedValueOnce(response(403, { error: { reason: "PREMIUM_REQUIRED" } }))
    .mockResolvedValueOnce(response(403, { error: { message: "private-server-data", reason: "unexpected-secret" } }));
  const api = new SpotifyApi(new SpotifyTokenProvider(storage, fetcher), fetcher);
  await expect(api.play("candidate", "phone", ALBUM_URI)).rejects.toThrow("Spotify could not start playback (403). Spotify Premium is required.");
  await expect(api.play("candidate", "phone", ALBUM_URI)).rejects.toThrow("Spotify could not start playback (403). Check account eligibility and device restrictions.");
});

it.each([200, 201, 202, 204])("accepts status-only player acknowledgements (%s) without reading the body", async (status) => {
  const storage = new MemoryStorage();
  storage.setItem("music-explorer.spotify.access-token", "test-token");
  storage.setItem("music-explorer.spotify.expires-at", String(Date.now() + 60000));
  const fetcher = vi.fn(async () => new Response(status === 204 ? null : "opaque-command-ack", { status }));
  const api = new SpotifyApi(new SpotifyTokenProvider(storage, fetcher), fetcher);
  await expect(api.play("candidate", "phone", ALBUM_URI)).resolves.toBeUndefined();
  await expect(api.resume("phone")).resolves.toBeUndefined();
  await expect(api.pause("phone")).resolves.toBeUndefined();
  await expect(api.repeat("track", "phone")).resolves.toBeUndefined();
  await expect(api.transferPlayback("phone")).resolves.toBeUndefined();
  expect(fetcher).toHaveBeenCalledTimes(5);
});

it("rejects invalid data reads safely and identifies unreadable request operations", async () => {
  const storage = new MemoryStorage();
  storage.setItem("music-explorer.spotify.access-token", "test-token");
  storage.setItem("music-explorer.spotify.expires-at", String(Date.now() + 60000));
  const fetcher = vi.fn()
    .mockResolvedValueOnce(new Response("private-non-json-text", { status: 200 }))
    .mockRejectedValueOnce(new TypeError("Failed to fetch"))
    .mockRejectedValueOnce(new TypeError("Failed to fetch"));
  const api = new SpotifyApi(new SpotifyTokenProvider(storage, fetcher), fetcher);
  await expect(api.state()).rejects.toMatchObject({ kind: "response", message: "Spotify could not read playback state: it returned an invalid data response (200). Try again." });
  await expect(api.play("candidate", "phone", ALBUM_URI)).rejects.toMatchObject({ kind: "network", message: expect.stringContaining("start playback") });
  await expect(api.state()).rejects.toMatchObject({ kind: "network", message: expect.stringContaining("read playback state") });
  expect(fetcher).toHaveBeenCalledTimes(3); // No blind command retries.
});

it("does not mistake an HTTP rejection with a non-JSON body for a command acknowledgement", async () => {
  const storage = new MemoryStorage();
  storage.setItem("music-explorer.spotify.access-token", "test-token");
  storage.setItem("music-explorer.spotify.expires-at", String(Date.now() + 60000));
  const fetcher = vi.fn(async () => new Response("private-error", { status: 403 }));
  const api = new SpotifyApi(new SpotifyTokenProvider(storage, fetcher), fetcher);
  await expect(api.play("candidate", "phone", ALBUM_URI)).rejects.toMatchObject({ status: 403, kind: "http" });
});


it.each([200, 201, 202])("rejects an empty data GET response (%s) even with Content-Length zero", async (status) => {
  const storage = new MemoryStorage();
  storage.setItem("music-explorer.spotify.access-token", "test-token");
  storage.setItem("music-explorer.spotify.expires-at", String(Date.now() + 60000));
  const fetcher = vi.fn(async () => new Response(null, { status, headers: { "Content-Length": "0" } }));
  const api = new SpotifyApi(new SpotifyTokenProvider(storage, fetcher), fetcher);
  await expect(api.state()).rejects.toMatchObject({ kind: "response", status,
    message: `Spotify could not read playback state: it returned an invalid data response (${status}). Try again.` });
});

it("retains Spotify's linked original track as identity evidence", async () => {
  const storage = new MemoryStorage();
  storage.setItem("music-explorer.spotify.access-token", "test-token");
  storage.setItem("music-explorer.spotify.expires-at", String(Date.now() + 60000));
  const fetcher = vi.fn(async () => response(200, { device: { id: "phone" },
    item: { id: "replacement", linked_from: { id: "original" }, duration_ms: 1000 },
    is_playing: true, repeat_state: "off" }));
  const api = new SpotifyApi(new SpotifyTokenProvider(storage, fetcher), fetcher);
  const actual = await api.state();
  expect(actual).toMatchObject({ trackId: "replacement", linkedFromTrackId: "original" });
  expect(expectedMatches(actual, "original", "phone")).toBe(true);
});

it("sends Black Rain through its album and exact track offset, never a bare URI list", async () => {
  const storage = new MemoryStorage();
  storage.setItem("music-explorer.spotify.access-token", "test-token");
  storage.setItem("music-explorer.spotify.expires-at", String(Date.now() + 60000));
  const fetcher = vi.fn(async () => response(204));
  const api = new SpotifyApi(new SpotifyTokenProvider(storage, fetcher), fetcher);
  await api.play("5WiBOUfizLpHt0NY2V7XCn", "phone", ALBUM_URI);
  expect(fetcher.mock.calls).toHaveLength(1);
  const init = (fetcher.mock.calls[0] as unknown as [string, RequestInit])[1];
  expect(JSON.parse(init.body as string)).toEqual({
    context_uri: ALBUM_URI, // Synthetic album fixture; no live account claim.
    offset: { uri: "spotify:track:5WiBOUfizLpHt0NY2V7XCn" },
    position_ms: 0,
  });
});

function albumPlaybackApi() {
  const actual: PlaybackState = { trackId: "replacement", deviceId: "phone", isPlaying: true, progressMs: 0, durationMs: 1000, repeat: "track" };
  return {
    metadata: vi.fn(async () => trackMetadata("replacement")),
    devices: vi.fn(async () => [{ id: "phone", name: "Phone", is_active: false }]),
    transferPlayback: vi.fn(async () => undefined),
    repeatState: vi.fn(async () => "off" as const),
    repeat: vi.fn(async () => undefined),
    play: vi.fn(async () => undefined),
    pause: vi.fn(async () => undefined),
    state: vi.fn(async () => actual),
  };
}

it.each(["lookup-failed", "missing-album", "unplayable"])("does not change phone playback when metadata is %s", async (problem) => {
  const api = albumPlaybackApi();
  if (problem === "lookup-failed") api.metadata.mockRejectedValueOnce(new Error("lookup failed"));
  if (problem === "missing-album") api.metadata.mockResolvedValueOnce({ ...trackMetadata("replacement"), albumUri: "" });
  if (problem === "unplayable") api.metadata.mockResolvedValueOnce({ ...trackMetadata("replacement"), isPlayable: false } as ReturnType<typeof trackMetadata>);
  await expect(new SpotifyPlaybackAdapter(api as unknown as SpotifyApi).play("original", "phone")).rejects.toThrow();
  expect(api.play).not.toHaveBeenCalled();
  expect(api.transferPlayback).not.toHaveBeenCalled();
  expect(api.repeat).not.toHaveBeenCalled();
  expect(api.pause).not.toHaveBeenCalled();
});

it("confirms only the metadata-resolved original on the exact device, and clears resolution on exit", async () => {
  const api = albumPlaybackApi();
  const adapter = new SpotifyPlaybackAdapter(api as unknown as SpotifyApi);
  await adapter.play("original", "phone");
  expect(api.metadata).toHaveBeenCalledWith("original");
  expect(api.play).toHaveBeenCalledWith("replacement", "phone", ALBUM_URI);
  expect(expectedMatches(await adapter.state(), "original", "phone")).toBe(true);
  api.state.mockResolvedValueOnce({ ...(await api.state()), deviceId: "other" });
  expect(expectedMatches(await adapter.state(), "original", "phone")).toBe(false);
  api.state.mockResolvedValueOnce({ ...(await api.state()), trackId: "unrelated" });
  api.metadata.mockResolvedValueOnce(trackMetadata("unrelated"));
  expect(expectedMatches(await adapter.state(), "original", "phone")).toBe(false);
  await adapter.exit();
  expect(expectedMatches(await adapter.state(), "original", "phone")).toBe(false);
});

it("uses authenticated market metadata and retains album and availability fields", async () => {
  const storage = new MemoryStorage();
  storage.setItem("music-explorer.spotify.access-token", "test-token");
  storage.setItem("music-explorer.spotify.expires-at", String(Date.now() + 60000));
  const fetcher = vi.fn(async () => response(200, { id: "replacement", name: "Test", artists: [], is_playable: false, album: { name: "Album", uri: ALBUM_URI } }));
  const api = new SpotifyApi(new SpotifyTokenProvider(storage, fetcher), fetcher);
  await expect(api.metadata("original")).resolves.toMatchObject({ id: "replacement", albumUri: ALBUM_URI, isPlayable: false });
  expect(String((fetcher.mock.calls[0] as unknown as [string])[0])).toContain("/tracks/original?market=from_token");
});
