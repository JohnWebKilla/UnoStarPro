import Redis from "ioredis";

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
}

// Check if we're in production or development
const getRedisConfig = (): RedisConfigOptions => {
  // For production with Redis Cloud
  if (process.env.REDIS_URL && process.env.NODE_ENV === "production") {
    // Parse the Redis URL to extract host and port
    const redisUrl = process.env.REDIS_URL;
    const [hostPort] = redisUrl.split("?");
    const [host, portStr] = hostPort.split(":");
    const port = parseInt(portStr, 10);

    return {
      host,
      port,
      password: process.env.REDIS_PASSWORD,
      // Enable TLS for Redis Cloud
      tls: { rejectUnauthorized: false },
      connectTimeout: 5000, // 5 seconds
      commandTimeout: 3000, // 3 seconds
      maxRetriesPerRequest: 2,
      retryStrategy: (times: number) => {
        // Retry connection with exponential backoff, but limit to 2 seconds max
        return Math.min(times * 50, 2000);
      },
    };
  }

  // For development with Redis Cloud (if URL is provided)
  if (process.env.REDIS_URL) {
    // Parse the Redis URL to extract host and port
    const redisUrl = process.env.REDIS_URL;
    const [hostPort] = redisUrl.split("?");
    const [host, portStr] = hostPort.split(":");
    const port = parseInt(portStr, 10);

    return {
      host,
      port,
      password: process.env.REDIS_PASSWORD,
      connectTimeout: 5000, // 5 seconds
      commandTimeout: 3000, // 3 seconds
      maxRetriesPerRequest: 2,
      retryStrategy: (times: number) => {
        // Retry connection with exponential backoff, but limit to 2 seconds max
        return Math.min(times * 50, 2000);
      },
    };
  }

  // Default to localhost for development without Redis Cloud
  return {
    host: "localhost",
    port: 6379,
    connectTimeout: 5000, // 5 seconds
    commandTimeout: 3000, // 3 seconds
    maxRetriesPerRequest: 2,
  };
};

// Create Redis client instance
const createRedisClient = (): Promise<Redis> => {
  try {
    const config = getRedisConfig();
    const client = new Redis(config);

    // Add timeout for initial connection
    const connectionPromise = new Promise<Redis>((resolve, reject) => {
      // Set a timeout for the connection
      const timeout = setTimeout(() => {
        console.warn("Redis connection timeout - falling back to dummy client");
        resolve(createDummyClient());
      }, config.connectTimeout || 5000);

      client.on("error", (err) => {
        console.error("Redis connection error:", err);
        clearTimeout(timeout);
        // Don't reject, just log the error
      });

      client.on("connect", () => {
        console.log("Connected to Redis");
        clearTimeout(timeout);
        resolve(client);
      });
    });

    // Return a promise that resolves to either the real client or a dummy client
    return connectionPromise
      .then((resolvedClient) => {
        return resolvedClient;
      })
      .catch((error) => {
        console.error("Redis connection failed:", error);
        return createDummyClient();
      });
  } catch (error) {
    console.error("Failed to create Redis client:", error);
    // Return a dummy client for development if Redis is not available
    return Promise.resolve(createDummyClient());
  }
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
    on: (event: string, callback: Function) => null,
    options: {
      host: "dummy",
      port: 0,
      password: null,
    },
    // Add other methods as needed
  } as unknown as Redis;
};

// Create a singleton instance
let redisClient: Redis | null = null;
let redisClientPromise: Promise<Redis> | null = null;

export const getRedisClient = async (): Promise<Redis> => {
  if (redisClient) {
    return redisClient;
  }

  if (redisClientPromise) {
    const client = await redisClientPromise;
    redisClient = client;
    return client;
  }

  redisClientPromise = createRedisClient();
  try {
    const client = await redisClientPromise;
    redisClient = client;
    return client;
  } catch (error) {
    console.error("Failed to initialize Redis client:", error);
    const dummyClient = createDummyClient();
    redisClient = dummyClient;
    return dummyClient;
  }
};

// Helper functions for common Redis operations
export const setCache = async (
  key: string,
  value: any,
  expireInSeconds?: number
): Promise<void> => {
  const client = await getRedisClient();
  const stringValue =
    typeof value === "object" ? JSON.stringify(value) : String(value);

  try {
    if (expireInSeconds) {
      await client.set(key, stringValue, "EX", expireInSeconds);
    } else {
      await client.set(key, stringValue);
    }
  } catch (error) {
    console.error(`Error setting cache for key ${key}:`, error);
    // Don't throw, just log the error
  }
};

export const getCache = async <T>(key: string): Promise<T | null> => {
  try {
    const client = await getRedisClient();
    const value = await client.get(key);

    if (!value) return null;

    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  } catch (error) {
    console.error(`Error getting cache for key ${key}:`, error);
    return null;
  }
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
