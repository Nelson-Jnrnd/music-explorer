import type { State, Track } from "../domain/model";
import { pathNodes } from "../domain/engine";

export type CandidateMode = "close" | "boundary" | "informative";
export type CandidateExplanation = { mode: CandidateMode; reason: string };
type Evidence = {
  fits: number;
  no: number;
  uncertain: number;
  references: string[];
};
const text = (value: unknown) =>
  typeof value === "string" ? value.toLowerCase().trim() : "";
function historicalEvidence(row: Record<string, unknown>) {
  const referenceId = String(
    row.originalReferenceId ??
      row.referenceId ??
      row.reference_track_id ??
      row.referenceSpotifyTrackId ??
      row.referenceTrackId ??
      "",
  ).trim();
  const candidateId = String(
    row.candidateSpotifyTrackId ??
      row.candidateTrackId ??
      row.candidateId ??
      row.comparedTrackId ??
      "",
  ).trim();
  const verdict = text(
    row.verdict ?? row.judgment ?? row.rating ?? row.decision ?? row.outcome,
  );
  return { referenceId, candidateId, verdict };
}
function context(state: State, nodeId: string) {
  const recent = pathNodes(state, nodeId).slice(
    -state.settings.recentPathWindow,
  );
  const byTrack = new Map(
    recent.map((node, i) => [node.spotifyTrackId, i + 1]),
  );
  const excluded = new Set<string>(
    state.candidateQueues[nodeId]?.seenTrackIds ?? [],
  );
  for (const evaluation of state.evaluations) {
    if (!evaluation.undoneByEventId && evaluation.contextNodeId === nodeId)
      excluded.add(evaluation.candidateSpotifyTrackId);
  }
  const evidence = new Map<string, Evidence>();
  const add = (candidateId: string, verdict: string, referenceId: string) => {
    const weight = byTrack.get(referenceId) ?? 0;
    if (!weight) return;
    const item = evidence.get(candidateId) ?? {
      fits: 0,
      no: 0,
      uncertain: 0,
      references: [],
    };
    if (["fits", "yes", "like"].includes(verdict)) item.fits += weight;
    else if (["no", "not_fit", "not fit"].includes(verdict)) item.no += weight;
    else if (["maybe", "unsure", "uncertain"].includes(verdict))
      item.uncertain += weight;
    if (!item.references.includes(referenceId))
      item.references.push(referenceId);
    evidence.set(candidateId, item);
  };
  for (const evaluation of state.evaluations) {
    if (evaluation.undoneByEventId || evaluation.verdict === "skip") continue;
    for (const referenceNodeId of evaluation.recentPathNodeIds) {
      const reference = state.nodes.find((n) => n.id === referenceNodeId);
      if (
        reference &&
        reference.spotifyTrackId === evaluation.candidateSpotifyTrackId
      )
        continue;
      if (reference)
        add(
          evaluation.candidateSpotifyTrackId,
          evaluation.verdict,
          reference.spotifyTrackId,
        );
    }
  }
  for (const row of state.historicalReferenceComparisons) {
    const h = historicalEvidence(row);
    if (h.candidateId && h.referenceId)
      add(h.candidateId, h.verdict, h.referenceId);
  }
  const currentPath = new Set(recent.map((node) => node.spotifyTrackId));
  for (const id of currentPath) excluded.add(id);
  return { recent, byTrack, excluded, evidence };
}
function modePool(state: State, nodeId: string, mode: CandidateMode): Track[] {
  const c = context(state, nodeId),
    q = state.candidateQueues[nodeId];
  const unavailable = new Set([...c.excluded, ...(q?.seenTrackIds ?? [])]);
  const eligible = Object.values(state.tracks).filter(
    (track) => !unavailable.has(track.id),
  );
  const candidates = eligible.filter((track) => {
    const e = c.evidence.get(track.id);
    if (mode === "close") return !!e && e.fits > e.no && e.fits > 0;
    if (mode === "boundary")
      return !!e && (e.uncertain > 0 || (e.fits > 0 && e.no > 0));
    return !e || e.fits > 0 || e.uncertain > 0;
  });
  // Prefer unjudged informative comparisons, but keep every eligible item available as a final fallback.
  if (mode === "informative" && !candidates.length) return eligible;
  return candidates;
}
function pickMode(state: State, nodeId: string): CandidateMode {
  const weights = state.settings.recommendationWeights,
    total = weights.close + weights.boundary + weights.informative;
  const turn = state.candidateQueues[nodeId]?.seenTrackIds.length ?? 0;
  let hash = 2166136261;
  for (const ch of `${nodeId}:${turn}`) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  const value = (hash >>> 0) % total;
  return value < weights.close
    ? "close"
    : value < weights.close + weights.boundary
      ? "boundary"
      : "informative";
}
function sortedPick(
  items: Track[],
  state: State,
  nodeId: string,
): Track | null {
  if (!items.length) return null;
  const sorted = [...items].sort((a, b) => a.id.localeCompare(b.id));
  const turn = state.candidateQueues[nodeId]?.seenTrackIds.length ?? 0;
  let hash = 0;
  for (const ch of nodeId) hash = (Math.imul(hash, 31) + ch.charCodeAt(0)) | 0;
  return sorted[Math.abs(hash + turn) % sorted.length];
}
export function selectCandidate(state: State, nodeId: string): Track | null {
  const requested = pickMode(state, nodeId),
    preferred = sortedPick(modePool(state, nodeId, requested), state, nodeId);
  if (preferred) return preferred;
  return (
    sortedPick(modePool(state, nodeId, "informative"), state, nodeId) ??
    sortedPick(modePool(state, nodeId, "boundary"), state, nodeId) ??
    sortedPick(modePool(state, nodeId, "close"), state, nodeId)
  );
}
export function explainCandidate(
  state: State,
  nodeId: string,
  trackId: string,
): CandidateExplanation {
  const e = context(state, nodeId).evidence.get(trackId);
  if (e && e.fits > e.no && e.fits > 0)
    return {
      mode: "close",
      reason: `Previously marked Fits with reference ${e.references.join(", ")} on this recent path.`,
    };
  if (e && (e.uncertain > 0 || (e.fits > 0 && e.no > 0)))
    return {
      mode: "boundary",
      reason: `Has uncertain or mixed explicit judgments with reference ${e.references.join(", ")} on this recent path.`,
    };
  if (e && e.no > 0)
    return {
      mode: "informative",
      reason: `Previously marked No with reference ${e.references.join(", ")}; reconsidering it in this context.`,
    };
  return {
    mode: "informative",
    reason: "Exploration candidate; no matching path judgment is available.",
  };
}
