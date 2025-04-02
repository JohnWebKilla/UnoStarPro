// Cache keys
export const USER_LIST_KEY = "users:list";
export const USER_DETAIL_KEY = (userId: string) => `users:${userId}`;

// Cache expiration time in seconds (24 hours)
export const CACHE_EXPIRATION = 24 * 60 * 60;
