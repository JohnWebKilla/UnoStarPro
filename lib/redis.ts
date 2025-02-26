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
      retryStrategy: (times: number) => {
        // Retry connection with exponential backoff
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
      retryStrategy: (times: number) => {
        // Retry connection with exponential backoff
        return Math.min(times * 50, 2000);
      },
    };
  }

  // Default to localhost for development without Redis Cloud
  return {
    host: "localhost",
    port: 6379,
  };
};

// Create Redis client instance
const createRedisClient = () => {
  try {
    const config = getRedisConfig();
    const client = new Redis(config);

    client.on("error", (err) => {
      console.error("Redis connection error:", err);
    });

    client.on("connect", () => {
      console.log("Connected to Redis");
    });

    return client;
  } catch (error) {
    console.error("Failed to create Redis client:", error);
    // Return a dummy client for development if Redis is not available
    if (process.env.NODE_ENV !== "production") {
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
        // Add other methods as needed
      } as unknown as Redis;
    }
    throw error;
  }
};

// Create a singleton instance
let redisClient: Redis | null = null;

export const getRedisClient = () => {
  if (!redisClient) {
    redisClient = createRedisClient();
  }
  return redisClient;
};

// Helper functions for common Redis operations
export const setCache = async (
  key: string,
  value: any,
  expireInSeconds?: number
): Promise<void> => {
  const client = getRedisClient();
  const stringValue =
    typeof value === "object" ? JSON.stringify(value) : String(value);

  if (expireInSeconds) {
    await client.set(key, stringValue, "EX", expireInSeconds);
  } else {
    await client.set(key, stringValue);
  }
};

export const getCache = async <T>(key: string): Promise<T | null> => {
  const client = getRedisClient();
  const value = await client.get(key);

  if (!value) return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    return value as unknown as T;
  }
};

export const deleteCache = async (key: string): Promise<void> => {
  const client = getRedisClient();
  await client.del(key);
};

export const flushCache = async (): Promise<void> => {
  const client = getRedisClient();
  await client.flushall();
};
