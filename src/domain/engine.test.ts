import { describe, expect, it } from 'vitest';
import { emptyState, startRoot, nextCandidate, evaluate, activateNode, undo, pathNodes } from './engine';

const library = () => { const s = emptyState(); for (let i=1;i<=30;i++) s.tracks[`track-${i}`] = { id:`track-${i}`, name:`Song ${i}`, artists:['Artist'], album:'Album', addedAt:'2024-01-01' }; s.library.trackCount=30; return s; };
describe('exploration engine', () => {
  it('preserves 20 sequential decisions and accepted path', () => {
    let s = startRoot(library(), 'track-1');
    for (let i=0;i<20;i++) { s = nextCandidate(s); s = evaluate(s, i % 3 === 0 ? 'fits' : i % 3 === 1 ? 'no' : 'skip'); }
    expect(s.evaluations).toHaveLength(20);
    expect(s.events.filter(e => e.type === 'evaluation_recorded')).toHaveLength(20);
    expect(s.nodes.filter(n => n.parentNodeId !== null)).toHaveLength(7);
    expect(pathNodes(s).length).toBe(8);
  });
  it('keeps rejected tracks eligible in a different branch and preserves the old queue', () => {
    let s = startRoot(library(), 'track-1'); s = nextCandidate(s); const rejected = s.active!.pendingTrackId!; s = evaluate(s, 'no');
    const root = s.sessions[0].rootNodeId; s = activateNode(s, root); s = nextCandidate(s);
    expect(s.active?.pendingTrackId).not.toBe(rejected); // same node remains excluded
    s = startRoot(s, 'track-1'); s = nextCandidate(s);
    expect(s.active?.pendingTrackId).toBe(rejected); // separate context can reuse it
    expect(s.candidateQueues[root].seenTrackIds).toContain(rejected);
  });
  it('uses explicit Fits evidence from a matching reference track', () => {
    let s=startRoot(library(),'track-1'); s=nextCandidate(s); const accepted=s.active!.pendingTrackId!; s=evaluate(s,'fits');
    s=startRoot(s,'track-1'); s=nextCandidate(s);
    expect(s.active?.pendingTrackId).toBe(accepted);
  });
  it('undo records a compensating event and restores the evaluated candidate', () => {
    let s = startRoot(library(), 'track-1'); s = nextCandidate(s); const first = s.active!.pendingTrackId!; s = evaluate(s, 'fits');
    s = nextCandidate(s); s = evaluate(s, 'fits'); s = nextCandidate(s); s = evaluate(s, 'no');
    const beforeEvents = s.events.length; s = undo(s);
    expect(s.events).toHaveLength(beforeEvents + 1);
    expect(s.events.at(-1)?.type).toBe('evaluation_undone');
    expect(s.evaluations.at(-1)?.undoneByEventId).toBe(s.events.at(-1)?.id);
    expect(s.active?.pendingTrackId).toBe(s.evaluations.at(-1)?.candidateSpotifyTrackId);
    expect(s.evaluations.some(e => e.candidateSpotifyTrackId === first && e.undoneByEventId)).toBe(false);
  });
  it('undoes Fits without leaving an orphaned accepted occurrence or queue', () => {
    let s=startRoot(library(),'track-1'); s=nextCandidate(s); const candidate=s.active!.pendingTrackId!; s=evaluate(s,'fits');
    expect(s.nodes).toHaveLength(2); s=undo(s);
    expect(s.nodes).toHaveLength(1); expect(s.active?.pendingTrackId).toBe(candidate); expect(Object.keys(s.candidateQueues)).toEqual([s.sessions[0].rootNodeId]);
  });
});
