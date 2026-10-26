import Papa from 'papaparse';
import type { State } from '../domain/model';

/** Deliberate import only: accepted historical comparisons remain reference evidence, never tree nodes. */
export function importHistoricalComparisons(state: State, records: Array<Record<string, unknown>>): State {
  const existing = new Set(state.historicalReferenceComparisons.map(r => String(r.id ?? '')));
  const accepted: Record<string, unknown>[] = [];
  for (const row of records) {
    const id = String(row.id ?? row.judgmentId ?? '').trim();
    const referenceId = String(row.originalReferenceId ?? row.referenceId ?? row.reference_track_id ?? row.referenceSpotifyTrackId ?? row.referenceTrackId ?? '').trim();
    const verdict = String(row.verdict ?? row.judgment ?? row.rating ?? row.decision ?? row.outcome ?? '').toLowerCase().trim();
    const status = String(row.status ?? row.state ?? '').toLowerCase().trim();
    // Proposed and unrated pair tests are intentionally not historical judgments.
    if (!id || !referenceId || ['proposed','unrated','pending'].includes(status) || !['fits','no','maybe','unsure'].includes(verdict) || existing.has(id)) continue;
    existing.add(id); accepted.push({ ...row, id, originalReferenceId: referenceId, verdict });
  }
  if (!accepted.length) return state;
  const event = { id: `event-${state.events.length + 1}`, type: 'historical_imported' as const, createdAt: new Date(state.events.length).toISOString(), data: { imported: accepted.length } };
  return { ...state, historicalReferenceComparisons: [...state.historicalReferenceComparisons, ...accepted], events: [...state.events, event] };
}

export function parseHistoricalComparisons(text: string): Array<Record<string, unknown>> {
  const trimmed = text.trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    const data = JSON.parse(trimmed) as unknown;
    if (Array.isArray(data)) return data.filter((r): r is Record<string, unknown> => !!r && typeof r === 'object' && !Array.isArray(r));
    const root = data as Record<string, unknown>;
    const rows = root.historicalJudgments ?? root.historical_judgments ?? root.judgments ?? root.evaluations;
    return Array.isArray(rows) ? rows.filter((r): r is Record<string, unknown> => !!r && typeof r === 'object' && !Array.isArray(r)) : [];
  }
  return Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: 'greedy' }).data;
}
