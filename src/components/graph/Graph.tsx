import { useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  useReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  type NodeProps,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { State } from "../../domain/model";
import type { SpotifyAdapter } from "../../integrations/spotify";
import { Cover, type DisplayTrack } from "../Cover";
import { Dialog } from "../Dialog";
type SongNode = Node<
  {
    track: DisplayTrack;
    adapter: SpotifyAdapter | null;
    active: boolean;
    collapsed: boolean;
  },
  "song"
>;
function Song({ data }: NodeProps<SongNode>) {
  return (
    <div className={`song-node ${data.active ? "active-node" : ""}`}>
      <Handle type="target" position={Position.Top} />
      <Cover track={data.track} adapter={data.adapter} />
      <div className="node-label">
        <strong>{data.track.name}</strong>
        <small>{data.track.artists.join(", ")}</small>
        <span>
          {data.active
            ? "Active context"
            : data.collapsed
              ? "Branch collapsed"
              : "Accepted occurrence"}
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
const nodeTypes = { song: Song };
function GraphInner({
  state,
  adapter,
  onClose,
  onActivate,
}: {
  state: State;
  adapter: SpotifyAdapter | null;
  onClose: () => void;
  onActivate: (id: string) => void;
}) {
  const [selected, setSelected] = useState(state.active?.nodeId ?? "");
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [canvasReady, setCanvasReady] = useState(false);
  useEffect(() => {
    // Mount React Flow after the native dialog is visible and has dimensions.
    const frame = requestAnimationFrame(() => setCanvasReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  const flow = useReactFlow();
  const initialized = useNodesInitialized();
  useEffect(() => {
    if (!initialized) return;
    const timer = setTimeout(
      () => void flow.fitView({ padding: 0.2, maxZoom: 1 }),
      100,
    );
    return () => clearTimeout(timer);
  }, [initialized, flow]);
  const nodes = useMemo(() => {
    const result: SongNode[] = [];
    let leaf = 0;
    const walk = (id: string, depth: number): number => {
      const n = state.nodes.find((n) => n.id === id)!;
      const children = collapsed.has(id)
        ? []
        : state.nodes.filter((c) => c.parentNodeId === id);
      const xs = children.map((c) => walk(c.id, depth + 1));
      const x = xs.length
        ? xs.reduce((a, b) => a + b, 0) / xs.length
        : leaf++ * 210;
      result.push({
        id,
        type: "song",
        position: { x, y: depth * 235 },
        data: {
          track: state.tracks[n.spotifyTrackId],
          adapter,
          active: id === state.active?.nodeId,
          collapsed: collapsed.has(id),
        },
        selected: id === selected,
      });
      return x;
    };
    state.nodes
      .filter((n) => n.parentNodeId === null)
      .forEach((n) => {
        walk(n.id, 0);
        leaf++;
      });
    return result;
  }, [state, adapter, collapsed, selected]);
  const visible = new Set(nodes.map((n) => n.id));
  const edges = state.nodes
    .filter(
      (n) => n.parentNodeId && visible.has(n.id) && visible.has(n.parentNodeId),
    )
    .map((n) => ({ id: n.id, source: n.parentNodeId!, target: n.id }));
  const node = state.nodes.find((n) => n.id === selected);
  const track = node && state.tracks[node.spotifyTrackId];
  const focus = (id: string) => {
    setCollapsed(new Set());
    setSelected(id);
    setTimeout(
      () => void flow.fitView({ nodes: [{ id }], duration: 250, maxZoom: 1 }),
      0,
    );
  };
  return (
    <>
      <div className="graph-toolbar">
        <label>
          Find a song or artist
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            type="search"
          />
        </label>
        <button onClick={() => void flow.fitView()}>Center graph</button>
        <button onClick={() => state.active && focus(state.active.nodeId)}>
          Locate active
        </button>
        <button onClick={onClose}>Back to player</button>
      </div>
      {search && (
        <div className="graph-search">
          {state.nodes
            .filter((n) => {
              const t = state.tracks[n.spotifyTrackId];
              return `${t.name} ${t.artists.join(" ")}`
                .toLowerCase()
                .includes(search.toLowerCase());
            })
            .slice(0, 20)
            .map((n) => (
              <button key={n.id} onClick={() => focus(n.id)}>
                {state.tracks[n.spotifyTrackId].name}
              </button>
            ))}
        </div>
      )}
      <div className="graph-layout">
        <div className="graph-canvas">
          {canvasReady ? (
            <ReactFlow
              colorMode="dark"
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodeClick={(_, n) => setSelected(n.id)}
              fitView
              onlyRenderVisibleElements
              nodesDraggable={false}
              minZoom={0.15}
              maxZoom={1.6}
              onMove={(_, v) =>
                (document.documentElement.dataset.graphZoom =
                  v.zoom < 0.5 ? "small" : "full")
              }
            >
              <Background />
              <Controls />
            </ReactFlow>
          ) : (
            <p role="status">Opening graph…</p>
          )}
        </div>
        <aside className="graph-detail">
          {node && track ? (
            <>
              <p className="eyebrow">Selected occurrence</p>
              <Cover track={track} adapter={adapter} />
              <h3>{track.name}</h3>
              <p>{track.artists.join(", ")}</p>
              <p>Inspecting this node does not change playback.</p>
              <button className="primary" onClick={() => onActivate(node.id)}>
                Replay &amp; explore from here
              </button>
              <button
                onClick={() =>
                  setCollapsed((old) => {
                    const next = new Set(old);
                    if (next.has(node.id)) next.delete(node.id);
                    else next.add(node.id);
                    return next;
                  })
                }
              >
                {collapsed.has(node.id) ? "Expand" : "Collapse"} descendants
              </button>
              <h4>Activity in this context</h4>
              {state.evaluations
                .filter((e) => e.contextNodeId === node.id)
                .slice(-12)
                .reverse()
                .map((e) => (
                  <p key={e.id}>
                    {e.verdict}:{" "}
                    {state.tracks[e.candidateSpotifyTrackId]?.name ??
                      e.candidateSpotifyTrackId}
                  </p>
                ))}
            </>
          ) : (
            <p>Select a node to inspect its history.</p>
          )}
        </aside>
      </div>
    </>
  );
}
export function Graph(props: Parameters<typeof GraphInner>[0]) {
  return (
    <Dialog title="Exploration graph" onClose={props.onClose} wide>
      <ReactFlowProvider>
        <GraphInner {...props} />
      </ReactFlowProvider>
    </Dialog>
  );
}
