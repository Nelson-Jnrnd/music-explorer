import { describe, expect, it } from 'vitest';
import { emptyState } from '../domain/engine';
import { importHistoricalComparisons, parseHistoricalComparisons } from './history';
describe('historical comparison import', () => {
  it('is explicit, idempotent and does not create graph branches from proposed pairs', () => {
    const source=parseHistoricalComparisons(JSON.stringify({ historicalJudgments:[{id:'j1',referenceId:'ref-original',verdict:'fits'}, {id:'proposed',referenceId:'ref',status:'proposed',verdict:'fits'}, {id:'unrated',referenceId:'ref'}] }));
    const s=importHistoricalComparisons(emptyState(),source); const repeated=importHistoricalComparisons(s,source);
    expect(s.historicalReferenceComparisons).toHaveLength(1); expect(repeated.historicalReferenceComparisons).toHaveLength(1); expect(repeated.nodes).toHaveLength(0); expect(s.historicalReferenceComparisons[0].originalReferenceId).toBe('ref-original');
  });
});
