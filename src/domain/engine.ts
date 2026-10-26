import { StateSchema, type State, type Node } from './model';
import { selectCandidate } from '../recommendations/selector';

const id = (prefix: string, count: number) => `${prefix}-${count + 1}`;
const availableId = (prefix: string, used: string[]) => { const set = new Set(used); let n = used.length + 1; while (set.has(`${prefix}-${n}`)) n++; return `${prefix}-${n}`; };
const timeFor = (_state: State) => new Date().toISOString();
const event = (s: State, type: State['events'][number]['type'], data: Record<string, unknown>): State['events'][number] => ({ id: id('event', s.events.length), type, createdAt: timeFor(s), data });
const checked = (s: State): State => StateSchema.parse(s);

export function emptyState(): State {
  return { schemaVersion: 1, library: { sourceFile: null, addedAtFrom: null, trackCount: 0 }, tracks: {}, sessions: [], nodes: [], evaluations: [], historicalReferenceComparisons: [], candidateQueues: {}, active: null, settings: { recentPathWindow: 4, explorationRatio: 0.3 }, events: [] };
}
export function pathNodes(state: State, nodeId?: string): Node[] {
  const start = nodeId ?? state.active?.nodeId;
  if (!start) return [];
  const byId = new Map(state.nodes.map(n => [n.id, n]));
  const out: Node[] = []; let current = byId.get(start); const guard = new Set<string>();
  while (current && !guard.has(current.id)) { guard.add(current.id); out.unshift(current); current = current.parentNodeId ? byId.get(current.parentNodeId) : undefined; }
  return out;
}
function queue(state: State, nodeId: string) { return state.candidateQueues[nodeId] ?? { seenTrackIds: [], pendingTrackId: null }; }
export function nextCandidate(state: State): State {
  if (!state.active) return state;
  const a = state.active, q = queue(state, a.nodeId);
  if (q.pendingTrackId && state.tracks[q.pendingTrackId]) return checked({ ...state, active: { ...a, mode: 'candidate', pendingTrackId: q.pendingTrackId } });
  const candidate = selectCandidate({ ...state, candidateQueues: { ...state.candidateQueues, [a.nodeId]: q } }, a.nodeId);
  if (!candidate) return checked({ ...state, active: { ...a, mode: 'reference', pendingTrackId: null }, candidateQueues: { ...state.candidateQueues, [a.nodeId]: { ...q, pendingTrackId: null } } });
  const nextQ = { ...q, pendingTrackId: candidate.id };
  const ev = event(state, 'candidate_selected', { nodeId: a.nodeId, trackId: candidate.id });
  return checked({ ...state, candidateQueues: { ...state.candidateQueues, [a.nodeId]: nextQ }, active: { ...a, mode: 'candidate', pendingTrackId: candidate.id }, events: [...state.events, ev] });
}
export function startRoot(state: State, trackId: string): State {
  if (!state.tracks[trackId]) throw new Error(`Unknown track: ${trackId}`);
  const sid = availableId('session', state.sessions.map(s => s.id)), nid = availableId('node', state.nodes.map(n => n.id)), createdAt = timeFor(state);
  const session = { id: sid, rootNodeId: nid, createdAt }, node = { id: nid, sessionId: sid, spotifyTrackId: trackId, parentNodeId: null, acceptedByEvaluationId: null };
  let next = checked({ ...state, sessions: [...state.sessions, session], nodes: [...state.nodes, node], candidateQueues: { ...state.candidateQueues, [nid]: { seenTrackIds: [], pendingTrackId: null } }, active: { sessionId: sid, nodeId: nid, mode: 'reference', pendingTrackId: null }, events: [...state.events, event(state, 'session_started', { sessionId: sid, nodeId: nid, trackId })] });
  return next;
}
export function activateNode(state: State, nodeId: string): State {
  const node = state.nodes.find(n => n.id === nodeId); if (!node) throw new Error(`Unknown node: ${nodeId}`);
  const q = queue(state, nodeId);
  return checked({ ...state, active: { sessionId: node.sessionId, nodeId, mode: 'reference', pendingTrackId: q.pendingTrackId }, events: [...state.events, event(state, 'node_activated', { nodeId })] });
}
export function evaluate(state: State, verdict: 'fits'|'no'|'skip'): State {
  const a = state.active; if (!a || a.mode !== 'candidate' || !a.pendingTrackId) throw new Error('There is no pending candidate to evaluate');
  const evaluationId = id('evaluation', state.evaluations.length), recentPathNodeIds = pathNodes(state, a.nodeId).slice(-state.settings.recentPathWindow).map(n => n.id);
  const evaluation = { id: evaluationId, kind: 'live_path' as const, contextNodeId: a.nodeId, recentPathNodeIds, candidateSpotifyTrackId: a.pendingTrackId, verdict, createdAt: timeFor(state) };
  const q = queue(state, a.nodeId), candidateQueues = { ...state.candidateQueues, [a.nodeId]: { seenTrackIds: [...new Set([...q.seenTrackIds, a.pendingTrackId])], pendingTrackId: null } };
  let nodes = state.nodes, active = { ...a, mode: 'reference' as const, pendingTrackId: null };
  if (verdict === 'fits') {
    const childId = availableId('node', state.nodes.map(n => n.id)), child: Node = { id: childId, sessionId: a.sessionId, spotifyTrackId: a.pendingTrackId, parentNodeId: a.nodeId, acceptedByEvaluationId: evaluationId };
    nodes = [...nodes, child]; active = { sessionId: a.sessionId, nodeId: childId, mode: 'reference', pendingTrackId: null };
  }
  let next = checked({ ...state, nodes, evaluations: [...state.evaluations, evaluation], candidateQueues, active, events: [...state.events, event(state, 'evaluation_recorded', { evaluationId, verdict, contextNodeId: a.nodeId, candidateTrackId: a.pendingTrackId })] });
  return nextCandidate(next);
}
export function undo(state: State): State {
  const evaluation = [...state.evaluations].reverse().find(e => !e.undoneByEventId);
  if (!evaluation) return state;
  const child = state.nodes.find(n => n.acceptedByEvaluationId === evaluation.id);
  if (child && state.nodes.some(n => n.parentNodeId === child.id)) throw new Error('Cannot undo this Fits decision because its accepted node has descendants');
  const ev = event(state, 'evaluation_undone', { evaluationId: evaluation.id });
  const evaluations = state.evaluations.map(e => e.id === evaluation.id ? { ...e, undoneByEventId: ev.id } : e);
  const nodes = child ? state.nodes.filter(n => n.id !== child.id) : state.nodes;
  const prior = state.candidateQueues[evaluation.contextNodeId] ?? { seenTrackIds: [], pendingTrackId: null };
  const candidateQueues = { ...state.candidateQueues, [evaluation.contextNodeId]: { seenTrackIds: prior.seenTrackIds.filter(t => t !== evaluation.candidateSpotifyTrackId), pendingTrackId: evaluation.candidateSpotifyTrackId } };
  if (child) delete candidateQueues[child.id];
  return checked({ ...state, evaluations, nodes, candidateQueues, active: { sessionId: state.nodes.find(n => n.id === evaluation.contextNodeId)?.sessionId ?? state.active?.sessionId ?? '', nodeId: evaluation.contextNodeId, mode: 'candidate', pendingTrackId: evaluation.candidateSpotifyTrackId }, events: [...state.events, ev] });
}
