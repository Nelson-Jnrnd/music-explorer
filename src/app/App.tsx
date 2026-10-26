import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AudioLines,
  GitBranch,
  RotateCcw,
  Play,
  Pause,
  SkipForward,
  Check,
  X,
  Save,
  Download,
  Settings2,
} from "lucide-react";
import {
  emptyState,
  startRoot,
  activateNode,
  nextCandidate,
  evaluate,
  undo,
  pathNodes,
} from "../domain/engine";
import type { State } from "../domain/model";
import {
  previewCsv,
  importLibrary,
  type CsvMapping,
  type CsvReport,
} from "../import/csv";
import {
  parseHistoricalComparisons,
  importHistoricalComparisons,
} from "../import/history";
import { explainCandidate } from "../recommendations/selector";
import { LocalStore } from "../persistence/store";
import {
  beginLogin,
  completeLogin,
  disconnect,
  isConnected,
  SpotifyApi,
  SpotifyTokenProvider,
  SpotifyPlaybackAdapter,
  SimulatedSpotifyAdapter,
  expectedMatches,
  SpotifyApiError,
  type Device,
  type PlaybackState,
  type SpotifyAdapter,
} from "../integrations/spotify";
import { SPOTIFY_CLIENT_ID } from "../integrations/spotify/config";
import { Cover, clearMetadata } from "../components/Cover";
import { Graph } from "../components/graph/Graph";
import { Dialog } from "../components/Dialog";

const store = new LocalStore();
let authCompletion: Promise<void> | undefined;
const clock = (ms: number) =>
  `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
function download(text: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `exploration-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function expected(s: State) {
  const a = s.active;
  return a
    ? ((a.mode === "candidate"
        ? a.pendingTrackId
        : s.nodes.find((n) => n.id === a.nodeId)?.spotifyTrackId) ?? null)
    : null;
}
export default function App() {
  const [state, setState] = useState<State>(emptyState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const [ready, setReady] = useState(false);
  const [adapter, setAdapter] = useState<SpotifyAdapter | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [device, setDevice] = useState("");
  const [playback, setPlayback] = useState<PlaybackState | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saveMessage, setSaveMessage] = useState(store.status.message);
  const [failed, setFailed] = useState<State | null>(null);
  const [modal, setModal] = useState<
    "import" | "settings" | "graph" | "history" | null
  >(null);
  const [search, setSearch] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [csv, setCsv] = useState("");
  const [filename, setFilename] = useState("");
  const [cutoff, setCutoff] = useState("2020-01-01");
  const [mapping, setMapping] = useState<CsvMapping>({});
  const [report, setReport] = useState<CsvReport | null>(null);
  const [wizardStep, setWizardStep] = useState(1);
  const simulated =
    import.meta.env.DEV &&
    new URLSearchParams(location.search).get("simulate") === "1";
  const trackId = expected(state);
  const track = trackId ? state.tracks[trackId] : undefined;
  const path = pathNodes(state);
  const counts = Object.values(state.tracks).length;
  const filtered = useMemo(
    () =>
      Object.values(state.tracks)
        .filter((t) =>
          `${t.name} ${t.artists.join(" ")}`
            .toLowerCase()
            .includes(search.toLowerCase()),
        )
        .slice(0, 60),
    [state.tracks, search],
  );
  const refreshDevices = useCallback(async (a: SpotifyAdapter) => {
    const list = await a.devices();
    setDevices(list);
    setDevice((old) =>
      list.some((d) => d.id === old && !d.is_restricted)
        ? old
        : ((
            list.find(
              (d) => !d.is_restricted && /desktop|computer/i.test(d.name),
            ) ??
            list.find((d) => d.is_active && !d.is_restricted) ??
            list.find((d) => !d.is_restricted)
          )?.id ?? ""),
    );
  }, []);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const saved = await store.load();
        if (!cancelled && saved) setState(saved);
        if (
          new URLSearchParams(location.search).has("code") ||
          new URLSearchParams(location.search).has("error")
        ) {
          authCompletion ??= completeLogin();
          await authCompletion;
        }
        if (cancelled) return;
        const a = simulated
          ? new SimulatedSpotifyAdapter()
          : isConnected()
            ? new SpotifyPlaybackAdapter(
                new SpotifyApi(new SpotifyTokenProvider()),
              )
            : null;
        setAdapter(a);
        if (a) await refreshDevices(a);
      } catch (e) {
        if (!cancelled) setError(message(e));
      } finally {
        if (!cancelled) {
          setReady(true);
          setSaveMessage(store.status.message);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshDevices, simulated]);
  const playState = useCallback(
    async (s: State) => {
      const id = expected(s);
      setConfirmed(false);
      setPlayback(null);
      if (!id || !adapter || !device) return;
      await adapter.play(id, device);
      const actual = await adapter.state();
      setPlayback(actual);
      setConfirmed(expectedMatches(actual, id, device));
      if (actual && !expectedMatches(actual, id, device))
        setError(
          "Spotify is playing another track or device. Resume candidate before rating.",
        );
    },
    [adapter, device],
  );
  const transaction = useCallback(
    async (
      transform: (s: State) => State,
      play = true,
      before?: () => Promise<void>,
    ) => {
      if (busyRef.current || failed) return;
      busyRef.current = true;
      setBusy(true);
      setError("");
      let draft: State | undefined;
      try {
        if (before) await before();
        draft = transform(stateRef.current);
        setSaveMessage("Saving…");
        try {
          await store.save(draft);
        } catch (e) {
          setFailed(draft);
          throw e;
        }
        setState(draft);
        stateRef.current = draft;
        setSaveMessage(store.status.message);
        if (play) await playState(draft);
      } catch (e) {
        setError(message(e));
        setSaveMessage(store.status.message);
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [failed, playState],
  );
  useEffect(() => {
    if (!adapter || !device || !trackId || busy || !ready) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let delay = 5000;
    const poll = async () => {
      try {
        const actual = await adapter.state();
        if (stopped) return;
        setPlayback(actual);
        const matches = expectedMatches(actual, trackId, device);
        setConfirmed(matches);
        if (actual && !matches) {
          await adapter.pause(actual.deviceId);
          if (!stopped)
            setError(
              "Playback changed outside Music Explorer. Resume candidate before rating.",
            );
        }
        delay = 5000;
      } catch (e) {
        if (stopped) return;
        setConfirmed(false);
        setError(message(e));
        delay =
          e instanceof SpotifyApiError && e.retryAfterSeconds
            ? Math.max(5000, e.retryAfterSeconds * 1000)
            : Math.min(delay * 2, 60000);
      }
      if (!stopped) timer = setTimeout(poll, delay);
    };
    timer = setTimeout(poll, 5000);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [adapter, device, trackId, busy, ready]);
  const decide = useCallback(
    async (verdict: "fits" | "no" | "skip") => {
      if (
        !adapter ||
        !device ||
        !trackId ||
        !confirmed ||
        busyRef.current ||
        failed
      )
        return;
      await transaction(
        (s) => evaluate(s, verdict),
        true,
        async () => {
          const actual = await adapter.state();
          setPlayback(actual);
          if (
            !expectedMatches(actual, expected(stateRef.current) ?? "", device)
          ) {
            setConfirmed(false);
            if (actual) await adapter.pause(actual.deviceId);
            throw new Error(
              "Candidate playback is not confirmed. Resume candidate before rating.",
            );
          }
        },
      );
    },
    [adapter, device, trackId, confirmed, failed, transaction],
  );
  const transport = useCallback(
    async (action: "toggle" | "replay") => {
      if (busyRef.current || !adapter || !device) return;
      setError("");
      setBusy(true);
      busyRef.current = true;
      try {
        if (action === "replay" || !confirmed)
          await playState(stateRef.current);
        else if (playback?.isPlaying) await adapter.pause(device);
        else await adapter.resume(device);
        const actual = await adapter.state();
        setPlayback(actual);
        setConfirmed(
          expectedMatches(actual, expected(stateRef.current) ?? "", device),
        );
      } catch (e) {
        setConfirmed(false);
        setError(message(e));
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [adapter, device, confirmed, playback, playState],
  );
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        modal ||
        e.repeat ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(
          (e.target as HTMLElement)?.tagName,
        ) ||
        (e.target as HTMLElement)?.isContentEditable
      )
        return;
      if (
        e.key === " " &&
        ["BUTTON", "A"].includes((e.target as HTMLElement)?.tagName)
      )
        return;
      if (["1", "2", "3", " ", "z", "Z", "g", "G"].includes(e.key))
        e.preventDefault();
      if (e.key === "1") void decide("no");
      if (e.key === "2") void decide("skip");
      if (e.key === "3") void decide("fits");
      if (e.key === " ") void transport("toggle");
      if (e.key.toLowerCase() === "z") void transaction(undo);
      if (e.key.toLowerCase() === "g") setModal("graph");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [modal, decide, transport, transaction]);
  async function chooseFile() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const saved = await store.chooseFile(failed ?? stateRef.current);
      setSaveMessage(store.status.message);
      if (saved && failed) {
        setState(failed);
        stateRef.current = failed;
        setFailed(null);
        setError("");
        await playState(failed);
      }
    } catch (e) {
      setError(message(e));
      setSaveMessage(store.status.message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function openFile() {
    if (busyRef.current || failed) return;
    if (
      state.events.length &&
      !window.confirm(
        "Open an existing exploration file? This will replace the current in-browser session. Download a backup first if needed.",
      )
    )
      return;
    busyRef.current = true;
    setBusy(true);
    try {
      const loaded = await store.openFile();
      if (loaded) {
        setState(loaded);
        stateRef.current = loaded;
        setConfirmed(false);
        setPlayback(null);
        setModal(null);
        setError("");
      }
      setSaveMessage(store.status.message);
    } catch (e) {
      setError(message(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function retrySave() {
    if (!failed) return;
    const draft = failed;
    try {
      await store.save(draft);
      setState(draft);
      stateRef.current = draft;
      setFailed(null);
      setSaveMessage(store.status.message);
      setError("");
      await playState(draft);
    } catch (e) {
      setError(message(e));
    }
  }
  async function restore(file: File) {
    try {
      const restored = store.restore(await file.text());
      if (
        state.events.length &&
        !window.confirm(
          "Replace the current exploration with this backup? Export a backup first if you want to keep both.",
        )
      )
        return;
      await transaction(() => restored, false);
      setConfirmed(false);
      setPlayback(null);
      setModal(null);
    } catch (e) {
      setError(`Backup could not be restored: ${message(e)}`);
    }
  }
  async function confirmImport() {
    if (!report?.tracks.length) return;
    if (
      state.evaluations.length &&
      !window.confirm(
        "This import may change the library date cutoff. Existing judgments and tracks will be retained. Continue?",
      )
    )
      return;
    await transaction((s) => importLibrary(s, report, filename, cutoff), false);
    setNotice(
      "Library imported. Choose a JSON file for direct saving, then select a song to start a new exploration.",
    );
    setModal(null);
  }
  async function past(file: File) {
    try {
      const rows = parseHistoricalComparisons(await file.text());
      const imported = importHistoricalComparisons(state, rows);
      const count =
        imported.historicalReferenceComparisons.length -
        state.historicalReferenceComparisons.length;
      await transaction(() => imported, false);
      setNotice(
        `${count} past comparisons imported. Proposed or unrated pairs were excluded. No branches were created.`,
      );
      setModal(null);
    } catch (e) {
      setError(message(e));
    }
  }
  async function connectSpotify() {
    if (signingIn) return;
    setSigningIn(true);
    setError("");
    try {
      location.assign(
        await beginLogin(
          SPOTIFY_CLIENT_ID,
          `${location.origin}${import.meta.env.BASE_URL}`,
        ),
      );
    } catch (e) {
      setError(message(e));
      setSigningIn(false);
    }
  }
  async function disconnectSpotify() {
    try {
      await adapter?.exit();
    } catch (e) {
      setNotice(`Could not restore Spotify repeat setting: ${message(e)}`);
    }
    disconnect();
    clearMetadata();
    setAdapter(null);
    setConfirmed(false);
    setPlayback(null);
    setModal(null);
  }
  if (!ready)
    return (
      <main className="shell">
        <div className="empty" role="status">
          Loading your local exploration…
        </div>
      </main>
    );
  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <AudioLines size={29} aria-hidden="true" />
          <div>
            <strong>Music Explorer</strong>
            <br />
            <small>Follow the atmosphere.</small>
          </div>
        </div>
        <nav className="top-actions" aria-label="Main">
          {!adapter && (
            <button
              className="primary"
              disabled={signingIn}
              onClick={() => void connectSpotify()}
            >
              {signingIn ? "Connecting…" : "Connect with Spotify"}
            </button>
          )}
          <button onClick={() => setModal("import")}>Import library</button>
          <button
            onClick={() => setModal("graph")}
            disabled={!state.nodes.length}
          >
            <GitBranch size={15} className="inline-icon" />
            Graph <kbd>G</kbd>
          </button>
          <button
            onClick={() => setModal("settings")}
            aria-label="Settings and Spotify connection"
          >
            <Settings2 size={17} />
          </button>
        </nav>
      </header>
      <div
        className="statusbar"
        role="region"
        aria-label="Save and playback status"
      >
        <span>
          <i className="status-dot" />
          {saveMessage}
        </span>
        <span>
          {simulated
            ? "SIMULATED PLAYBACK · development only"
            : adapter
              ? "Spotify connected"
              : "Spotify disconnected"}{" "}
          · {counts.toLocaleString()} songs
        </span>
      </div>
      {store.status.mode === "browser-recovery" && counts > 0 && (
        <div className="notice" role="region" aria-label="Backup reminder">
          Your exploration is saved in this browser only. Choose a writable JSON
          file or download regular backups.
          <div>
            <button onClick={() => void chooseFile()}>
              <Save size={14} className="inline-icon" />
              Save as JSON file
            </button>
            <button
              onClick={() => download(store.exportBackup(failed ?? state))}
            >
              <Download size={14} className="inline-icon" />
              Download backup
            </button>
          </div>
        </div>
      )}
      {error && (
        <div className="notice error" role="alert">
          {error}
          {failed && (
            <div>
              <strong>
                Progression stopped. The pending decision is retained in memory.
              </strong>
              <div>
                <button onClick={() => void retrySave()}>Retry save</button>
                <button onClick={() => void chooseFile()}>
                  Save to another file
                </button>
                <button onClick={() => download(store.exportBackup(failed))}>
                  Download pending backup
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {notice && (
        <div className="notice" role="status">
          {notice}
          <button
            className="quiet"
            onClick={() => setNotice("")}
            aria-label="Dismiss notice"
          >
            Dismiss
          </button>
        </div>
      )}
      {!counts ? (
        <main className="empty">
          <p className="eyebrow">Your library. Your judgment.</p>
          <h1>
            Find where a<br />
            song takes you.
          </h1>
          <p>
            Start with a song you know. Listen to a suggestion, judge whether it
            fits the recent path, and let a new branch take shape.
          </p>
          <button className="primary" onClick={() => setModal("import")}>
            Import your Spotify CSV
          </button>
          <p className="privacy">
            Your songs and judgments stay on this device. Connect Spotify to
            listen on your existing player.
          </p>
          <button className="quiet" onClick={() => setModal("settings")}>
            Restore exploration or connect Spotify
          </button>
        </main>
      ) : (
        <main className="workspace">
          <aside className="library-panel">
            <p className="eyebrow">Library</p>
            <h2>Start somewhere.</h2>
            <p className="library-count">Choose any song as a new root.</p>
            <label>
              Search songs or artists
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <ul className="track-list">
              {filtered.map((t) => (
                <li key={t.id}>
                  <button
                    disabled={busy || !!failed}
                    onClick={() => void transaction((s) => startRoot(s, t.id))}
                  >
                    <span className="sr-only">Start exploration from </span>
                    <strong>{t.name}</strong>{" "}
                    <small>{t.artists.join(", ")}</small>
                  </button>
                </li>
              ))}
            </ul>
            {!filtered.length && <p>No songs match your search.</p>}
            <p className="library-count">
              Showing up to 60 matches · {state.sessions.length} explorations
            </p>
          </aside>
          <section className="player" aria-label="Music player">
            {!track ? (
              <div className="empty">
                <p className="eyebrow">Ready when you are</p>
                <h1>Pick your first song.</h1>
                <p>
                  Search your library and select a song to start a listening
                  path.
                </p>
                {!adapter && (
                  <button onClick={() => setModal("settings")}>
                    Connect Spotify
                  </button>
                )}
              </div>
            ) : (
              <>
                <p className="eyebrow">
                  Recent active path · last {state.settings.recentPathWindow}{" "}
                  songs
                </p>
                <div className="path-strip" aria-label="Path breadcrumbs">
                  {path.slice(-state.settings.recentPathWindow).map((n, i) => (
                    <div className="path-item" key={n.id}>
                      <Cover
                        track={state.tracks[n.spotifyTrackId]}
                        adapter={adapter}
                      />
                      <button
                        disabled={busy || !!failed}
                        onClick={() =>
                          void transaction((s) => activateNode(s, n.id))
                        }
                        title="Replay and explore from this song"
                      >
                        {state.tracks[n.spotifyTrackId].name}
                      </button>
                      {i <
                        Math.min(path.length, state.settings.recentPathWindow) -
                          1 && <span aria-hidden="true">›</span>}
                    </div>
                  ))}
                </div>
                <div className="player-song">
                  <Cover key={track.id} track={track} adapter={adapter} large />
                  <div className="song-info">
                    <span className="pill">
                      {state.active?.mode === "reference"
                        ? "Reference replay"
                        : "Candidate evaluation"}
                    </span>
                    <h1>{track.name}</h1>
                    <p className="artist">{track.artists.join(", ")}</p>
                    <p className="album">{track.album}</p>
                    <a
                      className="spotify-link"
                      href={`https://open.spotify.com/track/${track.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Listen on Spotify ↗
                    </a>
                  </div>
                </div>
                <div className="playback">
                  <progress
                    value={playback?.progressMs ?? 0}
                    max={playback?.durationMs || 1}
                    aria-label="Playback progress"
                  />
                  <div className="playback-meta">
                    <span>
                      {clock(playback?.progressMs ?? 0)} /{" "}
                      {clock(playback?.durationMs ?? 0)}
                    </span>
                    <span>
                      {playback?.repeat === "track"
                        ? "Repeat one"
                        : "Repeat unconfirmed · Replay available"}
                    </span>
                  </div>
                </div>
                <label>
                  Spotify Connect device
                  <select
                    value={device}
                    onChange={(e) => {
                      setDevice(e.target.value);
                      setConfirmed(false);
                    }}
                  >
                    <option value="">Choose an available device</option>
                    {devices.map((d) => (
                      <option
                        key={d.id}
                        value={d.id}
                        disabled={d.is_restricted}
                      >
                        {d.name}
                        {d.is_restricted ? " (restricted)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="transport">
                  <button
                    disabled={!adapter || !device || busy}
                    onClick={() => void transport("toggle")}
                  >
                    {confirmed && playback?.isPlaying ? (
                      <Pause size={16} />
                    ) : (
                      <Play size={16} />
                    )}{" "}
                    {!confirmed
                      ? "Resume candidate"
                      : playback?.isPlaying
                        ? "Pause"
                        : "Resume"}
                  </button>
                  <button
                    disabled={!adapter || !device || busy}
                    onClick={() => void transport("replay")}
                  >
                    <RotateCcw size={16} />
                    Replay
                  </button>
                  <button
                    disabled={
                      busy ||
                      !!failed ||
                      !state.evaluations.some((e) => !e.undoneByEventId)
                    }
                    onClick={() => void transaction(undo)}
                  >
                    Undo <kbd>Z</kbd>
                  </button>
                </div>
                {!adapter && (
                  <div className="notice">
                    Connect Spotify and select a device to listen and enable
                    judgments.
                    <button
                      disabled={signingIn}
                      onClick={() => void connectSpotify()}
                    >
                      Connect with Spotify
                    </button>
                  </div>
                )}
                {state.active?.mode === "reference" ? (
                  <div className="decision-explainer">
                    <p>
                      Replay this reference to reacquire the atmosphere, then
                      explore.
                    </p>
                    <button
                      className="primary"
                      disabled={busy || !!failed || !adapter || !device}
                      onClick={() =>
                        void transaction((s) => {
                          const next = nextCandidate(s);
                          if (next.active?.mode !== "candidate")
                            setNotice(
                              "No eligible suggestions remain in this context. Choose another root or explore a different branch.",
                            );
                          return next;
                        })
                      }
                    >
                      Next suggestion{" "}
                      <SkipForward size={15} className="inline-icon" />
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="footnote">
                      {state.active && trackId
                        ? explainCandidate(state, state.active.nodeId, trackId)
                            .reason
                        : null}
                    </p>
                    <p className="decision-explainer">
                      Does this fit the overall sound and atmosphere of your
                      recent path?
                    </p>
                    <div className="decisions">
                      <button
                        className="no"
                        disabled={!confirmed || busy || !!failed}
                        onClick={() => void decide("no")}
                      >
                        <X size={19} />
                        No <kbd>1</kbd>
                      </button>
                      <button
                        disabled={!confirmed || busy || !!failed}
                        onClick={() => void decide("skip")}
                      >
                        Skip <kbd>2</kbd>
                      </button>
                      <button
                        className="fits"
                        disabled={!confirmed || busy || !!failed}
                        onClick={() => void decide("fits")}
                      >
                        <Check size={19} />
                        Fits <kbd>3</kbd>
                      </button>
                    </div>
                    <p className="footnote">
                      {!confirmed
                        ? "Playback must be confirmed before rating. Use Resume candidate."
                        : "Skip records an exposure. No is a judgment about this context only."}
                    </p>
                  </>
                )}
                <footer className="player-footer">
                  <span>
                    {state.evaluations.filter((e) => !e.undoneByEventId).length}{" "}
                    decisions · {state.nodes.length} accepted occurrences
                  </span>
                  <button className="quiet" onClick={() => setModal("history")}>
                    View activity
                  </button>
                  <button
                    className="quiet"
                    onClick={() => download(store.exportBackup(state))}
                  >
                    Download backup
                  </button>
                </footer>
              </>
            )}
          </section>
        </main>
      )}
      {modal === "graph" && (
        <Graph
          state={state}
          adapter={adapter}
          onClose={() => setModal(null)}
          onActivate={(id) => {
            setModal(null);
            void transaction((s) => activateNode(s, id));
          }}
        />
      )}
      {modal === "import" && (
        <Dialog title="Import your library" onClose={() => setModal(null)}>
          <p className="step">
            Step {wizardStep} of 3 ·{" "}
            {wizardStep === 1
              ? "Choose CSV"
              : wizardStep === 2
                ? "Map columns and filter"
                : "Review import"}
          </p>
          {wizardStep === 1 ? (
            <>
              <label>
                Spotify-compatible CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setCsv(await f.text());
                    setFilename(f.name);
                    setMapping({});
                    setWizardStep(2);
                  }}
                />
              </label>
              <p className="privacy">
                The original CSV is never modified or uploaded.
              </p>
            </>
          ) : (
            <>
              {wizardStep === 2 ? (
                <>
                  <label>
                    Include songs added on or after
                    <input
                      key="cutoff"
                      type="date"
                      value={cutoff}
                      onChange={(e) => setCutoff(e.target.value)}
                    />
                  </label>
                  <div className="mapping">
                    {(
                      ["id", "name", "artists", "album", "addedAt"] as const
                    ).map((key) => {
                      const defaults = {
                        id: "Track URI",
                        name: "Track Name",
                        artists: "Artist Name(s)",
                        album: "Album Name",
                        addedAt: "Added At",
                      };
                      const cols = previewCsv(csv, cutoff).columns;
                      return (
                        <label key={key}>
                          {defaults[key]}
                          <select
                            value={mapping[key] ?? defaults[key]}
                            onChange={(e) =>
                              setMapping({ ...mapping, [key]: e.target.value })
                            }
                          >
                            {cols.map((c) => (
                              <option key={c}>{c}</option>
                            ))}
                          </select>
                        </label>
                      );
                    })}
                  </div>
                  <button
                    className="primary"
                    onClick={() => {
                      try {
                        setReport(previewCsv(csv, cutoff, mapping));
                        setWizardStep(3);
                      } catch (e) {
                        setError(message(e));
                      }
                    }}
                  >
                    Preview import
                  </button>
                </>
              ) : (
                report && (
                  <>
                    <div className="stats">
                      <div>
                        <strong>{report.tracks.length}</strong>
                        <small>eligible unique tracks</small>
                      </div>
                      <div>
                        <strong>{report.duplicates.length}</strong>
                        <small>duplicate IDs</small>
                      </div>
                      <div>
                        <strong>{report.invalidIds.length}</strong>
                        <small>invalid track IDs</small>
                      </div>
                      <div>
                        <strong>{report.rejectedRows}</strong>
                        <small>rejected rows</small>
                      </div>
                      <div>
                        <strong>{report.filteredRows}</strong>
                        <small>before cutoff</small>
                      </div>
                    </div>
                    <div className="preview-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Song</th>
                            <th>Artist</th>
                            <th>Added</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.tracks.slice(0, 5).map((t) => (
                            <tr key={t.id}>
                              <td>{t.name}</td>
                              <td>{t.artists.join(", ")}</td>
                              <td>{t.addedAt.slice(0, 10)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="privacy">
                      Extra columns are preserved. Existing tracks and judgments
                      remain. No private input goes to GitHub.
                    </p>
                    <div className="row">
                      <button onClick={() => setWizardStep(2)}>
                        Back to mapping
                      </button>
                      <button
                        className="primary"
                        disabled={!report.tracks.length || busy || !!failed}
                        onClick={() => void confirmImport()}
                      >
                        Import {report.tracks.length} tracks
                      </button>
                    </div>
                  </>
                )
              )}
            </>
          )}
        </Dialog>
      )}
      {modal === "settings" && (
        <Dialog title="Settings & local data" onClose={() => setModal(null)}>
          <h3>Spotify connection</h3>
          <p>
            Requires an authorized Spotify Premium account and a supported
            Spotify Connect device. Open Spotify Desktop before refreshing
            devices.
          </p>
          <p className="privacy">
            Sign in on Spotify and authorize Music Explorer. Your Spotify
            password stays on Spotify.
          </p>
          <div className="row">
            <button
              className="primary"
              disabled={signingIn}
              onClick={() => void connectSpotify()}
            >
              {signingIn
                ? "Connecting…"
                : adapter
                  ? "Reconnect Spotify"
                  : "Connect with Spotify"}
            </button>
            <button
              disabled={!adapter}
              onClick={() =>
                void refreshDevices(adapter!).catch((e) => setError(message(e)))
              }
            >
              Refresh devices
            </button>
            <button
              disabled={!adapter}
              onClick={() => void disconnectSpotify()}
            >
              Disconnect Spotify
            </button>
          </div>
          <h3>Exploration file</h3>
          <p className="privacy">
            Chrome/Edge can save every action directly to a chosen file. File
            permission must be granted again after reload. Other browsers use
            recoverable browser storage and explicit backups.
          </p>
          <div className="row">
            <button onClick={() => void openFile()} disabled={!!failed || busy}>
              Open existing JSON
            </button>
            <button onClick={() => void chooseFile()}>Save as JSON file</button>
            <button
              onClick={() => download(store.exportBackup(failed ?? state))}
            >
              Download backup
            </button>
          </div>
          <label>
            Restore JSON backup
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void restore(f);
              }}
            />
          </label>
          <label>
            Import past comparisons (CSV or JSON)
            <input
              type="file"
              accept=".json,.csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void past(f);
              }}
            />
          </label>
          <p className="privacy">
            Historical comparisons require an original reference and an explicit
            verdict. They never become branches. Imported:{" "}
            {state.historicalReferenceComparisons.length}.
          </p>
          <h3>Privacy</h3>
          <p className="privacy">
            CSV and exploration data stay on your device. Spotify receives
            OAuth, track metadata and playback requests. Tokens remain in this
            tab's session storage and are excluded from backups. No analytics or
            server database.
          </p>
          <button
            className="danger-button"
            onClick={async () => {
              if (
                !window.confirm(
                  "Remove all local songs and exploration history? Download a backup first. Your chosen JSON file will also be replaced if connected.",
                )
              )
                return;
              await disconnectSpotify();
              await transaction(() => emptyState(), false);
            }}
          >
            Remove local exploration data
          </button>
        </Dialog>
      )}
      {modal === "history" && (
        <Dialog title="Exploration activity" onClose={() => setModal(null)}>
          <p>
            {state.events.length} audit events · {state.evaluations.length}{" "}
            recorded evaluations
          </p>
          {state.evaluations
            .slice()
            .reverse()
            .map((e) => (
              <p key={e.id}>
                <strong>{e.verdict}</strong> ·{" "}
                {state.tracks[e.candidateSpotifyTrackId]?.name} ·{" "}
                {e.contextNodeId}
                {e.undoneByEventId ? " · Undone" : ""}
              </p>
            ))}
          {!state.evaluations.length && (
            <p>
              Your judgments will appear here after you evaluate a candidate.
            </p>
          )}
        </Dialog>
      )}
    </div>
  );
}
