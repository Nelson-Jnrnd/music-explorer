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

it("includes only validated public catalogue IDs in an explicit check", () => {
  const candidate = "47X95Rup7LOEaVIHWlkRUT";
  const reported = "5WiBOUfizLpHt0NY2V7XCn";
  const report = describePlayback({ ...state, trackId: reported }, candidate, "selected", true);
  expect(report).toContain(`Candidate track ID: ${candidate}. Spotify-reported track ID: ${reported}.`);
  expect(report).toContain("Track matches candidate: no");
  expect(report).not.toContain("private-device");
  expect(describePlayback({ ...state, trackId: candidate }, candidate, "selected", true)).toContain("Track matches candidate: yes");
  expect(describePlayback(null, candidate, "selected", true)).toBe(`Spotify reports no track playback state. Candidate track ID: ${candidate}. Spotify-reported track ID: not available.`);
  expect(describePlayback(state, "malformed-secret", "selected", true)).toContain("Candidate track ID: not available. Spotify-reported track ID: not available.");
  expect(describePlayback(state, "malformed-secret", "selected", true)).not.toContain("secret");
});
