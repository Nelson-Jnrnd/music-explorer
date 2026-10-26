import { z } from 'zod';

export const TrackSchema = z.object({
  id: z.string().min(1), name: z.string(), artists: z.array(z.string()), album: z.string(),
  addedAt: z.string(), source: z.record(z.string(), z.string()).optional(),
});
export type Track = z.infer<typeof TrackSchema>;

export const NodeSchema = z.object({ id: z.string(), sessionId: z.string(), spotifyTrackId: z.string(), parentNodeId: z.string().nullable(), acceptedByEvaluationId: z.string().nullable() });
export type Node = z.infer<typeof NodeSchema>;
export const EvaluationSchema = z.object({ id: z.string(), kind: z.literal('live_path'), contextNodeId: z.string(), recentPathNodeIds: z.array(z.string()), candidateSpotifyTrackId: z.string(), verdict: z.enum(['fits','no','skip']), createdAt: z.string(), undoneByEventId: z.string().optional() });
export const EventSchema = z.object({ id: z.string(), type: z.enum(['session_started','node_activated','candidate_selected','evaluation_recorded','evaluation_undone','library_imported','historical_imported']), createdAt: z.string(), data: z.record(z.string(), z.unknown()) });
export const SessionSchema = z.object({ id: z.string(), rootNodeId: z.string(), createdAt: z.string() });
export const QueueSchema = z.object({ seenTrackIds: z.array(z.string()), pendingTrackId: z.string().nullable() });
export const StateSchema = z.object({
  schemaVersion: z.literal(1),
  library: z.object({ sourceFile: z.string().nullable(), addedAtFrom: z.string().nullable(), trackCount: z.number().int().nonnegative() }),
  tracks: z.record(z.string(), TrackSchema), sessions: z.array(SessionSchema), nodes: z.array(NodeSchema), evaluations: z.array(EvaluationSchema),
  historicalReferenceComparisons: z.array(z.record(z.string(), z.unknown())), candidateQueues: z.record(z.string(), QueueSchema),
  active: z.object({ sessionId: z.string(), nodeId: z.string(), mode: z.enum(['reference','candidate']), pendingTrackId: z.string().nullable() }).nullable(),
  settings: z.object({ recentPathWindow: z.number().int().positive(), explorationRatio: z.number().min(0).max(1) }), events: z.array(EventSchema),
}).superRefine((s, ctx) => {
  const trackIds = new Set(Object.keys(s.tracks)), sessionIds = new Set(s.sessions.map(x => x.id)), nodeIds = new Set(s.nodes.map(x => x.id)), evalIds = new Set(s.evaluations.map(x => x.id));
  for (const [label, ids] of [['session',s.sessions.map(x=>x.id)],['node',s.nodes.map(x=>x.id)],['evaluation',s.evaluations.map(x=>x.id)]] as const) if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: `Duplicate ${label} identifier` });
  for (const [key, track] of Object.entries(s.tracks)) if (key !== track.id) ctx.addIssue({ code: 'custom', message: `Track map key does not match track ${track.id}` });
  for (const node of s.nodes) {
    if (!trackIds.has(node.spotifyTrackId) || !sessionIds.has(node.sessionId)) ctx.addIssue({ code: 'custom', message: `Node ${node.id} references missing track or session` });
    if (node.parentNodeId && !s.nodes.some(n => n.id === node.parentNodeId && n.sessionId === node.sessionId)) ctx.addIssue({ code: 'custom', message: `Node ${node.id} has invalid parent` });
    if (node.acceptedByEvaluationId && !evalIds.has(node.acceptedByEvaluationId)) ctx.addIssue({ code: 'custom', message: `Node ${node.id} references missing evaluation` });
    const path = new Set<string>(); let current: typeof node | undefined = node;
    while (current) { if (path.has(current.id)) { ctx.addIssue({ code: 'custom', message: `Node ${node.id} is in a parent cycle` }); break; } path.add(current.id); current = current.parentNodeId ? s.nodes.find(n => n.id === current!.parentNodeId) : undefined; }
  }
  for (const session of s.sessions) if (!s.nodes.some(n => n.id === session.rootNodeId && n.sessionId === session.id && !n.parentNodeId)) ctx.addIssue({ code: 'custom', message: `Session ${session.id} has invalid root` });
  for (const e of s.evaluations) if (!nodeIds.has(e.contextNodeId) || !trackIds.has(e.candidateSpotifyTrackId) || e.recentPathNodeIds.some(n => !nodeIds.has(n))) ctx.addIssue({ code: 'custom', message: `Evaluation ${e.id} contains missing references` });
  for (const node of s.nodes) if (node.acceptedByEvaluationId) { const e=s.evaluations.find(x=>x.id===node.acceptedByEvaluationId); if (!e || e.verdict!=='fits' || e.candidateSpotifyTrackId!==node.spotifyTrackId || e.contextNodeId!==node.parentNodeId) ctx.addIssue({ code:'custom', message:`Node ${node.id} has mismatched accepted evaluation` }); }
  for (const [nodeId, q] of Object.entries(s.candidateQueues)) if (!nodeIds.has(nodeId) || q.seenTrackIds.some(t => !trackIds.has(t)) || (q.pendingTrackId && !trackIds.has(q.pendingTrackId))) ctx.addIssue({ code: 'custom', message: `Queue ${nodeId} contains missing references` });
  if (s.active && (!nodeIds.has(s.active.nodeId) || !sessionIds.has(s.active.sessionId) || (s.active.pendingTrackId && !trackIds.has(s.active.pendingTrackId)))) ctx.addIssue({ code: 'custom', message: 'Active context contains missing references' });
  if (s.library.trackCount !== trackIds.size) ctx.addIssue({ code: 'custom', message: 'Library trackCount does not match tracks' });
});
export type State = z.infer<typeof StateSchema>;
