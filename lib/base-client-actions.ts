"use client";

import { BaseEntity } from "./base-server-actions";
import {
  CachedResponse,
  getClientCache,
  setClientCache,
  clearClientCache,
} from "./cache-utils";

export interface ClientApiResponse<T> extends CachedResponse<T> {
  error?: string;
}

export class BaseClientActions<T extends BaseEntity> {
  protected cachePrefix: string;
  protected serverActions: any;

  constructor(cachePrefix: string, serverActions: any) {
    this.cachePrefix = cachePrefix;
    this.serverActions = serverActions;
  }

  protected getCacheKey(identifier?: string | number): string {
    return `${this.cachePrefix}${identifier ? `:${identifier}` : ""}`;
  }

  async getAll(skipCache: boolean = false): Promise<ClientApiResponse<T[]>> {
    const startTime = performance.now();
    const cacheKey = this.getCacheKey("list");

    if (!skipCache) {
      try {
        const cachedResult = await getClientCache<T[]>(cacheKey);
        return {
          ...cachedResult,
          timing: {
            ...cachedResult.timing,
            total: performance.now() - startTime,
          },
        };
      } catch (error) {
        console.log("No valid client cache found, fetching from server");
      }
    }

    try {
      const result = await this.serverActions.getAll();

      // Cache the fresh data
      try {
        setClientCache(cacheKey, result.data);
      } catch (cacheError) {
        console.error("Failed to set client cache:", cacheError);
      }

      return {
        ...result,
        timing: {
          ...result.timing,
          total: performance.now() - startTime,
        },
      };
    } catch (error) {
      console.error(`Error fetching ${this.cachePrefix}:`, error);
      throw error;
    }
  }

  async create(data: Partial<T>): Promise<T> {
    try {
      const result = await this.serverActions.create(data);
      await this.invalidateCache();
      return result;
    } catch (error) {
      console.error(`Error creating ${this.cachePrefix}:`, error);
      throw error;
    }
  }

  async update(id: number, data: Partial<T>): Promise<T> {
    try {
      const result = await this.serverActions.update(id, data);
      await this.invalidateCache();
      return result;
    } catch (error) {
      console.error(`Error updating ${this.cachePrefix}:`, error);
      throw error;
    }
  }

  async delete(id: number): Promise<void> {
    try {
      await this.serverActions.delete(id);
      await this.invalidateCache();
    } catch (error) {
      console.error(`Error deleting ${this.cachePrefix}:`, error);
      throw error;
    }
  }

  async getById(id: number): Promise<T> {
    const cacheKey = this.getCacheKey(id);

    try {
      const cachedResult = await getClientCache<T>(cacheKey);
      return cachedResult.data;
    } catch (error) {
      try {
        const result = await this.serverActions.getById(id);
        setClientCache(cacheKey, result);
        return result;
      } catch (error) {
        console.error(`Error fetching ${this.cachePrefix} by id:`, error);
        throw error;
      }
    }
  }

  protected async invalidateCache(): Promise<void> {
    clearClientCache(this.getCacheKey("list"));
  }
}
