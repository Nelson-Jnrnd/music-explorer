import { useEffect, useRef, useState } from "react";
import { Music2 } from "lucide-react";
import type { SpotifyAdapter, TrackMetadata } from "../integrations/spotify";

export type DisplayTrack = {
  id: string;
  name: string;
  artists: string[];
  album: string;
};
const cache = new Map<string, TrackMetadata>();
export function clearMetadata() {
  cache.clear();
}
export function Cover({
  track,
  adapter,
  large = false,
}: {
  track: DisplayTrack;
  adapter: SpotifyAdapter | null;
  large?: boolean;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const [metadata, setMetadata] = useState<TrackMetadata | undefined>(
    cache.get(track.id),
  );
  useEffect(() => {
    setMetadata(cache.get(track.id));
    if (!adapter) return;
    let cancelled = false;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((x) => x.isIntersecting)) return;
      observer.disconnect();
      if (cache.has(track.id)) {
        setMetadata(cache.get(track.id));
        return;
      }
      void adapter
        .metadata(track.id)
        .then((value) => {
          cache.set(track.id, value);
          if (!cancelled) setMetadata(value);
        })
        .catch(() => {});
    });
    if (ref.current) observer.observe(ref.current);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [track.id, adapter]);
  return (
    <a
      ref={ref}
      className={`cover ${large ? "cover-large" : ""}`}
      href={`https://open.spotify.com/track/${track.id}`}
      target="_blank"
      rel="noreferrer"
      aria-label={`${metadata?.coverUrl ? "" : "Album art unavailable. "}Open ${track.name} on Spotify`}
    >
      {metadata?.coverUrl ? (
        <img
          src={metadata.coverUrl}
          alt={`${track.album || track.name} album cover`}
          loading="lazy"
          onError={() => setMetadata(undefined)}
        />
      ) : (
        <span className="cover-fallback">
          <Music2 aria-hidden="true" />
          <span>Album art unavailable</span>
        </span>
      )}
    </a>
  );
}
