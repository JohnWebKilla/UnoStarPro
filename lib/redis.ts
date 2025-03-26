import Redis from "ioredis";
import { Redis as UpstashRedis } from "@upstash/redis";
import { Stripe } from "stripe";

// Define Redis options interface
interface RedisConfigOptions {
  host: string;
  port: number;
  password?: string;
  tls?: {
    rejectUnauthorized: boolean;
  };
  retryStrategy?: (times: number) => number;
  connectTimeout?: number;
  commandTimeout?: number;
  maxRetriesPerRequest?: number;
  reconnectOnError?: (err: Error) => number;
}

// Connection pool implementation
class RedisConnectionPool {
  private pool: Redis[] = [];
  private maxConnections: number;
  private config: RedisConfigOptions;
  private inUse: Set<Redis> = new Set();
  private lastUsed: Map<Redis, number> = new Map();
  private connectionPromises: Map<Redis, Promise<void>> = new Map();

  constructor(maxConnections: number = 5) {
    this.maxConnections = maxConnections;
    this.config = getRedisConfig();
    // Add connection timeout
    this.config.connectTimeout = 2000; // Reduce to 2 seconds for faster fallback
    this.config.maxRetriesPerRequest = 1; // Reduce retries for faster fallback
    console.log(
      `Initializing Redis connection pool with max ${maxConnections} connections`
    );
  }

  async getConnection(): Promise<Redis> {
    // First, try to find an available connection
    const availableConnection = this.pool.find(
      (client) => !this.inUse.has(client)
    );

    if (availableConnection) {
      // Check if connection is still valid with timeout
      try {
        const pingPromise = availableConnection.ping();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Ping timeout")), 1000)
        );
        await Promise.race([pingPromise, timeoutPromise]);
        this.inUse.add(availableConnection);
        this.lastUsed.set(availableConnection, Date.now());
        return availableConnection;
      } catch (error) {
        console.warn("Connection validation failed:", error);
        // Connection is broken, remove it from the pool
        this.removeFromPool(availableConnection);
      }
    }

    // If pool is not full, create a new connection
    if (this.pool.length < this.maxConnections) {
      const newClient = await this.createClient();
      this.pool.push(newClient);
      this.inUse.add(newClient);
      this.lastUsed.set(newClient, Date.now());
      return newClient;
    }

    // If we reach here, all connections are in use
    // Find the least recently used connection
    let leastRecentlyUsed: Redis | null = null;
    let oldestTime = Infinity;

    // Fix for MapIterator error - convert to Array before iterating
    Array.from(this.lastUsed.entries()).forEach(([client, time]) => {
      if (time < oldestTime) {
        oldestTime = time;
        leastRecentlyUsed = client;
      }
    });

    if (leastRecentlyUsed) {
      this.inUse.add(leastRecentlyUsed);
      this.lastUsed.set(leastRecentlyUsed, Date.now());
      return leastRecentlyUsed;
    }

    // Fallback to dummy client if all else fails
    console.warn(
      "All Redis connections in use, creating temporary dummy client"
    );
    return createDummyClient();
  }

  releaseConnection(client: Redis): void {
    this.inUse.delete(client);
    this.lastUsed.set(client, Date.now());
  }

  private async createClient(): Promise<Redis> {
    const client = new Redis({
      ...this.config,
      // Enable auto reconnection
      reconnectOnError: (err) => {
        console.warn("Redis reconnecting due to error:", err.message);
        return true; // Always try to reconnect
      },
      retryStrategy: (times) => {
        // More aggressive retry strategy for serverless
        const delay = Math.min(times * 50, 1000);
        console.log(
          `Redis retrying connection in ${delay}ms (attempt ${times})`
        );
        return delay;
      },
      // Add connection pool settings
      enableOfflineQueue: true, // Enable queue when disconnected
      enableReadyCheck: true, // Check if Redis is ready before executing commands
      maxRetriesPerRequest: 3,
    });

    const connectionPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.warn("Redis connection timeout");
        reject(new Error("Redis connection timeout"));
      }, this.config.connectTimeout || 3000);

      client.on("connect", () => {
        clearTimeout(timeout);
        console.log("New Redis connection established");
        resolve();
      });

      client.on("error", (err) => {
        console.error("Redis connection error:", err);
        // Don't reject here, let the retry strategy work
      });
    });

    this.connectionPromises.set(client, connectionPromise);

    try {
      await connectionPromise;
      return client;
    } catch (error) {
      this.removeFromPool(client);
      throw error;
    }
  }

  private removeFromPool(client: Redis): void {
    const index = this.pool.indexOf(client);
    if (index !== -1) {
      this.pool.splice(index, 1);
    }
    this.inUse.delete(client);
    this.lastUsed.delete(client);
    this.connectionPromises.delete(client);

    try {
      client.disconnect();
    } catch (e) {
      console.error("Error disconnecting Redis client:", e);
    }
  }

  async closeAll(): Promise<void> {
    for (const client of this.pool) {
      try {
        client.disconnect();
      } catch (e) {
        console.error("Error disconnecting Redis client:", e);
      }
    }
    this.pool = [];
    this.inUse.clear();
    this.lastUsed.clear();
    this.connectionPromises.clear();
  }
}

// Check if we're in production or development
const getRedisConfig = (): RedisConfigOptions => {
  // For production or development with Redis Cloud
  if (process.env.REDIS_URL) {
    // Parse the Redis URL to extract host and port
    const redisUrl = process.env.REDIS_URL;
    const isSecure = redisUrl.startsWith("rediss://");

    // Remove protocol if present
    const urlWithoutProtocol = redisUrl.replace(/^(rediss?:\/\/)/, "");
    const [hostPort] = urlWithoutProtocol.split("?");
    const [host, portStr] = hostPort.split(":");
    const port = parseInt(portStr, 10);

    return {
      host,
      port,
      password: process.env.REDIS_PASSWORD,
      tls: isSecure ? { rejectUnauthorized: false } : undefined,
      connectTimeout: 3000, // Reduce to 3 seconds
      commandTimeout: 2000, // Reduce to 2 seconds
      maxRetriesPerRequest: 2,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 100, 3000); // More aggressive retry with max 3s delay
        console.log(
          `Redis retrying connection in ${delay}ms (attempt ${times})`
        );
        return delay;
      },
      reconnectOnError: (err) => {
        const targetError = "READONLY";
        if (err.message.includes(targetError)) {
          // Force reconnect on READONLY error
          return 2;
        }
        return 1;
      },
    };
  }

  // Default to localhost for development without Redis Cloud
  return {
    host: "localhost",
    port: 6379,
    connectTimeout: 3000,
    commandTimeout: 2000,
    maxRetriesPerRequest: 2,
    retryStrategy: (times: number) => {
      return Math.min(times * 100, 3000);
    },
  };
};

// Create a dummy Redis client for fallback
const createDummyClient = () => {
  console.warn("Using dummy Redis client");
  if (process.env.NODE_ENV === "production") {
    console.error("WARNING: Using dummy Redis client in production!");
  }

  return {
    get: async () => null,
    set: async () => null,
    del: async () => null,
    ping: async () => "DUMMY",
    ttl: async () => 0,
    incr: async () => 1,
    expire: async () => 1,
    flushall: async () => "OK",
    sadd: async () => 1,
    srem: async () => 1,
    smembers: async () => [],
    info: async () => "dummy_version:1.0.0",
    on: (event: string, callback: (arg: unknown) => void) => null,
    status: "ready", // Add status property for compatibility
    options: {
      host: "dummy",
      port: 0,
      password: null,
    },
    disconnect: () => {}, // Add disconnect method
    // Add other methods as needed
  } as unknown as Redis;
};

// Create a singleton instance of the connection pool
let connectionPool: RedisConnectionPool | null = null;
let activeClient: Redis | null = null;

export const getRedisClient = async (): Promise<Redis> => {
  if (!connectionPool) {
    // Determine max connections based on environment
    const maxConnections = process.env.REDIS_MAX_CONNECTIONS
      ? parseInt(process.env.REDIS_MAX_CONNECTIONS, 10)
      : process.env.NODE_ENV === "production"
        ? 5 // Reduce max connections in production to prevent connection exhaustion
        : 3;

    connectionPool = new RedisConnectionPool(maxConnections);
  }

  try {
    // Release the previous client if it exists
    if (activeClient) {
      connectionPool.releaseConnection(activeClient);
      activeClient = null;
    }

    // Get a new client from the pool
    activeClient = await connectionPool.getConnection();

    // Verify connection is working
    await activeClient.ping();

    return activeClient;
  } catch (error: any) {
    console.error("Failed to get Redis client from pool:", error);
    // Try to create a new pool if the error seems connection-related
    if (
      typeof error.message === "string" &&
      (error.message.includes("connect") || error.message.includes("timeout"))
    ) {
      console.log("Attempting to recreate connection pool...");
      await connectionPool?.closeAll();
      connectionPool = null;
      return getRedisClient(); // Retry once
    }
    return createDummyClient();
  }
};

// Helper function to execute Redis operations with automatic connection management
export const withRedisClient = async <T>(
  operation: (client: Redis) => Promise<T>
): Promise<T> => {
  let client: Redis | null = null;

  try {
    client = await getRedisClient();
    return await operation(client);
  } finally {
    if (client && connectionPool) {
      connectionPool.releaseConnection(client);
    }
  }
};

// Helper functions for common Redis operations
export const setCache = async (
  key: string,
  value: any,
  expireInSeconds?: number
): Promise<void> => {
  return withRedisClient(async (client) => {
    const startTime = Date.now();
    try {
      console.log(`[Redis] Setting cache for key: ${key}`);
      const serializedValue = JSON.stringify(value);
      if (expireInSeconds) {
        await client.set(key, serializedValue, "EX", expireInSeconds);
      } else {
        await client.set(key, serializedValue);
      }
      const duration = Date.now() - startTime;
      console.log(
        `[Redis] Successfully set cache for key: ${key} in ${duration}ms`
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(
        `[Redis] Error setting cache for key ${key} after ${duration}ms:`,
        error
      );
      // Add connection status check
      try {
        await client.ping();
      } catch (pingError) {
        console.error(`[Redis] Connection appears to be down:`, pingError);
      }
      throw error;
    }
  });
};

export const getCache = async <T>(key: string): Promise<T | null> => {
  return withRedisClient(async (client) => {
    const startTime = Date.now();
    try {
      console.log(`[Redis] Attempting to get cache for key: ${key}`);
      const value = await client.get(key);
      const duration = Date.now() - startTime;

      if (!value) {
        console.log(`[Redis] Cache miss for key: ${key} in ${duration}ms`);
        return null;
      }

      console.log(`[Redis] Cache hit for key: ${key} in ${duration}ms`);
      return JSON.parse(value) as T;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(
        `[Redis] Error getting cache for key ${key} after ${duration}ms:`,
        error
      );
      // Add connection status check
      try {
        await client.ping();
      } catch (pingError) {
        console.error(`[Redis] Connection appears to be down:`, pingError);
      }
      throw error;
    }
  });
};

// Define a type for cached data with timestamp
interface CachedData<T> {
  data: T;
  cacheTime: number;
}

export const getCacheWithTime = async <T>(
  key: string
): Promise<CachedData<T> | null> => {
  return withRedisClient(async (client) => {
    try {
      const value = await client.get(key);
      if (!value) return null;

      try {
        // Parse the JSON string
        const parsed = JSON.parse(value);

        // Create a properly typed result
        let result: CachedData<T>;

        // Check if the parsed value has our expected structure
        if (
          parsed &&
          typeof parsed === "object" &&
          "data" in parsed &&
          "cacheTime" in parsed
        ) {
          // It has our cache structure
          result = {
            data: parsed.data as T,
            cacheTime: Number(parsed.cacheTime),
          };
        } else {
          // It's just the raw data
          result = {
            data: parsed as T,
            cacheTime: Date.now(),
          };
        }

        return result;
      } catch (parseError) {
        console.error(`Error parsing JSON for key ${key}:`, parseError);
        return null;
      }
    } catch (error) {
      console.error(`Error getting cache with time for key ${key}:`, error);
      return null;
    }
  });
};

export const deleteCache = async (key: string): Promise<void> => {
  try {
    const client = await getRedisClient();
    await client.del(key);
  } catch (error) {
    console.error(`Error deleting cache for key ${key}:`, error);
    // Don't throw, just log the error
  }
};

export const flushCache = async (): Promise<void> => {
  try {
    const client = await getRedisClient();
    await client.flushall();
  } catch (error) {
    console.error("Error flushing cache:", error);
    // Don't throw, just log the error
  }
};

// Cache TTL in seconds (1 hour)
const CACHE_TTL = 60 * 60; // 1 hour

// Key prefixes for different types of data
const PAYMENT_METHODS_KEY = (companyId: number) =>
  `payment_methods:${companyId}`;
const STRIPE_DATA_KEY = (companyId: number) => `stripe_data:${companyId}`;
const STRIPE_PLANS_KEY = "stripe_plans";

// Initialize Upstash Redis client if available
const upstashRedis = process.env.UPSTASH_REDIS_REST_URL
  ? new UpstashRedis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
    })
  : null;

// Stripe-related function type definitions
export type CachePaymentMethodsFn = (
  companyId: number,
  paymentMethods: Stripe.PaymentMethod[]
) => Promise<void>;
export type GetCachedPaymentMethodsFn = (
  companyId: number
) => Promise<Stripe.PaymentMethod[] | null>;
export type CacheStripeDataFn = (companyId: number, data: any) => Promise<void>;
export type GetCachedStripeDataFn = (companyId: number) => Promise<any>;
export type CacheStripePlansFn = (plans: any) => Promise<void>;
export type GetCachedStripePlansFn = () => Promise<any>;
export type InvalidateStripeCacheFn = (companyId: number) => Promise<void>;
export type InvalidatePaymentMethodsCacheFn = (
  companyId: number
) => Promise<void>;
export type InvalidateStripePlansCacheFn = () => Promise<void>;

// Export all Stripe-related functions
export const cachePaymentMethods: CachePaymentMethodsFn = async (
  companyId,
  paymentMethods
) => {
  try {
    if (upstashRedis) {
      await upstashRedis.set(
        PAYMENT_METHODS_KEY(companyId),
        JSON.stringify(paymentMethods),
        { ex: CACHE_TTL }
      );
    }
    await setCache(PAYMENT_METHODS_KEY(companyId), paymentMethods, CACHE_TTL);
  } catch (error) {
    console.error("Error caching payment methods:", error);
  }
};

export const getCachedPaymentMethods: GetCachedPaymentMethodsFn = async (
  companyId
) => {
  try {
    if (upstashRedis) {
      const cached = await upstashRedis.get(PAYMENT_METHODS_KEY(companyId));
      if (cached) {
        return JSON.parse(cached as string);
      }
    }
    return await getCache(PAYMENT_METHODS_KEY(companyId));
  } catch (error) {
    console.error("Error getting cached payment methods:", error);
    return null;
  }
};

export const cacheStripeData: CacheStripeDataFn = async (companyId, data) => {
  try {
    const dataWithTimestamp = {
      data,
      cacheTime: Date.now(),
    };
    if (upstashRedis) {
      await upstashRedis.set(
        STRIPE_DATA_KEY(companyId),
        JSON.stringify(dataWithTimestamp),
        { ex: CACHE_TTL }
      );
    }
    await setCache(STRIPE_DATA_KEY(companyId), dataWithTimestamp, CACHE_TTL);
  } catch (error) {
    console.error("Error caching Stripe data:", error);
  }
};

export const getCachedStripeData: GetCachedStripeDataFn = async (companyId) => {
  try {
    if (upstashRedis) {
      const upstashData = await upstashRedis.get(STRIPE_DATA_KEY(companyId));
      if (upstashData) {
        const parsedData = JSON.parse(upstashData as string);
        if (Date.now() - (parsedData.cacheTime || 0) < 5 * 60 * 1000) {
          return parsedData.data;
        }
      }
    }
    const cachedData = await getCacheWithTime<any>(STRIPE_DATA_KEY(companyId));
    if (
      cachedData &&
      Date.now() - (cachedData.cacheTime || 0) < 5 * 60 * 1000
    ) {
      return cachedData.data;
    }
    return null;
  } catch (error) {
    console.error("Error getting cached Stripe data:", error);
    return null;
  }
};

export const cacheStripePlans: CacheStripePlansFn = async (plans) => {
  try {
    const dataWithTimestamp = {
      data: plans,
      cacheTime: Date.now(),
    };
    if (upstashRedis) {
      await upstashRedis.set(
        STRIPE_PLANS_KEY,
        JSON.stringify(dataWithTimestamp),
        { ex: CACHE_TTL * 24 }
      );
    }
    await setCache(STRIPE_PLANS_KEY, dataWithTimestamp, CACHE_TTL * 24);
  } catch (error) {
    console.error("Error caching Stripe plans:", error);
  }
};

export const getCachedStripePlans: GetCachedStripePlansFn = async () => {
  try {
    if (upstashRedis) {
      const cachedData = await upstashRedis.get(STRIPE_PLANS_KEY);
      if (cachedData) {
        const parsedData = JSON.parse(cachedData as string);
        if (Date.now() - (parsedData.cacheTime || 0) < 60 * 60 * 1000) {
          return parsedData.data;
        }
      }
    }
    const cachedData = await getCache<{ cacheTime?: number; data?: any }>(
      STRIPE_PLANS_KEY
    );
    if (
      cachedData?.cacheTime &&
      Date.now() - cachedData.cacheTime < 60 * 60 * 1000
    ) {
      return cachedData.data;
    }
    return null;
  } catch (error) {
    console.error("Error getting cached Stripe plans:", error);
    return null;
  }
};

export const invalidatePaymentMethodsCache: InvalidatePaymentMethodsCacheFn =
  async (companyId) => {
    try {
      if (upstashRedis) {
        await upstashRedis.del(PAYMENT_METHODS_KEY(companyId));
      }
      await deleteCache(PAYMENT_METHODS_KEY(companyId));
    } catch (error) {
      console.error("Error invalidating payment methods cache:", error);
    }
  };

export const invalidateStripeCache: InvalidateStripeCacheFn = async (
  companyId
) => {
  try {
    if (upstashRedis) {
      await upstashRedis.del(STRIPE_DATA_KEY(companyId));
    }
    await deleteCache(STRIPE_DATA_KEY(companyId));
    await invalidatePaymentMethodsCache(companyId);
  } catch (error) {
    console.error("Error invalidating Stripe cache:", error);
  }
};

export const invalidateStripePlansCache: InvalidateStripePlansCacheFn =
  async () => {
    try {
      if (upstashRedis) {
        await upstashRedis.del(STRIPE_PLANS_KEY);
      }
      await deleteCache(STRIPE_PLANS_KEY);
    } catch (error) {
      console.error("Error invalidating Stripe plans cache:", error);
    }
  };
