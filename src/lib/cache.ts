import { promises as fs } from 'fs';
import path from 'path';
import { createHash } from 'crypto';

export const TTL_PRICES = 24 * 60 * 60 * 1000;
export const TTL_PROFILE = 7 * 24 * 60 * 60 * 1000;

interface Entry<T> {
  expires: number;
  value: T;
}

const memory = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();
const MAX_MEMORY = 500;
const CACHE_DIR = path.join(process.cwd(), '.cache');

function fileFor(key: string): string {
  const hash = createHash('sha1').update(key).digest('hex').slice(0, 16);
  const safe = key.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60);
  return path.join(CACHE_DIR, `${safe}-${hash}.json`);
}

function remember<T>(key: string, entry: Entry<T>): void {
  memory.delete(key);
  memory.set(key, entry);
  while (memory.size > MAX_MEMORY) {
    const oldest = memory.keys().next().value;
    if (oldest === undefined) break;
    memory.delete(oldest);
  }
}

export async function cacheGet<T>(key: string): Promise<T | undefined> {
  const now = Date.now();
  const mem = memory.get(key) as Entry<T> | undefined;
  if (mem) {
    if (mem.expires > now) {
      // LRU: refresh insertion order
      memory.delete(key);
      memory.set(key, mem);
      return mem.value;
    }
    memory.delete(key);
  }
  try {
    const raw = await fs.readFile(fileFor(key), 'utf8');
    const entry = JSON.parse(raw) as Entry<T>;
    if (entry.expires > now) {
      remember(key, entry);
      return entry.value;
    }
    await fs.unlink(fileFor(key)).catch(() => {});
  } catch {
    /* miss */
  }
  return undefined;
}

export async function cacheSet<T>(key: string, value: T, ttlMs: number): Promise<void> {
  const entry: Entry<T> = { expires: Date.now() + ttlMs, value };
  remember(key, entry);
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(fileFor(key), JSON.stringify(entry));
  } catch {
    /* file cache is best-effort */
  }
}

/** Returns cached value or computes it (de-duplicating concurrent calls). Errors are not cached. */
export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = await cacheGet<T>(key);
  if (hit !== undefined) return hit;
  const running = inflight.get(key) as Promise<T> | undefined;
  if (running) return running;
  const p = (async () => {
    try {
      const value = await fn();
      await cacheSet(key, value, ttlMs);
      return value;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}
