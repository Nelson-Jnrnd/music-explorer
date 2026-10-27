import { expect, it, vi } from "vitest";
import { confirmPlayback } from "./confirmation";
import type { PlaybackState } from "./types";
const playing: PlaybackState = { trackId: "candidate", deviceId: "phone", isPlaying: true, progressMs: 0, durationMs: 180000, repeat: "off" };
it("waits for delayed device/track/playing confirmation without resending commands", async () => {
  const state = vi.fn().mockResolvedValueOnce(null)
    .mockResolvedValueOnce({ ...playing, deviceId: "other" })
    .mockResolvedValueOnce({ ...playing, isPlaying: false })
    .mockResolvedValueOnce(playing);
  const wait = vi.fn(async () => undefined);
  expect(await confirmPlayback({ state }, "candidate", "phone", true, wait)).toEqual(playing);
  expect(state).toHaveBeenCalledTimes(4);
  expect(wait).toHaveBeenCalledTimes(3);
});
it.each([null, { ...playing, isPlaying: false }])("bounds unconfirmed state reads: %j", async (actual) => {
  const state = vi.fn(async () => actual);
  const wait = vi.fn(async () => undefined);
  expect(await confirmPlayback({ state }, "candidate", "phone", true, wait)).toEqual(actual);
  expect(state).toHaveBeenCalledTimes(4);
});
it("confirms a pause immediately and propagates API failures without busy retries", async () => {
  const state = vi.fn().mockResolvedValueOnce({ ...playing, isPlaying: false })
    .mockRejectedValueOnce(new Error("rate limited"));
  const wait = vi.fn(async () => undefined);
  await confirmPlayback({ state }, "candidate", "phone", false, wait);
  expect(wait).not.toHaveBeenCalled();
  await expect(confirmPlayback({ state }, "candidate", "phone", true, wait)).rejects.toThrow("rate limited");
  expect(state).toHaveBeenCalledTimes(2);
});
