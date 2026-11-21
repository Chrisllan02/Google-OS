export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const limit = Math.max(1, Math.min(Math.floor(concurrency) || 1, items.length));
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const runWorker = async () => {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await worker(items[current], current);
    }
  };

  await Promise.all(Array.from({ length: limit }, () => runWorker()));
  return results;
}

export class RequestTimeoutError extends Error {
  constructor(message = 'A requisição excedeu o tempo limite.') {
    super(message);
    this.name = 'RequestTimeoutError';
  }
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 15_000,
): Promise<Response> {
  const controller = new AbortController();
  const externalSignal = init.signal;

  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, Math.max(1, timeoutMs));

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (err) {
    if (timedOut) {
      throw new RequestTimeoutError(`Tempo limite de ${Math.round(timeoutMs / 1000)}s excedido.`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message = 'Tempo limite excedido.',
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new RequestTimeoutError(message)), Math.max(1, timeoutMs));
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}

export interface SlidingWindowRateLimiter {
  isLimited: (key: string, now?: number) => boolean;
  size: () => number;
  clear: () => void;
}

export function createSlidingWindowRateLimiter(
  limit: number,
  windowMs: number,
  maxKeys = 1000,
): SlidingWindowRateLimiter {
  const hits = new Map<string, number[]>();
  let opsSinceSweep = 0;
  const sweepInterval = Math.max(32, Math.min(256, Math.floor(maxKeys / 4) || 32));

  const pruneAll = (now: number) => {
    for (const [k, times] of hits) {
      const recent = times.filter((t) => now - t < windowMs);
      if (recent.length > 0) hits.set(k, recent);
      else hits.delete(k);
    }
  };

  return {
    isLimited(key: string, now = Date.now()): boolean {
      opsSinceSweep += 1;
      if (opsSinceSweep >= sweepInterval || hits.size > maxKeys) {
        opsSinceSweep = 0;
        pruneAll(now);
        while (hits.size >= maxKeys) {
          const oldestKey = hits.keys().next().value;
          if (oldestKey === undefined) break;
          hits.delete(oldestKey);
        }
      }

      const existing = hits.get(key);
      const recent = existing ? existing.filter((t) => now - t < windowMs) : [];
      if (recent.length >= limit) {
        hits.set(key, recent);
        return true;
      }
      recent.push(now);
      hits.set(key, recent);
      return false;
    },
    size: () => hits.size,
    clear: () => {
      hits.clear();
      opsSinceSweep = 0;
    },
  };
}

export function fastClone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch {
      // Fallback to JSON clone for non-cloneable values
    }
  }
  return JSON.parse(JSON.stringify(value)) as T;
}
