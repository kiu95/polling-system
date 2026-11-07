import type { PollResults } from '@scmp/shared';

export function apiUrl(path: string, base = import.meta.env.VITE_API_URL ?? ''): string {
  const trimmed = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${trimmed}${path}`;
}

export function wsUrl(path: string, base = import.meta.env.VITE_API_URL ?? ''): string {
  const trimmed = base.endsWith('/') ? base.slice(0, -1) : base;
  if (trimmed.startsWith('https://')) {
    return `wss://${trimmed.slice('https://'.length)}${path}`;
  }
  if (trimmed.startsWith('http://')) {
    return `ws://${trimmed.slice('http://'.length)}${path}`;
  }
  if (trimmed.length > 0) {
    return `${trimmed}${path}`;
  }
  const protocol = globalThis.location?.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = globalThis.location?.host ?? '127.0.0.1:5173';
  return `${protocol}//${host}${path}`;
}

export async function fetchResults(): Promise<PollResults | null> {
  try {
    const response = await fetch(apiUrl('/results'));
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as PollResults;
  } catch {
    return null;
  }
}
