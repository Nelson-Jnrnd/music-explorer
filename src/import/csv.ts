import Papa from "papaparse";
import { type State, TrackSchema } from "../domain/model";

export type CsvMapping = {
  id?: string;
  name?: string;
  artists?: string;
  album?: string;
  addedAt?: string;
};
export type CsvReport = {
  tracks: import("../domain/model").Track[];
  columns: string[];
  duplicates: string[];
  invalidIds: string[];
  rejectedRows: number;
  filteredRows: number;
  fingerprint: string;
};
const defaultMapping: Required<CsvMapping> = {
  id: "Track URI",
  name: "Track Name",
  artists: "Artist Name(s)",
  album: "Album Name",
  addedAt: "Added At",
};
function spotifyId(raw: string) {
  const v = raw.trim();
  const m = v.match(
    /^(?:spotify:track:|https?:\/\/open\.spotify\.com\/track\/)?([A-Za-z0-9]{22})$/,
  );
  return m?.[1] ?? null;
}
export function previewCsv(
  text: string,
  cutoff: string,
  mapping: CsvMapping = {},
): CsvReport {
  if (cutoff && (!/^\d{4}-\d{2}-\d{2}$/.test(cutoff) || !validDate(cutoff)))
    throw new Error("Cutoff must be a real YYYY-MM-DD date.");
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transform: (v) => v.trim(),
  });
  const columns = parsed.meta.fields ?? [],
    map = { ...defaultMapping, ...mapping };
  const tracks: import("../domain/model").Track[] = [],
    duplicates: string[] = [],
    invalidIds: string[] = [];
  let rejectedRows = 0,
    filteredRows = 0;
  const found = new Set<string>(),
    malformed = new Set(
      parsed.errors
        .map((error) => error.row)
        .filter((row): row is number => typeof row === "number"),
    );
  for (const [index, row] of parsed.data.entries()) {
    if (malformed.has(index + 1)) {
      rejectedRows++;
      continue;
    }
    const rawId = row[map.id] ?? "",
      trackId = spotifyId(rawId),
      addedAt = row[map.addedAt] ?? "";
    if (!trackId) {
      invalidIds.push(rawId);
      rejectedRows++;
      continue;
    }
    if (
      !row[map.name]?.trim() ||
      !row[map.artists]?.trim() ||
      !validTimestamp(addedAt)
    ) {
      rejectedRows++;
      continue;
    }
    if (cutoff && addedAt.slice(0, 10) < cutoff) {
      filteredRows++;
      continue;
    }
    if (found.has(trackId)) {
      duplicates.push(trackId);
      continue;
    }
    found.add(trackId);
    const track = TrackSchema.parse({
      id: trackId,
      name: row[map.name].trim(),
      artists: row[map.artists].split(/\s*[,;]\s*/).filter(Boolean),
      album: (row[map.album] ?? "").trim(),
      addedAt,
      source: { ...row },
    });
    tracks.push(track);
  }
  return {
    tracks,
    columns,
    duplicates,
    invalidIds,
    rejectedRows,
    filteredRows,
    fingerprint: normalizedFingerprint(tracks),
  };
}
function validDate(value: string) {
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
function validTimestamp(value: string) {
  const d = value.slice(0, 10);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(d) &&
    validDate(d) &&
    Number.isFinite(Date.parse(value))
  );
}
/** Stable FNV-1a fingerprint over normalized imported tracks; this is an identity check, not a security digest. */
export function normalizedFingerprint(
  tracks: import("../domain/model").Track[],
): string {
  const input = JSON.stringify(
    [...tracks]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((t) => [t.id, t.name, t.artists, t.album, t.addedAt]),
  );
  const hash = (seed: number) => {
    let h = seed >>> 0;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  };
  return `${hash(0x811c9dc5)}${hash(0x9e3779b9)}`;
}
export function importLibrary(
  state: State,
  report: CsvReport,
  sourceFile: string,
  cutoff: string,
): State {
  const tracks = { ...state.tracks };
  for (const track of report.tracks)
    if (!tracks[track.id]) tracks[track.id] = track;
  const added = Object.keys(tracks).length - Object.keys(state.tracks).length;
  const eventIds = new Set(state.events.map((e) => e.id));
  let eventNumber = state.events.length + 1;
  while (eventIds.has(`event-${eventNumber}`)) eventNumber++;
  const event = {
    id: `event-${eventNumber}`,
    type: "library_imported" as const,
    createdAt: new Date().toISOString(),
    data: {
      sourceFile,
      cutoff,
      added,
      duplicates: report.duplicates.length,
      rejectedRows: report.rejectedRows,
      filteredRows: report.filteredRows,
    },
  };
  return {
    ...state,
    tracks,
    library: {
      sourceFile,
      addedAtFrom: cutoff || null,
      trackCount: Object.keys(tracks).length,
      fingerprint: normalizedFingerprint(Object.values(tracks)),
    },
    events: [...state.events, event],
  };
}
