"use client";

import { Driver } from "./types";

// Safely access session storage (works on both client and server)
const safeSessionStorage =
  typeof window !== "undefined" ? window.sessionStorage : null;

// Key for currently selected driver
export const SELECTED_DRIVER_KEY = "selectedDriver";

// Key for recent drivers (used for navigation history)
export const RECENT_DRIVERS_KEY = "recentDrivers";

// Max number of recent drivers to keep
export const MAX_RECENT_DRIVERS = 10;

/**
 * Store the currently selected driver in session storage
 */
export function storeSelectedDriver(driver: Driver | null) {
  if (!safeSessionStorage || !driver) return;

  try {
    safeSessionStorage.setItem(SELECTED_DRIVER_KEY, JSON.stringify(driver));

    // Also add to recent drivers
    addToRecentDrivers(driver);
  } catch (error) {
    console.error("Error storing selected driver:", error);
  }
}

/**
 * Get the currently selected driver from session storage
 */
export function getSelectedDriver(): Driver | null {
  if (!safeSessionStorage) return null;

  try {
    const stored = safeSessionStorage.getItem(SELECTED_DRIVER_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error("Error retrieving selected driver:", error);
    return null;
  }
}

/**
 * Add a driver to the recent drivers list
 */
export function addToRecentDrivers(driver: Driver) {
  if (!safeSessionStorage || !driver) return;

  try {
    // Get current list
    const stored = safeSessionStorage.getItem(RECENT_DRIVERS_KEY);
    const recentDrivers: Driver[] = stored ? JSON.parse(stored) : [];

    // Remove if already exists (to avoid duplicates)
    const filtered = recentDrivers.filter(
      (d) => String(d.id) !== String(driver.id)
    );

    // Add to the front
    filtered.unshift(driver);

    // Keep only the most recent N
    const trimmed = filtered.slice(0, MAX_RECENT_DRIVERS);

    // Store back
    safeSessionStorage.setItem(RECENT_DRIVERS_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.error("Error adding to recent drivers:", error);
  }
}

/**
 * Get the list of recent drivers
 */
export function getRecentDrivers(): Driver[] {
  if (!safeSessionStorage) return [];

  try {
    const stored = safeSessionStorage.getItem(RECENT_DRIVERS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Error retrieving recent drivers:", error);
    return [];
  }
}

/**
 * Clear the driver storage
 */
export function clearDriverStorage() {
  if (!safeSessionStorage) return;

  try {
    safeSessionStorage.removeItem(SELECTED_DRIVER_KEY);
    safeSessionStorage.removeItem(RECENT_DRIVERS_KEY);
  } catch (error) {
    console.error("Error clearing driver storage:", error);
  }
}

// Cache utility functions
export function isExpired(timestamp: number): boolean {
  return Date.now() > timestamp;
}
