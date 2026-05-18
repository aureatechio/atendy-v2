function isAuthDebugEnabled() {
  return process.env.NEXT_PUBLIC_AUTH_DEBUG === "1" || (typeof window === "undefined" && process.env.AUTH_DEBUG === "1");
}

export function startAuthTiming() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function logAuthTiming(label: string, startedAt: number) {
  if (!isAuthDebugEnabled()) {
    return;
  }

  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  console.info(`[auth] ${label}: ${Math.round(now - startedAt)}ms`);
}

export async function timeAuthStep<T>(label: string, action: () => PromiseLike<T>): Promise<T> {
  const startedAt = startAuthTiming();

  try {
    return await action();
  } finally {
    logAuthTiming(label, startedAt);
  }
}
