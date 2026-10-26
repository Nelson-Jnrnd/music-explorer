import { describe, expect, it, vi } from 'vitest';
import { LocalStore } from './store';
import { emptyState } from '../domain/engine';
describe('LocalStore', () => {
  it('round trips validated backup JSON', () => { const store=new LocalStore(), state=emptyState(); expect(store.restore(store.exportBackup(state))).toEqual(state); });
  it('reports browser storage failures and rejects the save', async () => {
    vi.stubGlobal('localStorage', { setItem: () => { throw new Error('quota exceeded'); } });
    const store=new LocalStore(); await expect(store.save(emptyState())).rejects.toThrow('quota exceeded'); expect(store.status.state).toBe('unsaved'); expect(store.status.message).toContain('Export a backup'); vi.unstubAllGlobals();
  });
  it('allows a later save after a failed write', async () => {
    let calls=0; vi.stubGlobal('localStorage', { setItem: () => { if (++calls === 1) throw new Error('temporary'); } });
    const store=new LocalStore(); await expect(store.save(emptyState())).rejects.toThrow('temporary'); await expect(store.save(emptyState())).resolves.toBeUndefined(); expect(store.status.state).toBe('saved'); vi.unstubAllGlobals();
  });
});
