export type CorsOrigin = boolean | string[];

/** `reflect` mirrors any Origin. `off` disables CORS. Anything else is a comma-separated allowlist. */
export function corsOriginFromEnv(env: NodeJS.ProcessEnv = process.env): CorsOrigin {
  const raw = env.CORS_ORIGIN?.trim();
  if (!raw || raw === 'reflect') {
    return true;
  }
  if (raw === 'off') {
    return false;
  }
  const origins = raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (origins.length === 0) {
    return false;
  }
  return origins;
}
