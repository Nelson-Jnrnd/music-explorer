import { StateSchema, type State } from '../domain/model';

type Writable = { write(data: string): Promise<void>; close(): Promise<void>; abort?(): Promise<void> };
type FileHandle = { getFile(): Promise<File>; createWritable(): Promise<Writable>; queryPermission?(options: { mode: 'readwrite' }): Promise<PermissionState>; requestPermission?(options: { mode: 'readwrite' }): Promise<PermissionState> };
type PickerWindow = Window & { showSaveFilePicker?: (options?: unknown) => Promise<FileHandle>; showOpenFilePicker?: (options?: unknown) => Promise<FileHandle[]> };
const RECOVERY_KEY = 'music-explorer-recovery-v1';
export type StoreStatus = { mode: 'browser-recovery'|'file'; state: 'ready'|'saving'|'saved'|'unsaved'|'permission-required'; message: string };

export class LocalStore {
  private handle: FileHandle | null = null;
  private writeChain: Promise<void> = Promise.resolve();
  status: StoreStatus = { mode: 'browser-recovery', state: 'ready', message: 'Using browser recovery. Export a backup to keep a separate copy.' };
  async load(): Promise<State | null> {
    try {
      if (this.handle) { const file = await this.handle.getFile(); return StateSchema.parse(JSON.parse(await file.text())); }
      const text = localStorage.getItem(RECOVERY_KEY); return text ? StateSchema.parse(JSON.parse(text)) : null;
    } catch (error) { this.status = { ...this.status, state: 'unsaved', message: `Saved data could not be loaded: ${message(error)}` }; throw error; }
  }
  save(state: State): Promise<void> {
    const safe = StateSchema.parse(state), payload = JSON.stringify(safe, null, 2);
    this.status = { ...this.status, state: 'saving', message: 'Saving…' };
    this.writeChain = this.writeChain.catch(() => undefined).then(async () => {
      if (this.handle) {
        const permission = await this.handle.queryPermission?.({ mode: 'readwrite' });
        if (permission === 'denied') { this.status = { mode: 'file', state: 'permission-required', message: 'File access needs permission. Choose the file again to resume saving.' }; throw new Error(this.status.message); }
        const writer = await this.handle.createWritable();
        try { await writer.write(payload); await writer.close(); }
        catch (error) { await writer.abort?.().catch(() => undefined); throw error; }
        this.status = { mode: 'file', state: 'saved', message: 'Saved to your chosen JSON file.' };
      } else {
        localStorage.setItem(RECOVERY_KEY, payload);
        this.status = { mode: 'browser-recovery', state: 'saved', message: 'Saved in this browser. This is not a separate backup file.' };
      }
    }).catch(error => {
      let recovery = '';
      try { localStorage.setItem(RECOVERY_KEY, payload); recovery = ' A browser recovery copy was saved.'; } catch { /* Surface primary failure; export remains available. */ }
      this.status = { ...this.status, state: 'unsaved', message: `Save failed. Export a backup or retry: ${message(error)}${recovery}` }; throw error;
    });
    return this.writeChain;
  }
  async chooseFile(state: State): Promise<void> {
    const win = window as PickerWindow;
    if (!win.showSaveFilePicker) { this.status = { mode: 'browser-recovery', state: 'unsaved', message: 'This browser cannot write a chosen file. Use browser recovery and export a backup.' }; throw new Error(this.status.message); }
    try {
      this.handle = await win.showSaveFilePicker({ suggestedName: 'exploration.json', types: [{ description: 'JSON file', accept: { 'application/json': ['.json'] } }] });
      if (this.handle.requestPermission && await this.handle.requestPermission({ mode: 'readwrite' }) !== 'granted') throw new Error('Write permission was not granted.');
      this.status = { mode: 'file', state: 'ready', message: 'Chosen file is ready.' };
      await this.save(state);
    } catch (error) { if (message(error) === 'The user aborted a request.') return; this.status = { mode: 'file', state: 'unsaved', message: `Could not choose or save the file: ${message(error)}` }; throw error; }
  }
  exportBackup(state: State): string { return JSON.stringify(StateSchema.parse(state), null, 2); }
  restore(text: string): State { return StateSchema.parse(JSON.parse(text)); }
}
function message(error: unknown) { return error instanceof Error ? error.message : String(error); }
