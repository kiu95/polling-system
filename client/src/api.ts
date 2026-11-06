export function apiUrl(path: string, base = import.meta.env.VITE_API_URL ?? ''): string {
  const trimmed = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${trimmed}${path}`;
}
