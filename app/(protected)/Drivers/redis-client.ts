"use client";

import {
  DRIVER_LIST_KEY,
  DRIVER_DETAIL_KEY,
  DRIVER_DOCUMENTS_KEY,
  CACHE_EXPIRATION,
} from "./constants";

// Re-export the constants for client-side use
export {
  DRIVER_LIST_KEY,
  DRIVER_DETAIL_KEY,
  DRIVER_DOCUMENTS_KEY,
  CACHE_EXPIRATION,
};

// These don't import the Redis implementation directly - they're just constant values
// that can be safely imported by client components
