import type { State, Track } from '../domain/model';
import { pathNodes } from '../domain/engine';

/** Uses only explicit live Fits judgments whose reference context lies on this recent path. */
export function selectCandidate(state: State, nodeId: string): Track | null {
  const path = pathNodes(state, nodeId), recent = path.slice(-state.settings.recentPathWindow);
  const contextWeight = new Map(recent.map((node, i) => [node.spotifyTrackId, i + 1]));
  const evaluatedHere = new Set(state.evaluations.filter(e => e.contextNodeId === nodeId && !e.undoneByEventId).map(e => e.candidateSpotifyTrackId));
  const unavailable = new Set([...evaluatedHere, ...(state.candidateQueues[nodeId]?.seenTrackIds ?? []), ...recent.map(n => n.spotifyTrackId)]);
  const scores = new Map<string, number>();
  for (const evaluation of state.evaluations) {
    if (evaluation.verdict !== 'fits' || evaluation.undoneByEventId || unavailable.has(evaluation.candidateSpotifyTrackId)) continue;
    const weight = evaluation.recentPathNodeIds.reduce((sum, id) => {
      const reference = state.nodes.find(node => node.id === id);
      return sum + (reference ? (contextWeight.get(reference.spotifyTrackId) ?? 0) : 0);
    }, 0);
    if (weight) scores.set(evaluation.candidateSpotifyTrackId, (scores.get(evaluation.candidateSpotifyTrackId) ?? 0) + weight);
  }
  if (scores.size) {
    const ranked = [...scores].sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return state.tracks[ranked[0][0]] ?? null;
  }
  // No explicit contextual example exists: rotate deterministically through library order.
  const eligible = Object.values(state.tracks).filter(t => !unavailable.has(t.id));
  if (!eligible.length) return null;
  const start = (state.candidateQueues[nodeId]?.seenTrackIds.length ?? 0) % eligible.length;
  return eligible[start];
}
