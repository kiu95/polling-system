import { describe, expect, it } from 'vitest';
import { type KeyValueStore, readUserId } from './user-id';

function memoryStore(initial: string | null = null): KeyValueStore & { value: string | null } {
  const box = { value: initial };
  return {
    get value() {
      return box.value;
    },
    getItem() {
      return box.value;
    },
    setItem(_key: string, value: string) {
      box.value = value;
    },
  };
}

describe('readUserId', () => {
  it('reuses a stored id', () => {
    const storage = memoryStore('user-1');
    expect(readUserId(storage, () => 'fresh')).toBe('user-1');
    expect(storage.value).toBe('user-1');
  });

  it('stores a new id when the key is empty', () => {
    const storage = memoryStore(null);
    expect(readUserId(storage, () => 'fresh-id')).toBe('fresh-id');
    expect(storage.value).toBe('fresh-id');
  });

  it('returns an id when storage throws', () => {
    const storage: KeyValueStore = {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('blocked');
      },
    };
    expect(readUserId(storage, () => 'tab-id')).toBe('tab-id');
  });
});
