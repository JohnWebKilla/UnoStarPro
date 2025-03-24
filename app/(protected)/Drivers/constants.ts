// Cache keys
export const DRIVER_LIST_KEY = "drivers:list";
export const DRIVER_DETAIL_KEY = (id: number) => `driver:${id}`;
export const DRIVER_DOCUMENTS_KEY = (id: number) => `driver_documents:${id}`;

// Cache expiration time in seconds (5 minutes)
export const CACHE_EXPIRATION = 300;

// Driver status options
export const DRIVER_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
} as const;

// Driver team options
export const DRIVER_TEAM = {
  SOLO: "solo",
  TEAM: "team",
} as const;
