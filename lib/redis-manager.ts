import Redis from "ioredis";

export class RedisManager {
  private static instance: Redis | null = null;
  private static connectionPromise: Promise<Redis> | null = null;

  private static async createConnection(): Promise<Redis> {
    if (!process.env.REDIS_URL || !process.env.REDIS_PASSWORD) {
      throw new Error("Redis environment variables not configured");
    }

    try {
      // Create Redis connection URL
      const redis = new Redis({
        host: process.env.REDIS_URL.split(":")[0],
        port: parseInt(process.env.REDIS_URL.split(":")[1], 10),
        password: process.env.REDIS_PASSWORD,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      });

      // Test the connection
      await redis.ping();
      console.log("Redis connection established successfully");

      return redis;
    } catch (error) {
      console.error("Failed to establish Redis connection:", error);
      throw error;
    }
  }

  public static async getConnection(): Promise<Redis> {
    // If we already have an instance, return it
    if (this.instance) {
      return this.instance;
    }

    // If we're already creating a connection, return the promise
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    // Create a new connection
    try {
      this.connectionPromise = this.createConnection();
      this.instance = await this.connectionPromise;
      return this.instance;
    } catch (error) {
      this.connectionPromise = null;
      throw error;
    }
  }

  public static async disconnect(): Promise<void> {
    if (this.instance) {
      await this.instance.quit();
      this.instance = null;
      this.connectionPromise = null;
      console.log("Redis connection closed");
    }
  }

  public static isConnected(): boolean {
    return this.instance !== null && this.instance.status === "ready";
  }
}
