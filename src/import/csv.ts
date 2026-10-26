import Papa from 'papaparse';
import { type State, TrackSchema } from '../domain/model';

export type CsvMapping = { id?: string; name?: string; artists?: string; album?: string; addedAt?: string };
export type CsvReport = { tracks: import('../domain/model').Track[]; columns: string[]; duplicates: string[]; invalidIds: string[]; rejectedRows: number; filteredRows: number };
const defaultMapping: Required<CsvMapping> = { id: 'Track URI', name: 'Track Name', artists: 'Artist Name(s)', album: 'Album Name', addedAt: 'Added At' };
function spotifyId(raw: string) { const v = raw.trim(); const m = v.match(/^(?:spotify:track:|https?:\/\/open\.spotify\.com\/track\/)?([A-Za-z0-9]{22})$/); return m?.[1] ?? null; }
export function previewCsv(text: string, cutoff: string, mapping: CsvMapping = {}): CsvReport {
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: 'greedy', transform: v => v.trim() });
  const columns = parsed.meta.fields ?? [], map = { ...defaultMapping, ...mapping };
  const tracks: import('../domain/model').Track[] = [], duplicates: string[] = [], invalidIds: string[] = [];
  let rejectedRows = parsed.errors.length, filteredRows = 0; const found = new Set<string>();
  for (const row of parsed.data) {
    const rawId = row[map.id] ?? '', trackId = spotifyId(rawId), addedAt = row[map.addedAt] ?? '';
    if (!trackId) { invalidIds.push(rawId); rejectedRows++; continue; }
    if (!row[map.name]?.trim() || !row[map.artists]?.trim() || !addedAt.trim()) { rejectedRows++; continue; }
    if (cutoff && addedAt.slice(0, 10) < cutoff) { filteredRows++; continue; }
    if (found.has(trackId)) { duplicates.push(trackId); continue; }
    found.add(trackId);
    const track = TrackSchema.parse({ id: trackId, name: row[map.name].trim(), artists: row[map.artists].split(/\s*[,;]\s*/).filter(Boolean), album: (row[map.album] ?? '').trim(), addedAt, source: { ...row } });
    tracks.push(track);
  }
  return { tracks, columns, duplicates, invalidIds, rejectedRows, filteredRows };
}
export function importLibrary(state: State, report: CsvReport, sourceFile: string, cutoff: string): State {
  const tracks = { ...state.tracks }; for (const track of report.tracks) if (!tracks[track.id]) tracks[track.id] = track;
  const added = Object.keys(tracks).length - Object.keys(state.tracks).length;
  const event = { id: `event-${state.events.length + 1}`, type: 'library_imported' as const, createdAt: new Date().toISOString(), data: { sourceFile, cutoff, added, duplicates: report.duplicates.length, rejectedRows: report.rejectedRows, filteredRows: report.filteredRows } };
  return { ...state, tracks, library: { sourceFile, addedAtFrom: cutoff || null, trackCount: Object.keys(tracks).length }, events: [...state.events, event] };
}
