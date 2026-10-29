import { expect, it, vi } from "vitest";
import { SpotifyApi, SpotifyApiError } from "./api";
import { SpotifyPlaybackAdapter } from "./adapter";
import { expectedMatches } from "./auth";
import type { PlaybackState } from "./types";

const state = (trackId = "reported", deviceId = "phone", isPlaying = true): PlaybackState => ({
  trackId, deviceId, isPlaying, progressMs: 1000, durationMs: 180000, repeat: "track",
});
function fixture() {
  let time = 0;
  const api = {
    devices: vi.fn(async () => [{ id: "phone", name: "Phone", is_active: true }]),
    metadata: vi.fn(async (id: string) => ({ id, name: "Fixture", artists: [], album: "Fixture",
      albumUri: "spotify:album:0000000000000000000001", spotifyUrl: "https://open.spotify.com/" })),
    play: vi.fn(async () => undefined), repeatState: vi.fn(async () => null),
    state: vi.fn(async (): Promise<PlaybackState | null> => state()),
    pause: vi.fn(), repeat: vi.fn(), transferPlayback: vi.fn(),
  };
  return { api, adapter: new SpotifyPlaybackAdapter(api as unknown as SpotifyApi, () => time),
    advance: (ms: number) => { time += ms; } };
}

it.each([
  ["57FP4k7tJYbUiYyhJUSGzA", "4VfkyTjwl5whB7xcl4jUnC"],
  ["47X95Rup7LOEaVIHWlkRUT", "0FjI1qnqhQbJNZn0zZRUZK"],
  ["unknown-request", "unknown-response"],
])("trusts acknowledged start %s -> %s without catalogue equivalence or hardcoded IDs", async (requested, reported) => {
  const { api, adapter, advance } = fixture();
  api.state.mockResolvedValue(state(reported));
  expect(expectedMatches(await adapter.state(), requested, "phone")).toBe(false);
  await adapter.play(requested, "phone");
  expect(expectedMatches(await adapter.state(), requested, "phone")).toBe(false); // Settling delay.
  advance(750);
  const actual = await adapter.state();
  expect(actual?.trackId).toBe(reported);
  expect(actual?.linkedFromTrackId).toBeUndefined();
  expect(expectedMatches(actual, requested, "phone")).toBe(true);
  advance(60000); // Bound ID remains usable after the acquisition window.
  api.state.mockResolvedValue(state(reported, "phone", false));
  expect(expectedMatches(await adapter.state(), requested, "phone")).toBe(true);
  expect(api.metadata).toHaveBeenCalledTimes(1); // Only pre-start album metadata.
  expect(api.play).toHaveBeenCalledTimes(1);
  expect(api.pause).not.toHaveBeenCalled();
});

it("does not bind missing, paused or wrong-device playback, but can still observe playing within the window", async () => {
  const { api, adapter, advance } = fixture();
  await adapter.play("candidate", "phone"); advance(750);
  for (const actual of [null, state("reported", "phone", false), state("reported", "other")]) {
    api.state.mockResolvedValueOnce(actual);
    expect(expectedMatches(await adapter.state(), "candidate", "phone")).toBe(false);
  }
  expect(expectedMatches(await adapter.state(), "candidate", "phone")).toBe(true);
});

it.each(["http", "network"] as const)("does not arm trust after %s start failure", async (kind) => {
  const { api, adapter, advance } = fixture();
  api.play.mockRejectedValueOnce(new SpotifyApiError(kind === "http" ? 403 : 0, "failed", undefined, kind));
  await expect(adapter.play("candidate", "phone")).rejects.toThrow(); advance(750);
  expect(expectedMatches(await adapter.state(), "candidate", "phone")).toBe(false);
});

it("expires pending trust and rejects a read that completes after the window", async () => {
  const { api, adapter, advance } = fixture();
  await adapter.play("candidate", "phone"); advance(750);
  let release!: (s: PlaybackState) => void;
  api.state.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
  const pending = adapter.state(); advance(5000); release(state());
  expect(expectedMatches(await pending, "candidate", "phone")).toBe(false);
  expect(expectedMatches(await adapter.state(), "candidate", "phone")).toBe(false);
});

it("latches only one ID and rejects later unrelated tracks or devices", async () => {
  const { api, adapter, advance } = fixture();
  await adapter.play("candidate", "phone"); advance(750);
  expect(expectedMatches(await adapter.state(), "candidate", "phone")).toBe(true);
  api.state.mockResolvedValueOnce(state("later-track"));
  expect(expectedMatches(await adapter.state(), "candidate", "phone")).toBe(false);
  api.state.mockResolvedValueOnce(state("reported", "other-phone"));
  expect(expectedMatches(await adapter.state(), "candidate", "phone")).toBe(false);
});

it("closes pending trust when exact identity already confirms the start", async () => {
  const { api, adapter, advance } = fixture();
  await adapter.play("candidate", "phone");
  api.state.mockResolvedValueOnce(state("candidate"));
  expect(expectedMatches(await adapter.state(), "candidate", "phone")).toBe(true);
  advance(750);
  expect(expectedMatches(await adapter.state(), "candidate", "phone")).toBe(false);
});

it("clears the association on new/failed starts and exit", async () => {
  const { api, adapter, advance } = fixture();
  await adapter.play("candidate", "phone"); advance(750);
  expect(expectedMatches(await adapter.state(), "candidate", "phone")).toBe(true);
  api.metadata.mockRejectedValueOnce(new Error("album read failed"));
  await expect(adapter.play("next", "phone")).rejects.toThrow();
  expect(expectedMatches(await adapter.state(), "candidate", "phone")).toBe(false);
  await adapter.play("next", "phone"); advance(750);
  expect(expectedMatches(await adapter.state(), "next", "phone")).toBe(true);
  expect(expectedMatches(await adapter.state(), "candidate", "phone")).toBe(false);
  await adapter.exit();
  expect(expectedMatches(await adapter.state(), "next", "phone")).toBe(false);
});

it("does not annotate reads started before a new acknowledgement or before exit", async () => {
  const { api, adapter, advance } = fixture();
  for (const operation of ["first-start", "new-start", "exit"]) {
    let release!: (s: PlaybackState) => void;
    api.state.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    const pending = adapter.state();
    if (operation === "exit") await adapter.exit();
    else await adapter.play(operation, "phone");
    advance(750); release(state());
    expect((await pending)?.acceptedForTrackId).toBeUndefined();
  }
});

it("does not arm trust while the play acknowledgement is still pending", async () => {
  const { api, adapter, advance } = fixture();
  let release!: () => void;
  api.play.mockImplementationOnce(() => new Promise<undefined>((resolve) => { release = () => resolve(undefined); }));
  const play = adapter.play("candidate", "phone");
  await vi.waitFor(() => expect(api.play).toHaveBeenCalledOnce()); advance(750);
  expect(expectedMatches(await adapter.state(), "candidate", "phone")).toBe(false);
  release(); await play; advance(750);
  expect(expectedMatches(await adapter.state(), "candidate", "phone")).toBe(true);
});
