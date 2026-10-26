import { useEffect, useState } from "react";
import type { PlaybackState } from "../integrations/spotify/types";

const clock = (ms: number) =>
  `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

export function PlaybackProgress({ playback }: { playback: PlaybackState | null }) {
  const [progress, setProgress] = useState(playback?.progressMs ?? 0);
  useEffect(() => {
    const receivedAt = performance.now();
    setProgress(playback?.progressMs ?? 0);
    if (!playback?.isPlaying) return;
    // Estimate display time only; rating confirmation still uses Spotify state.
    const timer = setInterval(() => {
      setProgress(Math.min(playback.durationMs,
        playback.progressMs + performance.now() - receivedAt));
    }, 250);
    return () => clearInterval(timer);
  }, [playback]);
  return (
    <div className="playback">
      <progress value={progress} max={playback?.durationMs || 1} aria-label="Playback progress" />
      <div className="playback-meta">
        <span>{clock(progress)} / {clock(playback?.durationMs ?? 0)}</span>
        <span>{playback?.repeat === "track" ? "Repeat one" : "Repeat unconfirmed · Replay available"}</span>
      </div>
    </div>
  );
}
