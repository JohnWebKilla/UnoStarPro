// Cache keys
export const USER_LIST_KEY = "users:list";
export const USER_DETAIL_KEY = (userId: string) => `user:detail:${userId}`;
export const CACHE_EXPIRATION = 300; // 5 minutes in seconds
