import { expect, it } from "vitest";
import { describePlayback } from "./observation";
import type { PlaybackState } from "./types";
const state: PlaybackState = { trackId: "private-track", deviceId: "private-device", isPlaying: false, progressMs: 0, durationMs: 1, repeat: "off" };
it("distinguishes no state, paused playback and mismatches without including identifiers", () => {
  expect(describePlayback(null, "expected", "selected")).toBe("Spotify reports no track playback state.");
  const report = describePlayback(state, "expected", "selected");
  expect(report).toContain("playback paused");
  expect(report).toContain("Track matches candidate: no");
  expect(report).toContain("Device matches selection: no");
  expect(report).not.toContain("private");
  expect(report).not.toContain("expected");
});
it("recognizes Spotify linked-original proof and reports it separately", () => {
  const report = describePlayback({ ...state, isPlaying: true, linkedFromTrackId: "expected" }, "expected", "private-device");
  expect(report).toContain("playback playing");
  expect(report).toContain("Track matches candidate: yes");
  expect(report).toContain("Device matches selection: yes");
  expect(report).toContain("Original linked track matches candidate: yes");
  expect(describePlayback(state, "private-track", "private-device")).toContain("Track matches candidate: yes");
});
