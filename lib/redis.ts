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

    // Add more aggressive timeouts for serverless environment
    if (process.env.VERCEL) {
      console.log("Running on Vercel - using optimized Redis settings");
      config.connectTimeout = 3000; // 3 seconds
      config.commandTimeout = 2000; // 2 seconds
      config.maxRetriesPerRequest = 1;
    }

    const client = new Redis({
      ...config,
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
      enableOfflineQueue: false, // Don't queue commands when disconnected
      enableReadyCheck: true, // Check if Redis is ready before executing commands
    });

    // Add timeout for initial connection
    const connectionPromise = new Promise<Redis>((resolve, reject) => {
      // Set a timeout for the connection
      const timeout = setTimeout(() => {
        console.warn("Redis connection timeout - falling back to dummy client");
        client.disconnect();
        resolve(createDummyClient());
      }, config.connectTimeout || 3000); // Shorter timeout

      client.on("error", (err) => {
        console.error("Redis connection error:", err);
        // Don't clear timeout or reject on first error, let the retry strategy work
      });

      client.on("connect", () => {
        console.log("Connected to Redis");
        clearTimeout(timeout);
        resolve(client);
      });

      client.on("ready", () => {
        console.log("Redis client ready");
      });

      client.on("reconnecting", () => {
        console.log("Redis client reconnecting");
      });

      client.on("end", () => {
        console.log("Redis connection closed");
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

// Create a singleton instance
let redisClient: Redis | null = null;
let redisClientPromise: Promise<Redis> | null = null;
let isConnecting = false;
let lastConnectionTime = 0;

export const getRedisClient = async (): Promise<Redis> => {
  const now = Date.now();

  // If we already have a client and it's connected and it's recent (less than 30 seconds old)
  if (
    redisClient &&
    (redisClient as any).status === "ready" &&
    now - lastConnectionTime < 30000
  ) {
    return redisClient;
  }

  // If we're in a serverless environment and the client is older than 30 seconds,
  // or if the client is not ready, create a new one
  if (
    process.env.VERCEL &&
    (now - lastConnectionTime > 30000 ||
      !redisClient ||
      (redisClient as any).status !== "ready")
  ) {
    // Clean up old client if it exists
    if (redisClient) {
      try {
        (redisClient as any).disconnect?.();
      } catch (e) {
        console.error("Error disconnecting old Redis client:", e);
      }
      redisClient = null;
      redisClientPromise = null;
    }

    console.log("Creating new Redis client (serverless refresh)");
    isConnecting = false; // Reset connecting flag
  }

  // If we're already connecting, wait for that promise to resolve
  if (redisClientPromise && isConnecting) {
    try {
      const client = await redisClientPromise;
      redisClient = client;
      lastConnectionTime = now;
      return client;
    } catch (error) {
      // If the promise fails, we'll create a new one below
      redisClientPromise = null;
    }
  }

  // Start a new connection
  isConnecting = true;
  redisClientPromise = createRedisClient();

  try {
    const client = await redisClientPromise;
    redisClient = client;
    isConnecting = false;
    lastConnectionTime = now;
    return client;
  } catch (error) {
    console.error("Failed to initialize Redis client:", error);
    isConnecting = false;
    redisClientPromise = null;
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
