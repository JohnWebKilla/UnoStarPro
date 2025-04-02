export interface ClientCacheConfig {
  prefix: string;
  ttl?: number;
}

export interface ClientCacheResponse<T> {
  data: T;
  source: "cache" | "database";
  timing: {
    total: number;
    database?: number;
    source?: "client-cache" | "server" | "local-storage";
  };
}

const CACHE_TTL = 3600; // 1 hour in seconds

// Use localStorage for client-side caching
export async function getClientCache<T>(key: string): Promise<T | null> {
  try {
    const item = localStorage.getItem(key);
    if (!item) return null;

    const { data, expiry } = JSON.parse(item);
    if (expiry && expiry < Date.now()) {
      localStorage.removeItem(key);
      return null;
    }

    return data as T;
  } catch (error) {
    console.error(`Error getting from client cache for key ${key}:`, error);
    return null;
  }
}

export async function setClientCache<T>(
  key: string,
  data: T,
  ttl: number = CACHE_TTL
): Promise<void> {
  try {
    const item = {
      data,
      expiry: Date.now() + ttl * 1000,
    };
    localStorage.setItem(key, JSON.stringify(item));
  } catch (error) {
    console.error(`Error setting client cache for key ${key}:`, error);
  }
}

export async function clearClientCache(key: string): Promise<void> {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`Error clearing client cache for key ${key}:`, error);
  }
}

export function createClientCacheKey(
  prefix: string,
  identifier?: string | number
): string {
  return `${prefix}${identifier ? `:${identifier}` : ""}`;
}
