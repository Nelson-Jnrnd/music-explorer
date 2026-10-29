import { expect, it, vi } from "vitest";
import { SpotifyApi } from "./api";
import { SpotifyPlaybackAdapter } from "./adapter";
import { expectedMatches, SpotifyTokenProvider } from "./auth";
import type { PlaybackState, TrackMetadata } from "./types";

// Owner's failing link; all other IDs and the album are synthetic fixtures.
const candidate = "47X95Rup7LOEaVIHWlkRUT";
const metadata = (id: string): TrackMetadata => ({
  id, name: "She's A Big Boy", artists: ["Mcbaise"], album: "Fixture",
  albumUri: "spotify:album:0000000000000000000001", spotifyUrl: "https://open.spotify.com/",
});
const state = (trackId = "player-id", deviceId = "phone"): PlaybackState => ({
  trackId, deviceId, isPlaying: true, progressMs: 1000, durationMs: 180000, repeat: "track",
});
function fixture() {
  const api = {
    devices: vi.fn(async () => [{ id: "phone", name: "Phone", is_active: true }]),
    metadata: vi.fn(async (id: string) => metadata(id === candidate ? "canonical" : id)),
    play: vi.fn(async () => undefined), repeatState: vi.fn(async () => null),
    state: vi.fn(async (): Promise<PlaybackState | null> => state()),
    pause: vi.fn(), repeat: vi.fn(), transferPlayback: vi.fn(),
  };
  return { api, adapter: new SpotifyPlaybackAdapter(api as unknown as SpotifyApi) };
}

it("confirms the owner's exact observed catalogue pair only after accepted start, and preserves the reported ID", async () => {
  const { api, adapter } = fixture();
  const reported = "0FjI1qnqhQbJNZn0zZRUZK";
  api.metadata.mockImplementation(async (id) => metadata(id)); // Neither ID relinks.
  api.state.mockResolvedValue(state(reported));
  expect(expectedMatches(await adapter.state(), candidate, "phone")).toBe(false);
  await adapter.play(candidate, "phone");
  const actual = await adapter.state();
  expect(actual?.trackId).toBe(reported);
  expect(actual?.linkedFromTrackId).toBeUndefined();
  expect(expectedMatches(actual, candidate, "phone")).toBe(true);
  expect(api.metadata).toHaveBeenCalledTimes(1); // No missing metadata link is required.
  api.state.mockResolvedValueOnce(state(reported, "another-phone"));
  expect(expectedMatches(await adapter.state(), candidate, "phone")).toBe(false);
  api.state.mockResolvedValueOnce(state("unlisted-same-name"));
  expect(expectedMatches(await adapter.state(), candidate, "phone")).toBe(false);
  await adapter.exit();
  expect(expectedMatches(await adapter.state(), candidate, "phone")).toBe(false);
});

it("does not reverse the observed pair or retain it after a failed start or another candidate", async () => {
  const { api, adapter } = fixture();
  const reported = "0FjI1qnqhQbJNZn0zZRUZK";
  api.metadata.mockImplementation(async (id) => metadata(id));
  api.state.mockResolvedValue(state(reported));
  await adapter.play(candidate, "phone");
  expect(expectedMatches(await adapter.state(), candidate, "phone")).toBe(true);
  api.play.mockRejectedValueOnce(new Error("start failed"));
  await expect(adapter.play(candidate, "phone")).rejects.toThrow("start failed");
  expect(expectedMatches(await adapter.state(), candidate, "phone")).toBe(false);
  await adapter.play("another-candidate", "phone");
  expect(expectedMatches(await adapter.state(), "another-candidate", "phone")).toBe(false);
  await adapter.play(reported, "phone");
  api.state.mockResolvedValue(state(candidate));
  expect(expectedMatches(await adapter.state(), reported, "phone")).toBe(false);
});

it.each(["canonical", "linked-original"])("confirms missing player linked_from through authenticated %s proof, without player commands", async (proof) => {
  const { api, adapter } = fixture();
  await adapter.play(candidate, "phone");
  api.metadata.mockResolvedValueOnce(proof === "canonical"
    ? metadata("canonical") : { ...metadata("player-id"), linkedFromTrackId: candidate });
  const actual = await adapter.state();
  expect(actual?.linkedFromTrackId).toBeUndefined(); // Do not invent Spotify's field.
  expect(expectedMatches(actual, candidate, "phone")).toBe(true);
  expect(expectedMatches(await adapter.state(), candidate, "phone")).toBe(true);
  expect(api.metadata).toHaveBeenCalledTimes(2); // Start + one alias read, then cache.
  expect(api.play).toHaveBeenCalledTimes(1);
  expect(api.pause).not.toHaveBeenCalled();
  expect(api.transferPlayback).not.toHaveBeenCalled();
});

it("rejects an unrelated ID with identical names, caches the rejection, and never accepts another device", async () => {
  const { api, adapter } = fixture();
  await adapter.play(candidate, "phone");
  expect(expectedMatches(await adapter.state(), candidate, "phone")).toBe(false);
  expect(expectedMatches(await adapter.state(), candidate, "phone")).toBe(false);
  expect(api.metadata).toHaveBeenCalledTimes(2);
  api.state.mockResolvedValueOnce(state("canonical", "other-phone"));
  expect(expectedMatches(await adapter.state(), candidate, "phone")).toBe(false);
  expect(api.metadata).toHaveBeenCalledTimes(2);
  api.state.mockResolvedValueOnce(null);
  expect(await adapter.state()).toBeNull();
});

it("does not confirm failed or explicitly unplayable metadata; failed reads can retry", async () => {
  const { api, adapter } = fixture();
  await adapter.play(candidate, "phone");
  api.metadata.mockRejectedValueOnce(new Error("network"));
  expect(expectedMatches(await adapter.state(), candidate, "phone")).toBe(false);
  api.metadata.mockResolvedValueOnce({ ...metadata("canonical"), isPlayable: false });
  expect(expectedMatches(await adapter.state(), candidate, "phone")).toBe(false);
  expect(expectedMatches(await adapter.state(), candidate, "phone")).toBe(false);
  expect(api.metadata).toHaveBeenCalledTimes(3);
});

it("coalesces concurrent alias reads and discards their proof when a new start fails", async () => {
  const { api, adapter } = fixture();
  await adapter.play(candidate, "phone");
  let release!: (value: TrackMetadata) => void;
  api.metadata.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
  const reads = [adapter.state(), adapter.state()];
  await vi.waitFor(() => expect(api.metadata).toHaveBeenCalledTimes(2));
  api.metadata.mockRejectedValueOnce(new Error("next start lookup failed"));
  await expect(adapter.play("next-candidate", "phone")).rejects.toThrow();
  release(metadata("canonical"));
  for (const result of await Promise.all(reads))
    expect(expectedMatches(result, candidate, "phone")).toBe(false);
  expect(expectedMatches(await adapter.state(), candidate, "phone")).toBe(false);
});

it("discards in-flight alias proof on exit and clears successful proof on the next start", async () => {
  const { api, adapter } = fixture();
  await adapter.play(candidate, "phone");
  let release!: (value: TrackMetadata) => void;
  api.metadata.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
  const read = adapter.state();
  await vi.waitFor(() => expect(api.metadata).toHaveBeenCalledTimes(2));
  await adapter.exit();
  release(metadata("canonical"));
  expect(expectedMatches(await read, candidate, "phone")).toBe(false);
  await adapter.play(candidate, "phone");
  api.metadata.mockResolvedValueOnce(metadata("canonical"));
  expect(expectedMatches(await adapter.state(), candidate, "phone")).toBe(true);
  await adapter.play("next-candidate", "phone");
  expect(expectedMatches(await adapter.state(), "next-candidate", "phone")).toBe(false);
});

it("does not apply a new start's proof to a playback read begun before that start", async () => {
  const { api, adapter } = fixture();
  await adapter.play(candidate, "phone");
  let release!: (value: PlaybackState) => void;
  api.state.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
  const read = adapter.state();
  await adapter.play("next-candidate", "phone");
  release(state("next-candidate"));
  expect((await read)?.resolvedFromTrackId).toBeUndefined();
});

it("bounds alias lookups to eight runtime entries per start", async () => {
  const { api, adapter } = fixture();
  await adapter.play(candidate, "phone");
  for (let n = 0; n < 9; n++) {
    api.state.mockResolvedValueOnce(state(`unrelated-${n}`));
    expect(expectedMatches(await adapter.state(), candidate, "phone")).toBe(false);
  }
  api.state.mockResolvedValueOnce(state("unrelated-8"));
  await adapter.state();
  expect(api.metadata).toHaveBeenCalledTimes(10);
  api.state.mockResolvedValueOnce(state("unrelated-0"));
  await adapter.state();
  expect(api.metadata).toHaveBeenCalledTimes(11); // Oldest entry was evicted.
});

it("retains metadata linked_from separately from the canonical ID", async () => {
  const storage = { getItem: (key: string) => key.endsWith("access-token") ? "fixture" : String(Date.now() + 60000), setItem: vi.fn(), removeItem: vi.fn() };
  const fetcher = vi.fn(async () => new Response(JSON.stringify({
    id: "canonical", name: "Fixture", linked_from: { id: candidate },
  }), { status: 200 }));
  const api = new SpotifyApi(new SpotifyTokenProvider(storage, fetcher), fetcher);
  expect(await api.metadata("player-id")).toMatchObject({ id: "canonical", linkedFromTrackId: candidate });
  expect(fetcher.mock.calls[0]).toBeDefined();
});
