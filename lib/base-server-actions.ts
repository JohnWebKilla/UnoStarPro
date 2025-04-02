"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import {
  CacheConfig,
  createCacheKey,
  getFromCache,
  setToCache,
  invalidateCache,
  CachedResponse,
} from "./cache-utils";

export interface BaseEntity {
  id: number;
  created_at: string;
  updated_at: string;
}

export class BaseServerActions<T extends BaseEntity> {
  protected tableName: string;
  protected cacheConfig: CacheConfig;
  protected path: string;

  constructor(tableName: string, path: string, cacheConfig: CacheConfig) {
    this.tableName = tableName;
    this.path = path;
    this.cacheConfig = cacheConfig;
  }

  protected getCacheKey(identifier?: string | number) {
    return createCacheKey(this.cacheConfig.prefix, identifier);
  }

  async getAll(): Promise<CachedResponse<T[]>> {
    const startTime = Date.now();
    const cacheKey = this.getCacheKey();

    try {
      // Try cache first
      const cachedData = await getFromCache<T[]>(cacheKey);
      if (cachedData) {
        return {
          data: cachedData,
          source: "cache",
          timing: { total: Date.now() - startTime },
        };
      }

      // If not in cache, fetch from database
      const supabase = await createClient();
      const { data: user } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Not authenticated");
      }

      const dbStartTime = Date.now();
      const { data, error } = await supabase
        .from(this.tableName)
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Cache the results
      await setToCache(cacheKey, data, this.cacheConfig.ttl);

      return {
        data: data as T[],
        source: "database",
        timing: {
          total: Date.now() - startTime,
          database: Date.now() - dbStartTime,
        },
      };
    } catch (error) {
      console.error(`Error in getAll for ${this.tableName}:`, error);
      throw error;
    }
  }

  async create(data: Partial<T>): Promise<T> {
    const supabase = await createClient();

    const { data: newItem, error } = await supabase
      .from(this.tableName)
      .insert(data)
      .select()
      .single();

    if (error) throw error;

    await this.invalidateCache();
    revalidatePath(this.path);
    return newItem as T;
  }

  async update(id: number, data: Partial<T>): Promise<T> {
    const supabase = await createClient();

    const { data: updatedItem, error } = await supabase
      .from(this.tableName)
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    await this.invalidateCache();
    revalidatePath(this.path);
    return updatedItem as T;
  }

  async delete(id: number): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase.from(this.tableName).delete().eq("id", id);

    if (error) throw error;

    await this.invalidateCache();
    revalidatePath(this.path);
  }

  async getById(id: number): Promise<T> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from(this.tableName)
      .select()
      .eq("id", id)
      .single();

    if (error) throw error;
    return data as T;
  }

  protected async invalidateCache(): Promise<void> {
    await invalidateCache(this.getCacheKey());
  }
}
