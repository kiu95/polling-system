const STORAGE_KEY = 'poll-user-id';
const MAX_USER_ID_LENGTH = 128;

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function readUserId(storage: KeyValueStore, createId: () => string): string {
  let existing: string | null = null;
  try {
    existing = storage.getItem(STORAGE_KEY);
  } catch {
    return createId();
  }

  const trimmed = existing?.trim() ?? '';
  if (trimmed.length > 0 && trimmed.length <= MAX_USER_ID_LENGTH) {
    return trimmed;
  }

  const created = createId().trim();
  try {
    storage.setItem(STORAGE_KEY, created);
  } catch {
    // Private mode: caller keeps the id in memory. The server still rejects a second vote.
  }
  return created;
}
