import { describe, expect, it } from "vitest";
import {
  emptyState,
  startRoot,
  nextCandidate,
  evaluate,
  activateNode,
  undo,
  pathNodes,
} from "./engine";
import { explainCandidate } from "../recommendations/selector";

const trackId = (n: number) => String(n).padStart(22, "0");
const library = () => {
  const s = emptyState();
  for (let i = 1; i <= 30; i++)
    s.tracks[trackId(i)] = {
      id: trackId(i),
      name: `Song ${i}`,
      artists: ["Artist"],
      album: "Album",
      addedAt: "2024-01-01",
    };
  s.library.trackCount = 30;
  return s;
};
describe("exploration engine", () => {
  it("preserves 20 sequential decisions and accepted path", () => {
    let s = startRoot(library(), trackId(1));
    for (let i = 0; i < 20; i++) {
      s = nextCandidate(s);
      s = evaluate(s, i % 3 === 0 ? "fits" : i % 3 === 1 ? "no" : "skip");
    }
    expect(s.evaluations).toHaveLength(20);
    expect(
      s.events.filter((e) => e.type === "evaluation_recorded"),
    ).toHaveLength(20);
    expect(s.nodes.filter((n) => n.parentNodeId !== null)).toHaveLength(7);
    expect(pathNodes(s).length).toBe(8);
  });
  it("keeps rejected tracks eligible in a different branch and preserves the old queue", () => {
    let s = startRoot(library(), trackId(1));
    s = nextCandidate(s);
    const rejected = s.active!.pendingTrackId!;
    s = evaluate(s, "no");
    const root = s.sessions[0].rootNodeId;
    s = activateNode(s, root);
    s = nextCandidate(s);
    expect(s.active?.pendingTrackId).not.toBe(rejected); // same node remains excluded
    const alternateRoot = Object.keys(s.tracks).find(
      (t) => t !== trackId(1) && t !== rejected,
    )!;
    s = startRoot(s, alternateRoot);
    s = nextCandidate(s);
    for (
      let i = 0;
      i < 30 &&
      !!s.active?.pendingTrackId &&
      s.active.pendingTrackId !== rejected;
      i++
    )
      s = evaluate(s, "skip");
    expect(s.active?.pendingTrackId).toBe(rejected); // distinct context can still reuse it
    expect(s.candidateQueues[root].seenTrackIds).toContain(rejected);
  });
  it("keeps a contextual No candidate eligible from a separate root even when nothing else is available", () => {
    let s = emptyState();
    for (const n of [1, 2])
      s.tracks[trackId(n)] = {
        id: trackId(n),
        name: `Song ${n}`,
        artists: ["Artist"],
        album: "Album",
        addedAt: "2024-01-01",
      };
    s.library.trackCount = 2;
    s = startRoot(s, trackId(1));
    s = nextCandidate(s);
    expect(s.active?.pendingTrackId).toBe(trackId(2));
    s = evaluate(s, "no");
    s = startRoot(s, trackId(1));
    s = nextCandidate(s);
    expect(s.active?.pendingTrackId).toBe(trackId(2));
  });
  it("uses positive evidence across similar paths without global exclusion", () => {
    let s = library();
    s.settings.recommendationWeights = {
      close: 1,
      boundary: 0,
      informative: 0,
    };
    s = startRoot(s, trackId(1));
    s = nextCandidate(s);
    const accepted = s.active!.pendingTrackId!;
    s = evaluate(s, "fits");
    s = startRoot(s, trackId(1));
    s = nextCandidate(s);
    expect(s.active?.pendingTrackId).toBe(accepted);
  });
  it("uses historical reference evidence and explains the selected candidate", () => {
    let s = library();
    s.settings.recommendationWeights = {
      close: 1,
      boundary: 0,
      informative: 0,
    };
    s.historicalReferenceComparisons = [
      {
        id: "historic-1",
        originalReferenceId: trackId(1),
        candidateTrackId: trackId(9),
        verdict: "fits",
      },
    ];
    s = startRoot(s, trackId(1));
    s = nextCandidate(s);
    expect(s.active?.pendingTrackId).toBe(trackId(9));
    expect(explainCandidate(s, s.active!.nodeId, trackId(9))).toEqual({
      mode: "close",
      reason: `Previously marked Fits with reference ${trackId(1)} on this recent path.`,
    });
  });
  it("undo records a compensating event and restores the evaluated candidate", () => {
    let s = startRoot(library(), trackId(1));
    s = nextCandidate(s);
    const first = s.active!.pendingTrackId!;
    s = evaluate(s, "fits");
    s = nextCandidate(s);
    s = evaluate(s, "fits");
    s = nextCandidate(s);
    s = evaluate(s, "no");
    const beforeEvents = s.events.length;
    s = undo(s);
    expect(s.events).toHaveLength(beforeEvents + 1);
    expect(s.events.at(-1)?.type).toBe("evaluation_undone");
    expect(s.evaluations.at(-1)?.undoneByEventId).toBe(s.events.at(-1)?.id);
    expect(s.active?.pendingTrackId).toBe(
      s.evaluations.at(-1)?.candidateSpotifyTrackId,
    );
    expect(
      s.evaluations.some(
        (e) => e.candidateSpotifyTrackId === first && e.undoneByEventId,
      ),
    ).toBe(false);
  });
  it("undoes Fits without leaving an orphaned accepted occurrence or queue", () => {
    let s = startRoot(library(), trackId(1));
    s = nextCandidate(s);
    const candidate = s.active!.pendingTrackId!;
    s = evaluate(s, "fits");
    expect(s.nodes).toHaveLength(2);
    s = undo(s);
    expect(s.nodes).toHaveLength(1);
    expect(s.active?.pendingTrackId).toBe(candidate);
    expect(Object.keys(s.candidateQueues)).toEqual([s.sessions[0].rootNodeId]);
  });
  it("keeps undone descendant evidence auditable while rolling back a parent Fits", () => {
    let s = startRoot(library(), trackId(1));
    s = nextCandidate(s);
    s = evaluate(s, "fits");
    s = nextCandidate(s);
    s = evaluate(s, "fits");
    s = undo(s);
    s = undo(s);
    expect(s.nodes).toHaveLength(1);
    expect(s.evaluations.filter((e) => e.undoneByEventId)).toHaveLength(2);
    expect(s.events.filter((e) => e.type === "evaluation_undone")).toHaveLength(
      2,
    );
    expect(s.active?.mode).toBe("candidate");
  });
});
