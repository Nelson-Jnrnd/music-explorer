// Exact requested -> reported catalogue pair observed by the owner in #20.
// Evidence and limits: docs/decisions/003-spotify-album-context.md.
// This is directional; it is not a title-based or general audio/video matcher.
export function isKnownPlaybackAlias(requested: string, reported: string): boolean {
  return requested === "47X95Rup7LOEaVIHWlkRUT" &&
    reported === "0FjI1qnqhQbJNZn0zZRUZK";
}
