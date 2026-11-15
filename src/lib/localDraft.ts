// Autosave for long forms: unsaved input is mirrored to this device, so a reload, a dropped connection or a
// closed tab does not lose it. Only this browser sees it; the server stays the source of truth (a restored
// draft still has to be saved normally). Old drafts expire after 7 days.
const MAX_AGE = 7 * 864e5;

export function saveDraft(key: string, value: unknown): void {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify({ at: Date.now(), value }));
  } catch { /* storage blocked or full: autosave is a backup only, the form keeps working */ }
}

export function readDraft<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { at, value } = JSON.parse(raw) as { at: number; value: T };
    if (!(Date.now() - at < MAX_AGE)) { localStorage.removeItem(key); return null; }
    return value;
  } catch { return null; } // unreadable backup = no backup
}

export const clearDraft = (key: string) => saveDraft(key, null);
