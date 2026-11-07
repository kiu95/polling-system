export function resolveListenHost(env: NodeJS.ProcessEnv = process.env): string {
  const host = env.HOST?.trim();
  if (host) {
    return host;
  }
  return '127.0.0.1';
}

export function resolveListenPort(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.PORT?.trim();
  if (!raw) {
    return 3000;
  }
  if (!/^\d+$/.test(raw)) {
    throw new Error(`invalid PORT: ${raw}`);
  }
  const port = Number(raw);
  if (port < 1 || port > 65535) {
    throw new Error(`invalid PORT: ${raw}`);
  }
  return port;
}
